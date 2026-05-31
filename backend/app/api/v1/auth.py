"""
Authentication API endpoints.

Thin layer — validates request shape, calls auth_service,
formats the response. No business logic lives here.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.models.user import UserCreate, UserResponse
from app.services.auth_service import register_user, login_user
from app.core.dependencies import get_current_user_id
from fastapi import Depends
from app.db.mongodb import get_database

router = APIRouter()


class LoginRequest(BaseModel):
    """Request body for POST /auth/login."""
    email: str
    password: str


class TokenResponse(BaseModel):
    """Response body containing the JWT token."""
    access_token: str
    token_type: str = "bearer"


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(user_data: UserCreate) -> UserResponse:
    """
    Register a new user account.
    Returns the created user (without password hash).
    """
    try:
        return await register_user(user_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest) -> TokenResponse:
    """
    Authenticate and return a JWT access token.
    """
    try:
        token = await login_user(credentials.email, credentials.password)
        return TokenResponse(access_token=token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        ) from e