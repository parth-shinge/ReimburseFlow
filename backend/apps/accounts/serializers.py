"""
Serializers for authentication, user management, and signup flows.
"""

from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Company, User


# ---------------------------------------------------------------------------
# Signup — creates Company + Admin user in one transaction
# ---------------------------------------------------------------------------
class SignupSerializer(serializers.Serializer):
    """
    Accepts company + user details, creates both in a transaction,
    and returns the created user instance.
    """

    # User fields
    email = serializers.EmailField()
    name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)

    # Company fields
    company_name = serializers.CharField(max_length=255)
    country = serializers.CharField(max_length=100)
    currency = serializers.CharField(max_length=3)

    def validate_email(self, value):
        from django.core.validators import validate_email as django_validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        email = value.lower().strip()
        try:
            django_validate_email(email)
        except DjangoValidationError:
            raise serializers.ValidationError("Enter a valid email address.")
            
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_password(self, value):
        if len(value) < 8 or not any(char.isdigit() for char in value):
            raise serializers.ValidationError("Password must be at least 8 characters and contain at least one number.")
        return value

    def validate_currency(self, value):
        val = value.upper().strip()
        if len(val) != 3:
            raise serializers.ValidationError("Currency must be exactly 3 uppercase characters.")
        return val

    @transaction.atomic
    def create(self, validated_data):
        # 1. Create the Company
        company = Company.objects.create(
            name=validated_data["company_name"],
            country=validated_data["country"],
            currency=validated_data["currency"],
        )

        # 2. Create the Admin user linked to that company
        user = User.objects.create_user(
            email=validated_data["email"],
            name=validated_data["name"],
            password=validated_data["password"],
            role="ADMIN",
            company=company,
        )

        return user


# ---------------------------------------------------------------------------
# Login — validates credentials, hands back JWT tokens
# ---------------------------------------------------------------------------
class LoginSerializer(serializers.Serializer):
    """
    Accepts email + password, authenticates, and returns
    JWT access + refresh tokens alongside user info.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].lower().strip()
        password = attrs["password"]

        # Check the user exists first to give a useful message
        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {"email": "No account found with this email address."}
            )

        if not user_obj.is_active:
            raise serializers.ValidationError(
                {"email": "This account has been deactivated."}
            )

        # Authenticate using Django's backend
        user = authenticate(
            request=self.context.get("request"),
            email=email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                {"password": "Incorrect password. Please try again."}
            )

        # Generate JWT token pair
        refresh = RefreshToken.for_user(user)

        return {
            "user": user,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }


# ---------------------------------------------------------------------------
# User detail — read-only representation
# ---------------------------------------------------------------------------
class CompanySerializer(serializers.ModelSerializer):
    """Compact company representation for nested use."""

    class Meta:
        model = Company
        fields = ["id", "name", "country", "currency"]
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    """Full user detail — used for responses and user lists."""

    company = CompanySerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "role",
            "company",
            "manager",
            "is_manager_approver",
            "is_active",
        ]
        read_only_fields = ["id", "email", "company"]


# ---------------------------------------------------------------------------
# Create User — Admin creates employees / managers
# ---------------------------------------------------------------------------
class CreateUserSerializer(serializers.ModelSerializer):
    """
    Admin-only serializer for creating employees and managers
    within the admin's own company. A random password is generated
    and should be communicated out-of-band (or a password-reset
    flow used).
    """

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "email",
            "name",
            "role",
            "password",
            "manager",
            "is_manager_approver",
        ]

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return email

    def validate_role(self, value):
        """Admins can only create MANAGER or EMPLOYEE users, not other admins."""
        if value not in ("MANAGER", "EMPLOYEE"):
            raise serializers.ValidationError(
                "You can only create users with role MANAGER or EMPLOYEE."
            )
        return value

    def validate_manager(self, value):
        """
        If a manager is specified, ensure they belong to the same company
        and have an appropriate role.
        """
        if value is None:
            return value

        requesting_user = self.context["request"].user

        if value.company_id != requesting_user.company_id:
            raise serializers.ValidationError(
                "The selected manager does not belong to your company."
            )

        if value.role not in ("ADMIN", "MANAGER"):
            raise serializers.ValidationError(
                "The selected manager must have a MANAGER or ADMIN role."
            )

        return value

    @transaction.atomic
    def create(self, validated_data):
        requesting_user = self.context["request"].user

        user = User.objects.create_user(
            email=validated_data["email"],
            name=validated_data["name"],
            password=validated_data["password"],
            role=validated_data["role"],
            company=requesting_user.company,
            manager=validated_data.get("manager"),
            is_manager_approver=validated_data.get("is_manager_approver", False),
        )

        return user
