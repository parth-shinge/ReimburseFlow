"""
Serializers for approval rules, steps, and approval requests.
"""

from rest_framework import serializers

from .models import ApprovalRequest, ApprovalRule, ApprovalStep


# ---------------------------------------------------------------------------
# Approval Request (used in expense detail trail)
# ---------------------------------------------------------------------------
class ApprovalRequestSerializer(serializers.ModelSerializer):
    """Read-only representation of a single approval action."""

    approver_name = serializers.CharField(source="approver.name", read_only=True)
    approver_email = serializers.CharField(source="approver.email", read_only=True)
    step_order = serializers.IntegerField(source="step.step_order", read_only=True, default=None)

    class Meta:
        model = ApprovalRequest
        fields = [
            "id",
            "approver",
            "approver_name",
            "approver_email",
            "step_order",
            "status",
            "comment",
            "acted_at",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Approval Decision (input)
# ---------------------------------------------------------------------------
class ApprovalDecisionSerializer(serializers.Serializer):
    """
    Input serializer for approving / rejecting an expense.
    """

    decision = serializers.ChoiceField(choices=["APPROVED", "REJECTED"])
    comment = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_decision(self, value):
        if value not in ["APPROVED", "REJECTED"]:
            raise serializers.ValidationError("Decision must be exactly 'APPROVED' or 'REJECTED'.")
        return value

    def validate(self, attrs):
        decision = attrs.get('decision')
        comment = attrs.get('comment', '').strip()
        
        if decision == "REJECTED" and not comment:
            raise serializers.ValidationError({"comment": "Comment is required when rejecting."})
            
        return attrs


# ---------------------------------------------------------------------------
# Approval Step (nested inside rule)
# ---------------------------------------------------------------------------
class ApprovalStepSerializer(serializers.ModelSerializer):
    """Step within an approval rule."""

    approver_name = serializers.CharField(source="approver.name", read_only=True)
    approver_email = serializers.CharField(source="approver.email", read_only=True)

    class Meta:
        model = ApprovalStep
        fields = ["id", "approver", "approver_name", "approver_email", "step_order"]


class ApprovalStepCreateSerializer(serializers.ModelSerializer):
    """Create a step — used when building / updating rules."""

    class Meta:
        model = ApprovalStep
        fields = ["approver", "step_order"]


# ---------------------------------------------------------------------------
# Approval Rule
# ---------------------------------------------------------------------------
class ApprovalRuleSerializer(serializers.ModelSerializer):
    """Read representation with nested steps."""

    steps = ApprovalStepSerializer(many=True, read_only=True)
    specific_approver_name = serializers.CharField(
        source="specific_approver.name", read_only=True, default=None
    )

    class Meta:
        model = ApprovalRule
        fields = [
            "id",
            "name",
            "rule_type",
            "percentage_threshold",
            "specific_approver",
            "specific_approver_name",
            "is_active",
            "steps",
        ]
        read_only_fields = ["id"]


class ApprovalRuleCreateSerializer(serializers.ModelSerializer):
    """
    Create / update an approval rule with nested steps.

    Expects:
    {
        "name": "Default Sequential Rule",
        "rule_type": "SEQUENTIAL",
        "percentage_threshold": null,
        "specific_approver": null,
        "is_active": true,
        "steps": [
            {"approver": "<uuid>", "step_order": 1},
            {"approver": "<uuid>", "step_order": 2}
        ]
    }
    """

    steps = ApprovalStepCreateSerializer(many=True, required=False)

    class Meta:
        model = ApprovalRule
        fields = [
            "name",
            "rule_type",
            "percentage_threshold",
            "specific_approver",
            "is_active",
            "steps",
        ]

    def validate(self, attrs):
        rule_type = attrs.get("rule_type")
        steps = attrs.get("steps", [])

        if rule_type == "SEQUENTIAL" and not steps:
            raise serializers.ValidationError(
                {"steps": "Sequential rules require at least one approval step."}
            )

        if rule_type == "PERCENTAGE":
            threshold = attrs.get("percentage_threshold")
            if threshold is None or threshold <= 0 or threshold > 100:
                raise serializers.ValidationError(
                    {"percentage_threshold": "Percentage rules require a threshold between 1 and 100."}
                )
            if not steps:
                raise serializers.ValidationError(
                    {"steps": "Percentage rules require at least one approver step."}
                )

        if rule_type == "SPECIFIC":
            if not attrs.get("specific_approver"):
                raise serializers.ValidationError(
                    {"specific_approver": "Specific rules require a designated approver."}
                )

        if rule_type == "HYBRID":
            if not attrs.get("specific_approver"):
                raise serializers.ValidationError(
                    {"specific_approver": "Hybrid rules require a specific approver."}
                )
            threshold = attrs.get("percentage_threshold")
            if threshold is None or threshold <= 0 or threshold > 100:
                raise serializers.ValidationError(
                    {"percentage_threshold": "Hybrid rules require a percentage threshold."}
                )

        return attrs

    def validate_specific_approver(self, value):
        """Ensure the specific approver belongs to the same company."""
        if value is None:
            return value

        request = self.context.get("request")
        if request and value.company_id != request.user.company_id:
            raise serializers.ValidationError(
                "The specific approver must belong to your company."
            )
        return value

    def create(self, validated_data):
        steps_data = validated_data.pop("steps", [])
        request = self.context["request"]

        rule = ApprovalRule.objects.create(
            company=request.user.company,
            **validated_data,
        )

        for step_data in steps_data:
            ApprovalStep.objects.create(rule=rule, **step_data)

        return rule

    def update(self, instance, validated_data):
        steps_data = validated_data.pop("steps", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace steps if provided
        if steps_data is not None:
            instance.steps.all().delete()
            for step_data in steps_data:
                ApprovalStep.objects.create(rule=instance, **step_data)

        return instance
