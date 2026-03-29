import uuid
from django.db import models
from django.conf import settings

class Expense(models.Model):
    CATEGORY_CHOICES = (
        ('TRAVEL', 'Travel'),
        ('FOOD', 'Food'),
        ('ACCOMMODATION', 'Accommodation'),
        ('EQUIPMENT', 'Equipment'),
        ('OTHER', 'Other'),
    )
    
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    amount_in_company_currency = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.TextField()
    date = models.DateField()
    receipt = models.ImageField(upload_to='receipts/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.category} - {self.amount} {self.currency} by {self.submitted_by.email}"
