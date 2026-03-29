"""
Serializers for expense submission, listing, and detail views.
"""

from decimal import Decimal

from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from .models import Expense
from .utils import convert_currency


class ExpenseCreateSerializer(serializers.ModelSerializer):
    """
    Used when an employee submits a new expense.
    Auto-sets submitted_by from request user and converts currency.
    """

    class Meta:
        model = Expense
        fields = [
            "amount",
            "currency",
            "category",
            "description",
            "date",
            "receipt",
        ]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_currency(self, value):
        val = value.upper().strip()
        if len(val) != 3:
            raise serializers.ValidationError("Currency must be exactly 3 uppercase characters.")
        return val

    def validate_date(self, value):
        from datetime import date
        if value > date.today():
            raise serializers.ValidationError("Expense date cannot be in the future.")
        return value

    def validate_description(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError("Description must be at least 5 characters.")
        return value

    def validate_category(self, value):
        # Explicit check for safety
        valid_choices = dict(Expense.CATEGORY_CHOICES).keys()
        if value not in valid_choices:
            raise serializers.ValidationError("Invalid category.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        company_currency = user.company.currency

        # Convert to company currency
        amount = validated_data["amount"]
        expense_currency = validated_data["currency"]
        converted = convert_currency(amount, expense_currency, company_currency)

        if converted is None:
            # Fallback: store original amount if conversion API is down
            converted = amount

        expense = Expense.objects.create(
            submitted_by=user,
            amount_in_company_currency=converted,
            **validated_data,
        )

        return expense


class ExpenseListSerializer(serializers.ModelSerializer):
    """
    Compact representation for expense lists.
    Shows submitter name, status, and both currency amounts.
    """

    submitted_by_name = serializers.CharField(
        source="submitted_by.name", read_only=True
    )
    submitted_by_email = serializers.CharField(
        source="submitted_by.email", read_only=True
    )

    class Meta:
        model = Expense
        fields = [
            "id",
            "submitted_by",
            "submitted_by_name",
            "submitted_by_email",
            "amount",
            "currency",
            "amount_in_company_currency",
            "category",
            "description",
            "date",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class ExpenseDetailSerializer(serializers.ModelSerializer):
    """
    Full expense detail including approval trail.
    Used for the single-expense detail endpoint.
    """

    submitted_by = UserSerializer(read_only=True)
    approval_trail = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            "id",
            "submitted_by",
            "amount",
            "currency",
            "amount_in_company_currency",
            "category",
            "description",
            "date",
            "receipt",
            "status",
            "created_at",
            "approval_trail",
        ]
        read_only_fields = fields

    def get_approval_trail(self, obj):
        """Return the approval history for this expense."""
        from apps.approvals.serializers import ApprovalRequestSerializer

        requests = obj.approval_requests.select_related(
            "approver", "step"
        ).order_by("step__step_order", "acted_at")
        return ApprovalRequestSerializer(requests, many=True).data


class CurrencyConvertSerializer(serializers.Serializer):
    """Validate currency conversion query params."""

    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    from_currency = serializers.CharField(max_length=3)
    to_currency = serializers.CharField(max_length=3)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
