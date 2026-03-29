"""
Views for approval workflows and rule management.

Endpoints:
    GET  /api/approvals/pending/          — list pending approvals for current user
    POST /api/approvals/<uuid>/decide/    — approve or reject
    GET  /api/rules/                      — list company rules (admin)
    POST /api/rules/                      — create rule (admin)
    GET  /api/rules/<uuid>/               — rule detail (admin)
    PATCH/PUT /api/rules/<uuid>/          — update rule (admin)
"""

import logging

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsManagerOrAdmin
from .engine import process_approval
from .models import ApprovalRequest, ApprovalRule
from .serializers import (
    ApprovalDecisionSerializer,
    ApprovalRequestSerializer,
    ApprovalRuleCreateSerializer,
    ApprovalRuleSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pending Approvals (for the logged-in approver)
# ---------------------------------------------------------------------------
class PendingApprovalsView(generics.ListAPIView):
    """
    GET /api/approvals/pending/
    Returns all PENDING ApprovalRequests assigned to the current user.
    """

    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsManagerOrAdmin]

    def get_queryset(self):
        return (
            ApprovalRequest.objects
            .filter(approver=self.request.user, status="PENDING")
            .select_related("approver", "step", "expense", "expense__submitted_by")
            .order_by("-expense__created_at")
        )

    def list(self, request, *args, **kwargs):
        """Enrich each pending request with expense summary info."""
        qs = self.get_queryset()
        data = []
        for ar in qs:
            item = ApprovalRequestSerializer(ar).data
            item["expense_summary"] = {
                "expense_id": str(ar.expense.id),
                "submitted_by": ar.expense.submitted_by.name,
                "submitted_by_email": ar.expense.submitted_by.email,
                "amount": str(ar.expense.amount),
                "currency": ar.expense.currency,
                "amount_in_company_currency": str(ar.expense.amount_in_company_currency),
                "category": ar.expense.category,
                "description": ar.expense.description,
                "date": str(ar.expense.date),
            }
            data.append(item)

        return Response(data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Approval Decision
# ---------------------------------------------------------------------------
class ApprovalDecisionView(APIView):
    """
    POST /api/approvals/<uuid>/decide/

    Body: { "decision": "APPROVED" | "REJECTED", "comment": "..." }
    """

    permission_classes = [IsManagerOrAdmin]

    def post(self, request, pk, *args, **kwargs):
        # Fetch the approval request — must be assigned to this user and PENDING
        try:
            approval_request = ApprovalRequest.objects.select_related(
                "expense", "expense__submitted_by", "expense__submitted_by__company",
                "step", "approver",
            ).get(pk=pk)
        except ApprovalRequest.DoesNotExist:
            return Response(
                {"error": "Approval request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if approval_request.approver_id != request.user.pk:
            return Response(
                {"error": "This approval request is not assigned to you."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if approval_request.status != "PENDING":
            return Response(
                {"error": f"This request has already been {approval_request.status.lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        decision = serializer.validated_data["decision"]
        comment = serializer.validated_data.get("comment", "")

        process_approval(approval_request, decision, comment)

        return Response(
            {
                "message": f"Expense {decision.lower()} successfully.",
                "approval_request": ApprovalRequestSerializer(approval_request).data,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Approval Rules CRUD (Admin only)
# ---------------------------------------------------------------------------
class ApprovalRuleListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/rules/ — list all rules for the admin's company.
    POST /api/rules/ — create a new approval rule with steps.
    """

    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ApprovalRuleCreateSerializer
        return ApprovalRuleSerializer

    def get_queryset(self):
        return (
            ApprovalRule.objects
            .filter(company=self.request.user.company)
            .prefetch_related("steps", "steps__approver")
            .select_related("specific_approver")
            .order_by("-is_active", "name")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        rule = serializer.save()

        return Response(
            {
                "message": "Approval rule created successfully.",
                "rule": ApprovalRuleSerializer(rule).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ApprovalRuleDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/rules/<uuid>/ — rule detail with steps.
    PATCH /api/rules/<uuid>/ — update rule and/or steps.
    """

    permission_classes = [IsAdmin]
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ApprovalRuleCreateSerializer
        return ApprovalRuleSerializer

    def get_queryset(self):
        return (
            ApprovalRule.objects
            .filter(company=self.request.user.company)
            .prefetch_related("steps", "steps__approver")
            .select_related("specific_approver")
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        rule = serializer.save()

        return Response(
            {
                "message": "Approval rule updated successfully.",
                "rule": ApprovalRuleSerializer(rule).data,
            },
            status=status.HTTP_200_OK,
        )
