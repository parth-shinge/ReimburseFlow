"""
Root URL configuration for the Reimbursement Management System.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    # Accounts: auth + user management
    path("api/", include("apps.accounts.urls")),
    # Expenses + currency utilities
    path("api/", include("apps.expenses.urls")),
    # Approvals + rule management
    path("api/", include("apps.approvals.urls")),
    # OCR receipt scanning
    path("api/", include("apps.ocr.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
