"""
Views for expense CRUD and currency utilities.

Endpoints:
    POST /api/expenses/             — submit expense (employee+)
    GET  /api/expenses/             — list expenses (role-scoped)
    GET  /api/expenses/stats/       — expense statistics for dashboard
    GET  /api/expenses/<uuid>/      — expense detail with approval trail
    GET  /api/countries/            — country + currency list (proxy)
    GET  /api/currency/convert/     — convert between currencies
"""

import logging

from django.db.models import Count, Sum, Q, DecimalField
from django.db.models.functions import Coalesce
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsManagerOrAdmin
from apps.accounts.models import User
from apps.approvals.models import ApprovalRequest

from .models import Expense
from .serializers import (
    CurrencyConvertSerializer,
    ExpenseCreateSerializer,
    ExpenseDetailSerializer,
    ExpenseListSerializer,
)
from .utils import convert_currency, get_country_currency_list

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Expense Dashboard Stats
# ---------------------------------------------------------------------------
class ExpenseDashboardStatsView(APIView):
    """
    GET /api/expenses/stats/
    Returns dashboard statistics based on the authenticated user's role.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        
        stats = {
            "total_submitted": 0,
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "total_amount_submitted": "0.00",
            "total_amount_approved": "0.00"
        }
        
        if user.role == "EMPLOYEE":
            qs = Expense.objects.filter(submitted_by=user)
        elif user.role == "MANAGER":
            subordinate_ids = list(User.objects.filter(manager=user).values_list("pk", flat=True))
            subordinate_ids.append(user.pk)
            qs = Expense.objects.filter(submitted_by_id__in=subordinate_ids)
        elif user.role == "ADMIN":
            qs = Expense.objects.filter(submitted_by__company=user.company)
        else:
            qs = Expense.objects.none()

        if qs.exists():
            aggregation = qs.aggregate(
                total=Count("id"),
                pending_count=Count("id", filter=Q(status="PENDING")),
                approved_count=Count("id", filter=Q(status="APPROVED")),
                rejected_count=Count("id", filter=Q(status="REJECTED")),
                total_amount=Coalesce(Sum("amount_in_company_currency"), 0, output_field=DecimalField()),
                approved_amount=Coalesce(Sum("amount_in_company_currency", filter=Q(status="APPROVED")), 0, output_field=DecimalField()),
            )
            
            stats["total_submitted"] = aggregation["total"] or 0
            stats["pending"] = aggregation["pending_count"] or 0
            stats["approved"] = aggregation["approved_count"] or 0
            stats["rejected"] = aggregation["rejected_count"] or 0
            stats["total_amount_submitted"] = f"{aggregation['total_amount']:.2f}"
            stats["total_amount_approved"] = f"{aggregation['approved_amount']:.2f}"

        if user.role in ["MANAGER", "ADMIN"]:
            stats["pending_approvals_count"] = ApprovalRequest.objects.filter(
                approver=user, status="PENDING"
            ).count()

        if user.role == "ADMIN":
            stats["total_users"] = User.objects.filter(company=user.company).count()

        return Response(stats)


# ---------------------------------------------------------------------------
# Expense List + Create
# ---------------------------------------------------------------------------
class ExpenseListCreateView(generics.ListCreateAPIView):
    """
    GET  — list expenses scoped by role:
           EMPLOYEE  → own expenses only
           MANAGER   → expenses from subordinates + own
           ADMIN     → all company expenses
    POST — submit a new expense (any authenticated user).
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ExpenseCreateSerializer
        return ExpenseListSerializer

    def get_queryset(self):
        """Role-scoped expense listing with optional filters."""
        user = self.request.user
        company = user.company

        qs = Expense.objects.filter(
            submitted_by__company=company
        ).select_related("submitted_by")

        if user.role == "EMPLOYEE":
            qs = qs.filter(submitted_by=user)
        elif user.role == "MANAGER":
            from apps.accounts.models import User

            subordinate_ids = list(
                User.objects.filter(manager=user).values_list("pk", flat=True)
            )
            subordinate_ids.append(user.pk)
            qs = qs.filter(submitted_by_id__in=subordinate_ids)
        # ADMIN sees all company expenses (no extra filter)

        # Optional query-param filters
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        category_filter = self.request.query_params.get("category")
        if category_filter:
            qs = qs.filter(category=category_filter.upper())

        return qs.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        expense = serializer.save()

        # Kick off approval workflow after creation
        from apps.approvals.engine import initiate_approval

        try:
            initiate_approval(expense)
        except Exception as exc:
            logger.error("Failed to initiate approval for expense %s: %s", expense.id, exc)

        return Response(
            {
                "message": "Expense submitted successfully.",
                "expense": ExpenseListSerializer(expense).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Expense Detail
# ---------------------------------------------------------------------------
class ExpenseDetailView(generics.RetrieveAPIView):
    """
    GET /api/expenses/<uuid>/ — expense detail with full approval trail.
    Scoped to the user's company; employees can only see their own.
    """

    serializer_class = ExpenseDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_queryset(self):
        user = self.request.user
        qs = Expense.objects.filter(
            submitted_by__company=user.company
        ).select_related("submitted_by", "submitted_by__company")

        if user.role == "EMPLOYEE":
            qs = qs.filter(submitted_by=user)

        return qs


# ---------------------------------------------------------------------------
# Country + Currency List (proxy)
# ---------------------------------------------------------------------------
class CountryListView(APIView):
    """
    GET /api/countries/ — returns country → currency mapping.
    Public endpoint (useful for signup form).
    """

    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        data = get_country_currency_list()
        if not data:
            return Response(
                {"error": "Unable to fetch country data. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Currency Conversion
# ---------------------------------------------------------------------------
class CurrencyConvertView(APIView):
    """
    GET /api/currency/convert/?amount=100&from_currency=USD&to_currency=INR
    Returns the converted amount.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = CurrencyConvertSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        result = convert_currency(
            data["amount"],
            data["from_currency"],
            data["to_currency"],
        )

        if result is None:
            return Response(
                {"error": "Currency conversion failed. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "amount": str(data["amount"]),
                "from_currency": data["from_currency"].upper(),
                "to_currency": data["to_currency"].upper(),
                "converted_amount": str(result),
            },
            status=status.HTTP_200_OK,
        )
