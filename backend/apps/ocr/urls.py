"""
URL routes for the OCR app.

Mounted at /api/ in the root urlconf.
"""

from django.urls import path

from . import views

urlpatterns = [
    path("ocr/scan/", views.ReceiptScanView.as_view(), name="ocr-scan"),
]
