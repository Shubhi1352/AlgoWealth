"""
FastAPI dependency injection functions.

Dependencies are reusable functions FastAPI calls automatically
before your endpoint runs. Think of them as middleware for
individual routes — they handle auth, DB access, validation
so your endpoint functions stay clean and focused.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.db.mongodb import get_database

# Extracts the Bearer token from the Authorization header automatically
_bearer_scheme = HTTPBearer()

def get_db():
    """
    FastAPI dependency that returns the MongoDB database instance.
    Injected into any route that needs direct DB access.
    """
    return get_database()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> str:
    """
    FastAPI dependency — extracts and validates the JWT from the request header.

    Usage in any protected endpoint:
        @router.get("/portfolio")
        async def get_portfolio(user_id: str = Depends(get_current_user_id)):
            ...

    Returns:
        The authenticated user's ID string.

    Raises:
        HTTPException 401: If token is missing, invalid, or expired.
    """
    try:
        user_id = decode_access_token(credentials.credentials)
        return user_id
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e