from django.contrib import admin

from .models import Company, User


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "currency", "created_at")
    search_fields = ("name", "country")
    readonly_fields = ("id", "created_at")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "role", "company", "is_active")
    list_filter = ("role", "is_active", "company")
    search_fields = ("email", "name")
    readonly_fields = ("id",)
    ordering = ("email",)
