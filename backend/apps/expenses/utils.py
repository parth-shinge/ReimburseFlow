"""
Currency conversion utility.

Fetches live exchange rates from exchangerate-api.com and converts amounts
between currencies.
"""

import logging
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache

import requests

logger = logging.getLogger(__name__)

EXCHANGE_RATE_API_URL = "https://api.exchangerate-api.com/v4/latest/{base}"
COUNTRIES_API_URL = "https://restcountries.com/v3.1/all?fields=name,currencies"

# Cache rates for 10 minutes max (LRU won't expire, but keeps memory bounded)
_RATE_CACHE_MAX = 64


@lru_cache(maxsize=_RATE_CACHE_MAX)
def _fetch_rates(base_currency: str) -> dict:
    """Fetch exchange rates for a base currency. Cached per base."""
    url = EXCHANGE_RATE_API_URL.format(base=base_currency.upper())
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data.get("rates", {})
    except requests.RequestException as exc:
        logger.error("Failed to fetch exchange rates for %s: %s", base_currency, exc)
        return {}


def convert_currency(
    amount: Decimal,
    from_currency: str,
    to_currency: str,
) -> Decimal | None:
    """
    Convert `amount` from `from_currency` to `to_currency` using live rates.

    Returns the converted amount rounded to 2 decimal places, or None if
    the conversion could not be performed.
    """
    from_currency = from_currency.upper().strip()
    to_currency = to_currency.upper().strip()

    if from_currency == to_currency:
        return amount

    rates = _fetch_rates(from_currency)
    if not rates:
        return None

    target_rate = rates.get(to_currency)
    if target_rate is None:
        logger.warning("No rate found for %s → %s", from_currency, to_currency)
        return None

    converted = amount * Decimal(str(target_rate))
    return converted.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_country_currency_list() -> list[dict]:
    """
    Fetch the full country → currency mapping from restcountries.com.
    Returns a list of {name, currencies: [{code, name}]}.
    """
    try:
        resp = requests.get(COUNTRIES_API_URL, timeout=10)
        resp.raise_for_status()
        raw = resp.json()

        results = []
        for entry in raw:
            country_name = entry.get("name", {}).get("common", "Unknown")
            currencies_obj = entry.get("currencies", {})
            currencies = [
                {"code": code, "name": info.get("name", "")}
                for code, info in currencies_obj.items()
            ]
            if currencies:
                results.append({
                    "country": country_name,
                    "currencies": currencies,
                })

        results.sort(key=lambda x: x["country"])
        return results

    except requests.RequestException as exc:
        logger.error("Failed to fetch country/currency list: %s", exc)
        return []


def invalidate_rate_cache():
    """Clear the exchange rate cache (useful after tests or on schedule)."""
    _fetch_rates.cache_clear()
