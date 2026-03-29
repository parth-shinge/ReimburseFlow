from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("id", "submitted_by", "amount", "currency", "category", "status", "date", "created_at")
    list_filter = ("status", "category", "currency")
    search_fields = ("submitted_by__email", "submitted_by__name", "description")
    readonly_fields = ("id", "created_at", "amount_in_company_currency")
    ordering = ("-created_at",)
