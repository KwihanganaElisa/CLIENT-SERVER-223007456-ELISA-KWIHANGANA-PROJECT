import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

from rest_framework import authentication, exceptions


@dataclass
class SupabaseUser:
    """Small request.user implementation backed by a verified Supabase user."""

    id: str
    email: str
    role: str | None
    claims: dict

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


class SupabaseAuthentication(authentication.BaseAuthentication):
    """Verify access tokens with Supabase Auth and expose the user to DRF."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header:
            return None

        if len(header) != 2 or header[0].decode("utf-8").lower() != "bearer":
            raise exceptions.AuthenticationFailed("Invalid Authorization header.")

        try:
            token = header[1].decode("utf-8")
        except UnicodeDecodeError as exc:
            raise exceptions.AuthenticationFailed("Invalid access token.") from exc

        user_data = self._fetch_user(token)
        app_metadata = user_data.get("app_metadata") or {}
        role = app_metadata.get("role")

        # Optional bootstrap for small/single-owner deployments. App metadata is
        # still preferred because users cannot edit it themselves.
        if not role:
            owner_emails = {
                email.strip().lower()
                for email in os.getenv("SUPABASE_OWNER_EMAILS", "").split(",")
                if email.strip()
            }
            if (user_data.get("email") or "").lower() in owner_emails:
                role = "owner"

        user = SupabaseUser(
            id=user_data["id"],
            email=user_data.get("email", ""),
            role=role,
            claims=user_data,
        )
        return user, token

    def authenticate_header(self, request):
        return self.keyword

    @staticmethod
    def _fetch_user(token):
        supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        supabase_key = os.getenv("SUPABASE_ANON_KEY", "")
        if not supabase_url or not supabase_key:
            raise exceptions.AuthenticationFailed(
                "Supabase authentication is not configured on the API."
            )

        auth_request = urllib.request.Request(
            f"{supabase_url}/auth/v1/user",
            headers={
                "apikey": supabase_key,
                "Authorization": f"Bearer {token}",
            },
        )

        try:
            with urllib.request.urlopen(auth_request, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                raise exceptions.AuthenticationFailed(
                    "The access token is invalid or expired."
                ) from exc
            raise exceptions.AuthenticationFailed(
                "Supabase could not verify the access token."
            ) from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise exceptions.AuthenticationFailed(
                "The authentication service is unavailable."
            ) from exc

