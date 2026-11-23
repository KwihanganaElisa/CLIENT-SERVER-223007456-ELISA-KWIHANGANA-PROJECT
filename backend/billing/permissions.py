from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    message = "This action requires the owner role."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "owner"
        )

