"""
Views for OCR receipt scanning.

Endpoint:
    POST /api/ocr/scan/ — upload receipt image → returns parsed fields
"""

import logging

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .utils import scan_receipt

logger = logging.getLogger(__name__)


class ReceiptScanView(APIView):
    """
    POST /api/ocr/scan/

    Upload a receipt image (multipart form data, field name: "receipt").
    Returns parsed fields: amount, date, merchant, description, raw_text.

    On OCR failure, returns 200 with an error message so the frontend
    can gracefully fall back to manual entry.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        receipt_file = request.FILES.get("receipt")

        if not receipt_file:
            return Response(
                {"error": "No receipt image provided. Upload with field name 'receipt'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file type
        allowed_types = [
            "image/jpeg", "image/png", "image/gif",
            "image/bmp", "image/webp", "image/tiff",
        ]
        if receipt_file.content_type not in allowed_types:
            return Response(
                {"error": f"Unsupported image type: {receipt_file.content_type}. Upload a JPG, PNG, GIF, or BMP image."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 10 MB size limit
        max_size = 10 * 1024 * 1024
        if receipt_file.size > max_size:
            return Response(
                {"error": "File too large. Maximum size is 10 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = scan_receipt(receipt_file)
        except Exception as exc:
            logger.exception("OCR processing error: %s", exc)
            # Return 200 with error so frontend handles gracefully
            return Response(
                {
                    "error": "Could not extract data from receipt. Please fill in manually.",
                    "parsed": {
                        "amount": None,
                        "currency": None,
                        "date": None,
                        "description": None,
                        "category": None,
                        "merchant_name": None,
                    },
                },
                status=status.HTTP_200_OK,
            )

        # If OCR returned empty/null results, still return 200
        if not result or (not result.get("amount") and not result.get("date") and not result.get("merchant")):
            return Response(
                {
                    "error": "Could not extract data from receipt. Please fill in manually.",
                    "parsed": result or {
                        "amount": None,
                        "currency": None,
                        "date": None,
                        "description": None,
                        "category": None,
                        "merchant_name": None,
                    },
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "message": "Receipt scanned successfully.",
                "parsed": {
                    "amount": result.get("amount"),
                    "currency": result.get("currency"),
                    "date": result.get("date"),
                    "description": result.get("description"),
                    "category": result.get("description"),  # category guess from OCR
                    "merchant_name": result.get("merchant"),
                },
            },
            status=status.HTTP_200_OK,
        )
