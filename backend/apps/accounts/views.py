"""
Views for authentication and user management.

Endpoints:
    POST /api/auth/signup/     — public signup (creates company + admin)
    POST /api/auth/login/      — public login  (returns JWT pair)
    GET  /api/users/           — admin: list company users
    POST /api/users/           — admin: create employee/manager
    GET  /api/users/<uuid>/    — admin: retrieve user detail
    PATCH/PUT /api/users/<uuid>/ — admin: update user
"""

import logging

from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .permissions import IsAdmin
from .serializers import (
    CreateUserSerializer,
    LoginSerializer,
    SignupSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------
class SignupView(generics.CreateAPIView):
    """
    Public endpoint.
    Creates a new Company and an Admin user in one atomic transaction.
    Returns JWT tokens + user data so the user is immediately logged in.
    """

    serializer_class = SignupSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # skip JWT check for this endpoint

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens for immediate login
        refresh = RefreshToken.for_user(user)
        tokens = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

        return Response(
            {
                "message": "Account created successfully.",
                "user": UserSerializer(user).data,
                # Flat tokens for direct destructuring in frontend
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                # Also keep nested format for backward compat
                "tokens": tokens,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
class LoginView(APIView):
    """
    Public endpoint.
    Validates email + password and returns a JWT access/refresh pair.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_data = UserSerializer(data["user"]).data
        tokens = data["tokens"]

        return Response(
            {
                "message": "Login successful.",
                "user": user_data,
                # Flat tokens for direct destructuring in frontend
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                # Also keep nested format for backward compat
                "tokens": tokens,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# User List + Create (Admin only)
# ---------------------------------------------------------------------------
class UserListCreateView(generics.ListCreateAPIView):
    """
    Admin-only endpoint.
    GET  — list all users in the admin's company.
    POST — create a new employee or manager in the admin's company.
    """

    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateUserSerializer
        return UserSerializer

    def get_queryset(self):
        """Scope results to the requesting admin's company."""
        return (
            User.objects.filter(company=self.request.user.company)
            .select_related("company", "manager")
            .order_by("name")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "message": "User created successfully.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# User Detail (Admin only)
# ---------------------------------------------------------------------------
class UserDetailView(generics.RetrieveUpdateAPIView):
    """
    Admin-only endpoint.
    GET   — retrieve a specific user's details.
    PATCH — update role, manager assignment, or is_manager_approver.
    """

    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    lookup_field = "pk"

    def get_queryset(self):
        """Scope to the requesting admin's company."""
        return (
            User.objects.filter(company=self.request.user.company)
            .select_related("company", "manager")
        )

    def update(self, request, *args, **kwargs):
        """
        Allow partial updates. Restrict which fields can be changed:
        role, manager, is_manager_approver, name, is_active.
        """
        partial = kwargs.pop("partial", True)  # always partial
        instance = self.get_object()

        # Only allow updating specific fields
        allowed_fields = {"role", "manager", "is_manager_approver", "name", "is_active"}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        # Prevent demoting yourself
        if (
            str(instance.pk) == str(request.user.pk)
            and "role" in data
            and data["role"] != "ADMIN"
        ):
            return Response(
                {"error": "You cannot change your own admin role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "message": "User updated successfully.",
                "user": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
