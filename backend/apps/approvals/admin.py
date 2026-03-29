from django.contrib import admin

from .models import ApprovalRequest, ApprovalRule, ApprovalStep


class ApprovalStepInline(admin.TabularInline):
    model = ApprovalStep
    extra = 1
    ordering = ("step_order",)


@admin.register(ApprovalRule)
class ApprovalRuleAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "rule_type", "is_active", "percentage_threshold")
    list_filter = ("rule_type", "is_active")
    search_fields = ("name", "company__name")
    inlines = [ApprovalStepInline]
    readonly_fields = ("id",)


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "expense", "approver", "status", "acted_at")
    list_filter = ("status",)
    search_fields = ("approver__email", "expense__id")
    readonly_fields = ("id",)
    ordering = ("-acted_at",)
