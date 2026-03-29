"""
Approval Workflow Engine

Handles:
  1. Initiation   — creates the first ApprovalRequest(s) when an expense is submitted
  2. Processing   — evaluates decisions and advances the workflow
  3. Rule types   — SEQUENTIAL, PERCENTAGE, SPECIFIC, HYBRID

Key concepts:
  - is_manager_approver: if the submitting user's flag is True, their direct
    manager must approve FIRST before any rule-based steps kick in.
  - Sequential: steps fire one-at-a-time in step_order.
  - Percentage: all approvers get a request at once; threshold % must approve.
  - Specific: one designated approver; their approval = auto-approve.
  - Hybrid: percentage OR specific approver — whichever fires first.
"""

import logging

from django.db import transaction
from django.utils import timezone

from .models import ApprovalRequest, ApprovalRule, ApprovalStep

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def initiate_approval(expense):
    """
    Called right after an expense is created.
    Looks up the active approval rule for the submitter's company and
    creates the initial ApprovalRequest(s).
    """
    user = expense.submitted_by
    company = user.company

    # Find the active rule for this company
    rule = (
        ApprovalRule.objects
        .filter(company=company, is_active=True)
        .first()
    )

    if rule is None:
        # No approval rule configured → auto-approve
        logger.info(
            "No active approval rule for company %s — auto-approving expense %s",
            company.name, expense.id,
        )
        expense.status = "APPROVED"
        expense.save(update_fields=["status"])
        return

    with transaction.atomic():
        # Step 0: Manager-first approval if the user has is_manager_approver=True
        if user.is_manager_approver and user.manager:
            ApprovalRequest.objects.create(
                expense=expense,
                approver=user.manager,
                step=None,  # manager step is outside the rule chain
                status="PENDING",
            )
            logger.info(
                "Manager-first approval created: %s → %s",
                expense.id, user.manager.email,
            )
            # Don't create rule-based requests yet; they'll be created
            # once the manager approves (see process_approval).
            return

        # No manager-first — jump straight to rule-based initiation
        _initiate_rule_requests(expense, rule)


@transaction.atomic
def process_approval(approval_request, decision: str, comment: str = ""):
    """
    Called when an approver makes a decision on an ApprovalRequest.

    Args:
        approval_request: the ApprovalRequest being acted upon
        decision: "APPROVED" or "REJECTED"
        comment: optional text
    """
    approval_request.status = decision
    approval_request.comment = comment
    approval_request.acted_at = timezone.now()
    approval_request.save()

    expense = approval_request.expense
    rule = _get_active_rule(expense)

    # ── Rejection is always immediate ──
    if decision == "REJECTED":
        expense.status = "REJECTED"
        expense.save(update_fields=["status"])
        # Cancel any remaining pending requests
        _cancel_pending_requests(expense)
        logger.info("Expense %s REJECTED by %s", expense.id, approval_request.approver.email)
        return

    # ── Approval: check if this was a manager-first step ──
    if approval_request.step is None:
        # This was the manager pre-step. Now initiate rule-based requests.
        if rule is None:
            # No rule → manager approval was the only gate
            expense.status = "APPROVED"
            expense.save(update_fields=["status"])
        else:
            _initiate_rule_requests(expense, rule)
        logger.info(
            "Manager pre-approval done for expense %s — advancing to rule steps",
            expense.id,
        )
        return

    # ── Rule-based approval ──
    if rule is None:
        expense.status = "APPROVED"
        expense.save(update_fields=["status"])
        return

    if rule.rule_type == "SEQUENTIAL":
        _handle_sequential(expense, rule)
    elif rule.rule_type == "PERCENTAGE":
        _handle_percentage(expense, rule)
    elif rule.rule_type == "SPECIFIC":
        _handle_specific(expense, rule, approval_request)
    elif rule.rule_type == "HYBRID":
        _handle_hybrid(expense, rule, approval_request)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_active_rule(expense):
    """Fetch the active approval rule for the expense's company."""
    return (
        ApprovalRule.objects
        .filter(company=expense.submitted_by.company, is_active=True)
        .first()
    )


