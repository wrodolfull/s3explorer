from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import datetime, date
import io
from supabase import Client

from .auth import get_current_user
from .database import supabase, get_supabase_client_with_token
from .s3 import (
    create_s3_client,
    list_bucket_files,
    upload_file_to_s3,
    download_file_from_s3,
    delete_file_from_s3,
    get_file_url
)
from .file_parser import parse_call_file_name, is_call_file
from .schemas import (
    BucketCreate,
    BucketUpdate,
    BucketResponse,
    BucketDeleteResponse,
    FileListResponse,
    FileUploadResponse,
    FileDeleteResponse,
    LogResponse,
    LogListResponse
)
from .config import settings

app = FastAPI(
    title="S3 Explorer API",
    description="API para gerenciar buckets S3 com autenticação Supabase",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar domínios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def log_action(
    user_supabase: Client,
    user_id: str,
    action_type: str,
    bucket_id: str,
    file_key: str
):
    """
    Registra uma ação (download ou delete) no log
    """
    try:
        log_data = {
            "user_id": user_id,
            "action_type": action_type,
            "bucket_id": bucket_id,
            "file_key": file_key
        }
        user_supabase.table("acoes_logs").insert(log_data).execute()
    except Exception as e:
        # Não falha a requisição se o log falhar, apenas registra o erro
        print(f"Erro ao registrar log: {str(e)}")


@app.get("/")
async def root():
    """Endpoint raiz"""
    return {"message": "S3 Explorer API", "version": "1.0.0"}


@app.post(f"{settings.api_v1_prefix}/buckets", response_model=BucketResponse)
async def create_bucket(
    bucket: BucketCreate,
    user_data: tuple = Depends(get_current_user)
):
    """
    Cria um novo bucket para o usuário
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Verifica se já existe um bucket com o mesmo nome para o usuário
        existing = user_supabase.table("clientes_buckets").select("*").eq(
            "user_id", user_id
        ).eq("bucket_name", bucket.bucket_name).execute()
        
        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail="Já existe um bucket com este nome")
        
        bucket_data = {
            "user_id": user_id,
            "name": bucket.name,
            "bucket_name": bucket.bucket_name,
            "aws_access_key": bucket.aws_access_key,
            "aws_secret_key": bucket.aws_secret_key,
            "region": bucket.region,
            "active": bucket.active
        }
        
        # Cria novo bucket
        result = user_supabase.table("clientes_buckets").insert(bucket_data).execute()
        bucket_id = result.data[0]["id"]
        
        return BucketResponse(
            id=bucket_id,
            user_id=user_id,
            name=bucket.name,
            bucket_name=bucket.bucket_name,
            region=bucket.region,
            active=bucket.active,
            created_at=result.data[0].get("created_at"),
            updated_at=result.data[0].get("updated_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(f"{settings.api_v1_prefix}/buckets", response_model=List[BucketResponse])
async def list_buckets(
    user_data: tuple = Depends(get_current_user)
):
    """
    Lista todos os buckets do usuário
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        result = user_supabase.table("clientes_buckets").select("*").execute()
        
        buckets = []
        for bucket in result.data:
            buckets.append(BucketResponse(
                id=bucket["id"],
                user_id=bucket["user_id"],
                name=bucket["name"],
                bucket_name=bucket["bucket_name"],
                region=bucket["region"],
                active=bucket.get("active", True),
                created_at=bucket.get("created_at"),
                updated_at=bucket.get("updated_at")
            ))
        
        return buckets
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}", response_model=BucketResponse)
async def get_bucket(
    bucket_id: str,
    user_data: tuple = Depends(get_current_user)
):
    """
    Busca um bucket específico por ID
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        bucket = result.data
        return BucketResponse(
            id=bucket["id"],
            user_id=bucket["user_id"],
            name=bucket["name"],
            bucket_name=bucket["bucket_name"],
            region=bucket["region"],
            active=bucket.get("active", True),
            created_at=bucket.get("created_at"),
            updated_at=bucket.get("updated_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}", response_model=BucketResponse)
async def update_bucket(
    bucket_id: str,
    bucket_update: BucketUpdate,
    user_data: tuple = Depends(get_current_user)
):
    """
    Atualiza um bucket existente
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Verifica se o bucket existe e pertence ao usuário
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        # Prepara dados para atualização (apenas campos fornecidos)
        update_data = {}
        if bucket_update.name is not None:
            update_data["name"] = bucket_update.name
        if bucket_update.bucket_name is not None:
            # Verifica se o novo nome não está em uso por outro bucket
            if bucket_update.bucket_name != bucket_result.data["bucket_name"]:
                existing = user_supabase.table("clientes_buckets").select("*").eq(
                    "user_id", user_id
                ).eq("bucket_name", bucket_update.bucket_name).execute()
                if existing.data and len(existing.data) > 0:
                    raise HTTPException(status_code=400, detail="Já existe um bucket com este nome")
            update_data["bucket_name"] = bucket_update.bucket_name
        if bucket_update.aws_access_key is not None:
            update_data["aws_access_key"] = bucket_update.aws_access_key
        if bucket_update.aws_secret_key is not None:
            update_data["aws_secret_key"] = bucket_update.aws_secret_key
        if bucket_update.region is not None:
            update_data["region"] = bucket_update.region
        if bucket_update.active is not None:
            update_data["active"] = bucket_update.active
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Nenhum campo fornecido para atualização")
        
        # Atualiza o bucket
        result = user_supabase.table("clientes_buckets").update(update_data).eq(
            "id", bucket_id
        ).execute()
        
        updated_bucket = result.data[0]
        return BucketResponse(
            id=updated_bucket["id"],
            user_id=updated_bucket["user_id"],
            name=updated_bucket["name"],
            bucket_name=updated_bucket["bucket_name"],
            region=updated_bucket["region"],
            active=updated_bucket.get("active", True),
            created_at=updated_bucket.get("created_at"),
            updated_at=updated_bucket.get("updated_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}/toggle-active", response_model=BucketResponse)
async def toggle_bucket_active(
    bucket_id: str,
    user_data: tuple = Depends(get_current_user)
):
    """
    Alterna o status ativo/inativo de um bucket
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Busca o bucket
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        # Alterna o status
        current_active = bucket_result.data.get("active", True)
        new_active = not current_active
        
        result = user_supabase.table("clientes_buckets").update({
            "active": new_active
        }).eq("id", bucket_id).execute()
        
        updated_bucket = result.data[0]
        return BucketResponse(
            id=updated_bucket["id"],
            user_id=updated_bucket["user_id"],
            name=updated_bucket["name"],
            bucket_name=updated_bucket["bucket_name"],
            region=updated_bucket["region"],
            active=updated_bucket.get("active", True),
            created_at=updated_bucket.get("created_at"),
            updated_at=updated_bucket.get("updated_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}", response_model=BucketDeleteResponse)
async def delete_bucket(
    bucket_id: str,
    user_data: tuple = Depends(get_current_user)
):
    """
    Deleta um bucket
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Verifica se o bucket existe e pertence ao usuário
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        # Deleta o bucket (cascade vai deletar os logs também)
        user_supabase.table("clientes_buckets").delete().eq("id", bucket_id).execute()
        
        return BucketDeleteResponse(
            message="Bucket deletado com sucesso",
            bucket_id=bucket_id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}/files", response_model=FileListResponse)
async def list_files(
    bucket_id: str,
    prefix: Optional[str] = Query(None, description="Prefixo para filtrar arquivos"),
    page: int = Query(1, ge=1, description="Número da página"),
    page_size: int = Query(50, ge=1, le=1000, description="Itens por página"),
    next_token: Optional[str] = Query(None, description="Token para próxima página"),
    search: Optional[str] = Query(None, description="Busca por texto (case sensitive)"),
    date_from: Optional[str] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Data final (YYYY-MM-DD)"),
    file_extension: Optional[str] = Query(None, description="Filtro por extensão de arquivo (ex: .pdf, .jpg)"),
    user_data: tuple = Depends(get_current_user)
):
    """
    Lista arquivos de um bucket específico com paginação e filtros
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Busca o bucket e verifica se pertence ao usuário
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        bucket_data = bucket_result.data
        
        # Verifica se o bucket está ativo
        if not bucket_data.get("active", True):
            raise HTTPException(status_code=403, detail="Bucket está inativo")
        
        # Cria cliente S3
        s3_client = create_s3_client(
            bucket_data["aws_access_key"],
            bucket_data["aws_secret_key"],
            bucket_data["region"]
        )
        
        # Lista arquivos com paginação
        start_after = None
        if next_token:
            start_after = next_token
        
        files, next_token_result, has_more = list_bucket_files(
            s3_client,
            bucket_data["bucket_name"],
            prefix,
            start_after,
            page_size
        )
        
        # Parse metadados de arquivos de chamadas e adiciona aos arquivos
        files_with_metadata = []
        for file in files:
            file_dict = {
                "key": file.key,
                "size": file.size,
                "last_modified": file.last_modified,
                "etag": getattr(file, 'etag', None)
            }
            
            # Parse metadados se for arquivo de chamada
            if is_call_file(file.key):
                metadata = parse_call_file_name(file.key)
                if metadata:
                    file_dict["call_metadata"] = metadata
            
            files_with_metadata.append(file_dict)
        
        # Converte de volta para FileResponse
        from .schemas import FileResponse
        files = [
            FileResponse(
                key=f["key"],
                size=f["size"],
                last_modified=f["last_modified"],
                etag=f.get("etag"),
                call_metadata=f.get("call_metadata")
            ) for f in files_with_metadata
        ]
        
        # Aplica filtros de data
        if date_from or date_to:
            filtered_files = []
            date_from_obj = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
            date_to_obj = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None
            
            for file in files:
                file_date = file.last_modified.date()
                if date_from_obj and file_date < date_from_obj:
                    continue
                if date_to_obj and file_date > date_to_obj:
                    continue
                filtered_files.append(file)
            files = filtered_files
        
        # Aplica filtro de busca (case sensitive)
        if search:
            filtered_files = []
            for file in files:
                if search in file.key:
                    filtered_files.append(file)
            files = filtered_files
        
        # Aplica filtro por extensão de arquivo
        if file_extension:
            filtered_files = []
            # Remove ponto inicial se presente e adiciona novamente para garantir formato correto
            ext = file_extension.strip()
            if not ext.startswith('.'):
                ext = '.' + ext
            ext_lower = ext.lower()
            
            for file in files:
                # Obtém a extensão do arquivo (case insensitive para comparação)
                file_ext = '.' + file.key.split('.')[-1].lower() if '.' in file.key else ''
                if file_ext == ext_lower:
                    filtered_files.append(file)
            files = filtered_files
        
        return FileListResponse(
            bucket_id=bucket_id,
            bucket_name=bucket_data["bucket_name"],
            files=files,
            total=len(files),
            page=page,
            page_size=page_size,
            has_more=has_more,
            next_token=next_token_result
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Formato de data inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}/upload", response_model=FileUploadResponse)
async def upload_file(
    bucket_id: str,
    file: UploadFile = File(...),
    user_data: tuple = Depends(get_current_user)
):
    """
    Faz upload de um arquivo para o bucket
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Busca o bucket e verifica se pertence ao usuário
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        bucket_data = bucket_result.data
        
        # Verifica se o bucket está ativo
        if not bucket_data.get("active", True):
            raise HTTPException(status_code=403, detail="Bucket está inativo")
        
        # Cria cliente S3
        s3_client = create_s3_client(
            bucket_data["aws_access_key"],
            bucket_data["aws_secret_key"],
            bucket_data["region"]
        )
        
        # Lê o arquivo
        file_content = await file.read()
        file_io = io.BytesIO(file_content)
        
        # Faz upload
        upload_result = upload_file_to_s3(
            s3_client,
            bucket_data["bucket_name"],
            file.filename,
            file_io,
            file.content_type
        )
        
        return FileUploadResponse(
            message="Arquivo enviado com sucesso",
            file_key=file.filename,
            bucket_name=bucket_data["bucket_name"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}/files/{{file_key:path}}/download")
async def download_file(
    bucket_id: str,
    file_key: str,
    user_data: tuple = Depends(get_current_user)
):
    """
    Faz download de um arquivo do bucket (retorna URL pré-assinada)
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Busca o bucket e verifica se pertence ao usuário
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        bucket_data = bucket_result.data
        
        # Verifica se o bucket está ativo
        if not bucket_data.get("active", True):
            raise HTTPException(status_code=403, detail="Bucket está inativo")
        
        # Cria cliente S3
        s3_client = create_s3_client(
            bucket_data["aws_access_key"],
            bucket_data["aws_secret_key"],
            bucket_data["region"]
        )
        
        # Gera URL pré-assinada
        url = get_file_url(
            s3_client,
            bucket_data["bucket_name"],
            file_key,
            expiration=3600  # 1 hora
        )
        
        # Registra log de download
        await log_action(
            user_supabase,
            user_id,
            "download",
            bucket_id,
            file_key
        )
        
        return {"url": url, "file_key": file_key}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}/files/{{file_key:path}}/read")
async def read_file_content(
    bucket_id: str,
    file_key: str,
    user_data: tuple = Depends(get_current_user)
):
    """
    Lê o conteúdo de um arquivo (especialmente para transcrições JSON)
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Busca o bucket e verifica se pertence ao usuário
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        bucket_data = bucket_result.data
        
        # Verifica se o bucket está ativo
        if not bucket_data.get("active", True):
            raise HTTPException(status_code=403, detail="Bucket está inativo")
        
        # Cria cliente S3
        s3_client = create_s3_client(
            bucket_data["aws_access_key"],
            bucket_data["aws_secret_key"],
            bucket_data["region"]
        )
        
        # Faz download do arquivo
        file_content = download_file_from_s3(
            s3_client,
            bucket_data["bucket_name"],
            file_key
        )
        
        # Tenta decodificar como JSON se for arquivo JSON
        content_type = "text/plain"
        content = None
        
        if file_key.endswith('.json'):
            try:
                import json
                content = json.loads(file_content.decode('utf-8'))
                content_type = "application/json"
            except:
                content = file_content.decode('utf-8', errors='ignore')
        else:
            # Tenta decodificar como texto
            try:
                content = file_content.decode('utf-8')
            except:
                raise HTTPException(status_code=400, detail="Arquivo não é um arquivo de texto válido")
        
        return {
            "file_key": file_key,
            "content": content,
            "content_type": content_type
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}/files/{{file_key:path}}", response_model=FileDeleteResponse)
async def delete_file(
    bucket_id: str,
    file_key: str,
    user_data: tuple = Depends(get_current_user)
):
    """
    Deleta um arquivo do bucket
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Busca o bucket e verifica se pertence ao usuário
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        bucket_data = bucket_result.data
        
        # Verifica se o bucket está ativo
        if not bucket_data.get("active", True):
            raise HTTPException(status_code=403, detail="Bucket está inativo")
        
        # Cria cliente S3
        s3_client = create_s3_client(
            bucket_data["aws_access_key"],
            bucket_data["aws_secret_key"],
            bucket_data["region"]
        )
        
        # Deleta arquivo
        delete_file_from_s3(
            s3_client,
            bucket_data["bucket_name"],
            file_key
        )
        
        # Registra log de exclusão
        await log_action(
            user_supabase,
            user_id,
            "delete",
            bucket_id,
            file_key
        )
        
        return FileDeleteResponse(
            message="Arquivo deletado com sucesso",
            file_key=file_key
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(f"{settings.api_v1_prefix}/buckets/{{bucket_id}}/files/{{file_key:path}}/related")
async def get_related_files(
    bucket_id: str,
    file_key: str,
    user_data: tuple = Depends(get_current_user)
):
    """
    Busca arquivos relacionados a um arquivo de chamada (leg A, leg B, transcrições)
    """
    try:
        user_id, token = user_data
        user_supabase = get_supabase_client_with_token(token)
        
        # Busca o bucket
        bucket_result = user_supabase.table("clientes_buckets").select("*").eq(
            "id", bucket_id
        ).single().execute()
        
        if not bucket_result.data:
            raise HTTPException(status_code=404, detail="Bucket não encontrado")
        
        bucket_data = bucket_result.data
        
        if not bucket_data.get("active", True):
            raise HTTPException(status_code=403, detail="Bucket está inativo")
        
        # Parse metadados do arquivo atual
        metadata = parse_call_file_name(file_key)
        if not metadata:
            raise HTTPException(status_code=400, detail="Arquivo não é um arquivo de chamada válido")
        
        # Cria cliente S3
        s3_client = create_s3_client(
            bucket_data["aws_access_key"],
            bucket_data["aws_secret_key"],
            bucket_data["region"]
        )
        
        # Lista todos os arquivos do bucket (ou pelo menos uma amostra maior)
        all_files, _, _ = list_bucket_files(
            s3_client,
            bucket_data["bucket_name"],
            metadata.get("date_path"),  # Filtra pelo caminho da data
            None,
            10000  # Limite alto para buscar relacionados
        )
        
        # Encontra arquivos relacionados
        related_files = {
            "leg_a": None,
            "leg_b": None,
            "transcription": None
        }
        
        call_uuid = metadata.get("call_uuid")
        file_uuid = metadata.get("file_uuid")
        
        for f in all_files:
            f_metadata = parse_call_file_name(f.key) if is_call_file(f.key) else None
            if not f_metadata:
                continue
            
            # Busca leg A e B pela call_uuid
            if f_metadata.get("file_type") == "audio" and f_metadata.get("call_uuid") == call_uuid:
                leg = f_metadata.get("leg")
                if leg == "A":
                    related_files["leg_a"] = {
                        "key": f.key,
                        "size": f.size,
                        "last_modified": f.last_modified.isoformat(),
                        "metadata": f_metadata
                    }
                elif leg == "B":
                    related_files["leg_b"] = {
                        "key": f.key,
                        "size": f.size,
                        "last_modified": f.last_modified.isoformat(),
                        "metadata": f_metadata
                    }
            
            # Busca transcrição pelo file_uuid
            if f_metadata.get("file_type") == "transcription" and f_metadata.get("file_uuid") == file_uuid:
                related_files["transcription"] = {
                    "key": f.key,
                    "size": f.size,
                    "last_modified": f.last_modified.isoformat(),
                    "metadata": f_metadata
                }
        
        return {
            "current_file": {
                "key": file_key,
                "metadata": metadata
            },
            "related": related_files
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(f"{settings.api_v1_prefix}/logs", response_model=LogListResponse)
async def list_logs(
    bucket_id: Optional[str] = Query(None, description="Filtrar por bucket_id"),
    action_type: Optional[str] = Query(None, description="Filtrar por tipo de ação (download, delete)"),
    limit: Optional[int] = Query(100, description="Limite de resultados", ge=1, le=1000),
    user_data: tuple = Depends(get_current_user)
):
    """
    Lista logs de ações do usuário (downloads e exclusões)
    """
    try:
        user_id, token = user_data
        # Cria cliente Supabase com token do usuário para RLS funcionar
        user_supabase = get_supabase_client_with_token(token)
        
        # Constrói query
        query = user_supabase.table("acoes_logs").select("*").eq("user_id", user_id)
        
        # Aplica filtros opcionais
        if bucket_id:
            query = query.eq("bucket_id", bucket_id)
        
        if action_type:
            if action_type not in ["download", "delete"]:
                raise HTTPException(status_code=400, detail="action_type deve ser 'download' ou 'delete'")
            query = query.eq("action_type", action_type)
        
        # Ordena por data mais recente primeiro e limita resultados
        query = query.order("created_at", desc=True).limit(limit)
        
        result = query.execute()
        
        logs = []
        for log in result.data:
            logs.append(LogResponse(
                id=log["id"],
                user_id=log["user_id"],
                action_type=log["action_type"],
                bucket_id=log["bucket_id"],
                file_key=log["file_key"],
                created_at=log["created_at"]
            ))
        
        return LogListResponse(
            logs=logs,
            total=len(logs)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

