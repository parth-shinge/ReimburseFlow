"""
OCR utility for parsing receipt images.

Uses pytesseract to extract text from receipt images, then applies
regex-based heuristics to identify:
  - amount (largest monetary value)
  - date
  - merchant name (first non-numeric line)
  - description / category guess
"""

import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

from PIL import Image

logger = logging.getLogger(__name__)

try:
    import pytesseract
except ImportError:
    pytesseract = None
    logger.warning("pytesseract not installed — OCR functionality will be unavailable.")


def extract_text_from_image(image_file) -> str:
    """
    Run Tesseract OCR on an uploaded image file.
    Returns the raw extracted text.
    """
    if pytesseract is None:
        raise RuntimeError("pytesseract is not installed.")

    image = Image.open(image_file)

    # Convert to RGB if necessary (handles RGBA, P mode, etc.)
    if image.mode not in ("L", "RGB"):
        image = image.convert("RGB")

    text = pytesseract.image_to_string(image)
    return text.strip()


def parse_receipt_text(raw_text: str) -> dict:
    """
    Parse extracted receipt text into structured fields.

    Returns:
        {
            "amount": "123.45" or None,
            "date": "2026-03-15" or None,
            "merchant": "Store Name" or None,
            "description": "best guess" or None,
            "raw_text": "..."
        }
    """
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

    result = {
        "amount": None,
        "date": None,
        "merchant": None,
        "description": None,
        "raw_text": raw_text,
    }

    # ── Extract amounts ──
    # Match patterns like $12.34, 12.34, 1,234.56, ₹500.00, €99.99
    amount_pattern = re.compile(
        r"[$€£₹¥]?\s*(\d{1,3}(?:[,]\d{3})*(?:\.\d{2}))"
    )
    amounts = []
    for line in lines:
        for match in amount_pattern.finditer(line):
            try:
                val = Decimal(match.group(1).replace(",", ""))
                amounts.append(val)
            except (InvalidOperation, ValueError):
                continue

    if amounts:
        # Take the largest amount — usually the total
        result["amount"] = str(max(amounts))

    # ── Extract dates ──
    date_patterns = [
        # 2026-03-15, 2026/03/15
        (r"(\d{4}[-/]\d{2}[-/]\d{2})", "%Y-%m-%d"),
        # 03/15/2026, 03-15-2026
        (r"(\d{2}[-/]\d{2}[-/]\d{4})", "%m-%d-%Y"),
        # 15 Mar 2026, 15 March 2026
        (r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})", "%d %b %Y"),
    ]

    for pattern, fmt in date_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            date_str = match.group(1).replace("/", "-")
            try:
                parsed = datetime.strptime(date_str, fmt.replace("/", "-"))
                result["date"] = parsed.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue

    # ── Extract merchant ──
    # Heuristic: the first line that isn't a date or amount is likely the merchant
    for line in lines[:5]:  # check first 5 lines
        if amount_pattern.search(line):
            continue
        if re.search(r"\d{4}[-/]\d{2}[-/]\d{2}", line):
            continue
        if len(line) > 2:
            result["merchant"] = line
            break

    # ── Description — guess category from keywords ──
    text_lower = raw_text.lower()
    category_keywords = {
        "FOOD": ["restaurant", "cafe", "coffee", "food", "dining", "pizza", "burger", "lunch", "dinner", "breakfast"],
        "TRAVEL": ["taxi", "uber", "lyft", "flight", "airline", "hotel", "travel", "fuel", "gas", "petrol"],
        "EQUIPMENT": ["electronics", "computer", "laptop", "phone", "hardware", "software", "office supplies"],
        "ACCOMMODATION": ["hotel", "motel", "airbnb", "lodging", "stay", "inn"],
    }

    for category, keywords in category_keywords.items():
        if any(kw in text_lower for kw in keywords):
            result["description"] = category
            break

    if result["description"] is None:
        result["description"] = "OTHER"

    return result


def scan_receipt(image_file) -> dict:
    """
    Full pipeline: OCR extract → parse → structured result.
    """
    raw_text = extract_text_from_image(image_file)
    parsed = parse_receipt_text(raw_text)
    return parsed
