"""
URL routes for the expenses app.

Mounted at /api/ in the root urlconf.
"""

from django.urls import path

from . import views

urlpatterns = [
    # Expenses
    path("expenses/", views.ExpenseListCreateView.as_view(), name="expense-list-create"),
    path("expenses/stats/", views.ExpenseDashboardStatsView.as_view(), name="expense-dashboard-stats"),
    path("expenses/<uuid:pk>/", views.ExpenseDetailView.as_view(), name="expense-detail"),

    # Utility — currency / country
    path("countries/", views.CountryListView.as_view(), name="country-list"),
    path("currency/convert/", views.CurrencyConvertView.as_view(), name="currency-convert"),
]
