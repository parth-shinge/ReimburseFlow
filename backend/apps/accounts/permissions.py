"""
Custom permission classes for role-based access control.

Roles: ADMIN, MANAGER, EMPLOYEE
"""

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Allows access only to users with the ADMIN role.
    """

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "ADMIN"
        )


class IsManagerOrAdmin(BasePermission):
    """
    Allows access to users with MANAGER or ADMIN role.
    """

    message = "Only managers and administrators can perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("ADMIN", "MANAGER")
        )


class IsAuthenticatedEmployee(BasePermission):
    """
    Allows access to any authenticated user (ADMIN, MANAGER, or EMPLOYEE).
    Essentially the same as IsAuthenticated but also verifies the user
    has a valid role assigned.
    """

    message = "You must be an authenticated employee to perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("ADMIN", "MANAGER", "EMPLOYEE")
        )
