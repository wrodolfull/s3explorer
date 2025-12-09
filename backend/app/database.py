from supabase import create_client, Client
from .config import settings


def get_supabase_client() -> Client:
    """Cria e retorna o cliente Supabase"""
    return create_client(
        settings.supabase_url,
        settings.supabase_key
    )


def get_supabase_client_with_token(token: str) -> Client:
    """
    Cria e retorna o cliente Supabase com token JWT do usuário para RLS.
    Modifica o header do PostgREST para incluir o token do usuário.
    """
    client = create_client(
        settings.supabase_url,
        settings.supabase_key
    )
    
    # Modifica o header do PostgREST client para incluir o token do usuário
    # Isso permite que as políticas RLS funcionem corretamente
    if hasattr(client, 'postgrest') and hasattr(client.postgrest, 'session'):
        client.postgrest.session.headers.update({
            "Authorization": f"Bearer {token}"
        })
    
    return client


supabase = get_supabase_client()

