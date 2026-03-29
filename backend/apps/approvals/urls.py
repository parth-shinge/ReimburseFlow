"""
URL routes for the approvals app.

Mounted at /api/ in the root urlconf.
"""

from django.urls import path

from . import views

urlpatterns = [
    # Approvals — manager / admin
    path("approvals/pending/", views.PendingApprovalsView.as_view(), name="approvals-pending"),
    path("approvals/<uuid:pk>/decide/", views.ApprovalDecisionView.as_view(), name="approval-decide"),

    # Rules — admin only
    path("rules/", views.ApprovalRuleListCreateView.as_view(), name="rule-list-create"),
    path("rules/<uuid:pk>/", views.ApprovalRuleDetailView.as_view(), name="rule-detail"),
]