def _initiate_rule_requests(expense, rule):
    """Create the initial ApprovalRequest(s) based on rule_type."""
    if rule.rule_type == "SEQUENTIAL":
        # Only create a request for the first step
        first_step = rule.steps.order_by("step_order").first()
        if first_step:
            ApprovalRequest.objects.create(
                expense=expense,
                approver=first_step.approver,
                step=first_step,
                status="PENDING",
            )
        else:
            # No steps configured → auto-approve
            expense.status = "APPROVED"
            expense.save(update_fields=["status"])

    elif rule.rule_type in ("PERCENTAGE", "HYBRID"):
        # Create requests for ALL step-based approvers at once
        steps = rule.steps.order_by("step_order")
        if not steps.exists():
            expense.status = "APPROVED"
            expense.save(update_fields=["status"])
            return

        for step in steps:
            ApprovalRequest.objects.create(
                expense=expense,
                approver=step.approver,
                step=step,
                status="PENDING",
            )

        # For HYBRID, also consider the specific approver
        if rule.rule_type == "HYBRID" and rule.specific_approver:
            # Check if specific approver isn't already in the steps
            step_approver_ids = set(steps.values_list("approver_id", flat=True))
            if rule.specific_approver_id not in step_approver_ids:
                ApprovalRequest.objects.create(
                    expense=expense,
                    approver=rule.specific_approver,
                    step=None,
                    status="PENDING",
                )

    elif rule.rule_type == "SPECIFIC":
        if rule.specific_approver:
            ApprovalRequest.objects.create(
                expense=expense,
                approver=rule.specific_approver,
                step=None,
                status="PENDING",
            )
        else:
            # Misconfigured rule → auto-approve
            expense.status = "APPROVED"
            expense.save(update_fields=["status"])


def _handle_sequential(expense, rule):
    """Advance to the next step, or approve if all steps done."""
    # Find the last approved step's order
    last_approved = (
        ApprovalRequest.objects
        .filter(expense=expense, status="APPROVED", step__isnull=False)
        .select_related("step")
        .order_by("-step__step_order")
        .first()
    )

    current_order = last_approved.step.step_order if last_approved else 0

    next_step = (
        rule.steps
        .filter(step_order__gt=current_order)
        .order_by("step_order")
        .first()
    )

    if next_step:
        ApprovalRequest.objects.create(
            expense=expense,
            approver=next_step.approver,
            step=next_step,
            status="PENDING",
        )
        logger.info("Sequential: advancing to step %d for expense %s", next_step.step_order, expense.id)
    else:
        expense.status = "APPROVED"
        expense.save(update_fields=["status"])
        logger.info("Sequential: all steps approved for expense %s", expense.id)


def _handle_percentage(expense, rule):
    """Check if the percentage threshold is met."""
    total = ApprovalRequest.objects.filter(
        expense=expense, step__isnull=False
    ).count()

    approved = ApprovalRequest.objects.filter(
        expense=expense, step__isnull=False, status="APPROVED"
    ).count()

    if total > 0:
        pct = (approved / total) * 100
        if pct >= (rule.percentage_threshold or 0):
            expense.status = "APPROVED"
            expense.save(update_fields=["status"])
            _cancel_pending_requests(expense)
            logger.info(
                "Percentage: %.1f%% >= %d%% — expense %s APPROVED",
                pct, rule.percentage_threshold, expense.id,
            )


def _handle_specific(expense, rule, approval_request):
    """If the specific approver approved, auto-approve the expense."""
    if (
        rule.specific_approver
        and approval_request.approver_id == rule.specific_approver_id
    ):
        expense.status = "APPROVED"
        expense.save(update_fields=["status"])
        _cancel_pending_requests(expense)
        logger.info("Specific: approved by designated approver — expense %s APPROVED", expense.id)


def _handle_hybrid(expense, rule, approval_request):
    """Check percentage threshold OR specific approver."""
    # Check if specific approver triggered it
    if (
        rule.specific_approver
        and approval_request.approver_id == rule.specific_approver_id
    ):
        expense.status = "APPROVED"
        expense.save(update_fields=["status"])
        _cancel_pending_requests(expense)
        logger.info("Hybrid (specific): expense %s APPROVED", expense.id)
        return

    # Otherwise check percentage
    _handle_percentage(expense, rule)


def _cancel_pending_requests(expense):
    """Cancel all remaining PENDING requests for a resolved expense."""
    cancelled = (
        ApprovalRequest.objects
        .filter(expense=expense, status="PENDING")
        .update(status="REJECTED", acted_at=timezone.now(), comment="Auto-cancelled")
    )
    if cancelled:
        logger.info("Cancelled %d pending request(s) for expense %s", cancelled, expense.id)
