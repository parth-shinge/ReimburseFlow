import uuid
from django.db import models
from django.conf import settings

class ApprovalRule(models.Model):
    RULE_TYPE_CHOICES = (
        ('SEQUENTIAL', 'Sequential'),
        ('PERCENTAGE', 'Percentage'),
        ('SPECIFIC', 'Specific Approver'),
        ('HYBRID', 'Hybrid'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey('accounts.Company', on_delete=models.CASCADE, related_name='approval_rules')
    name = models.CharField(max_length=255)
    rule_type = models.CharField(max_length=20, choices=RULE_TYPE_CHOICES)
    percentage_threshold = models.IntegerField(null=True, blank=True)
    specific_approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='specific_rules')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.company.name})"

class ApprovalStep(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule = models.ForeignKey(ApprovalRule, on_delete=models.CASCADE, related_name='steps')
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='approval_steps')
    step_order = models.IntegerField()

    class Meta:
        ordering = ['step_order']
        # You might also want a unique_together = ('rule', 'step_order')

    def __str__(self):
        return f"Step {self.step_order} for {self.rule.name}"

class ApprovalRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey('expenses.Expense', on_delete=models.CASCADE, related_name='approval_requests')
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pending_approvals')
    step = models.ForeignKey(ApprovalStep, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    comment = models.TextField(null=True, blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Approval for Expense {self.expense.id} by {self.approver.email}"
