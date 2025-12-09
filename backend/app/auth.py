from fastapi import HTTPException, Header, Depends
from supabase import Client
from .database import supabase
from typing import Tuple


async def get_current_user(
    authorization: str = Header(None)
) -> Tuple[str, str]:
    """
    Valida o JWT do Supabase e retorna o user_id
    
    Args:
        authorization: Header Authorization com Bearer token
        
    Returns:
        user_id: UUID do usuário autenticado
        
    Raises:
        HTTPException: Se o token estiver ausente ou inválido
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization header"
        )
    
    # Remove "Bearer " do token
    token = authorization.replace("Bearer ", "").strip()
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing token"
        )
    
    try:
        # Valida o token com Supabase
        response = supabase.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )
        return (str(response.user.id), token)
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )

