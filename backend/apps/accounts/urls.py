"""
URL routes for the accounts app.

These are mounted at /api/auth/ and /api/users/ in the root urlconf.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Auth — public
    path("auth/signup/", views.SignupView.as_view(), name="auth-signup"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),

    # User management — admin only
    path("users/", views.UserListCreateView.as_view(), name="user-list-create"),
    path("users/<uuid:pk>/", views.UserDetailView.as_view(), name="user-detail"),
]
