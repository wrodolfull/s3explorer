import boto3
from botocore.exceptions import ClientError
from typing import List, Optional, BinaryIO
from datetime import datetime, timedelta
from .schemas import FileResponse


def create_s3_client(
    access_key: str,
    secret_key: str,
    region: str = "us-east-1"
) -> boto3.client:
    """
    Cria um cliente S3 com as credenciais fornecidas
    
    Args:
        access_key: AWS Access Key ID
        secret_key: AWS Secret Access Key
        region: Região AWS
        
    Returns:
        Cliente boto3 S3 configurado
    """
    return boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region
    )


def list_bucket_files(
    s3_client: boto3.client,
    bucket_name: str,
    prefix: Optional[str] = None,
    start_after: Optional[str] = None,
    max_keys: Optional[int] = None
) -> tuple[List[FileResponse], Optional[str], bool]:
    """
    Lista arquivos de um bucket S3 com paginação
    
    Args:
        s3_client: Cliente boto3 S3
        bucket_name: Nome do bucket
        prefix: Prefixo opcional para filtrar arquivos
        start_after: Chave para começar a listagem (para paginação)
        max_keys: Número máximo de arquivos a retornar
        
    Returns:
        Tupla com (lista de FileResponse, next_token, has_more)
    """
    try:
        params = {"Bucket": bucket_name}
        if prefix:
            params["Prefix"] = prefix
        if start_after:
            params["StartAfter"] = start_after
        if max_keys:
            params["MaxKeys"] = max_keys
        else:
            params["MaxKeys"] = 1000  # Limite padrão do S3
            
        response = s3_client.list_objects_v2(**params)
        
        if "Contents" not in response:
            return ([], None, False)
        
        files = []
        for obj in response["Contents"]:
            files.append(FileResponse(
                key=obj["Key"],
                size=obj["Size"],
                last_modified=obj["LastModified"],
                etag=obj.get("ETag", "").strip('"')
            ))
        
        # Verifica se há mais resultados
        has_more = response.get("IsTruncated", False)
        next_token = response.get("NextContinuationToken") if has_more else None
        
        return (files, next_token, has_more)
    except ClientError as e:
        raise Exception(f"Erro ao listar arquivos: {str(e)}")


def upload_file_to_s3(
    s3_client: boto3.client,
    bucket_name: str,
    file_key: str,
    file_data: BinaryIO,
    content_type: Optional[str] = None
) -> dict:
    """
    Faz upload de um arquivo para o S3
    
    Args:
        s3_client: Cliente boto3 S3
        bucket_name: Nome do bucket
        file_key: Chave/nome do arquivo no S3
        file_data: Dados do arquivo (BinaryIO)
        content_type: Tipo MIME do arquivo
        
    Returns:
        Dict com informações do upload
    """
    try:
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        
        s3_client.upload_fileobj(
            file_data,
            bucket_name,
            file_key,
            ExtraArgs=extra_args
        )
        
        return {
            "success": True,
            "file_key": file_key,
            "bucket_name": bucket_name
        }
    except ClientError as e:
        raise Exception(f"Erro ao fazer upload: {str(e)}")


def download_file_from_s3(
    s3_client: boto3.client,
    bucket_name: str,
    file_key: str
) -> bytes:
    """
    Faz download de um arquivo do S3
    
    Args:
        s3_client: Cliente boto3 S3
        bucket_name: Nome do bucket
        file_key: Chave/nome do arquivo no S3
        
    Returns:
        Bytes do arquivo
    """
    try:
        response = s3_client.get_object(
            Bucket=bucket_name,
            Key=file_key
        )
        return response["Body"].read()
    except ClientError as e:
        raise Exception(f"Erro ao fazer download: {str(e)}")


def delete_file_from_s3(
    s3_client: boto3.client,
    bucket_name: str,
    file_key: str
) -> bool:
    """
    Deleta um arquivo do S3
    
    Args:
        s3_client: Cliente boto3 S3
        bucket_name: Nome do bucket
        file_key: Chave/nome do arquivo no S3
        
    Returns:
        True se deletado com sucesso
    """
    try:
        s3_client.delete_object(
            Bucket=bucket_name,
            Key=file_key
        )
        return True
    except ClientError as e:
        raise Exception(f"Erro ao deletar arquivo: {str(e)}")


def get_file_url(
    s3_client: boto3.client,
    bucket_name: str,
    file_key: str,
    expiration: int = 3600
) -> str:
    """
    Gera uma URL pré-assinada para download seguro
    
    Args:
        s3_client: Cliente boto3 S3
        bucket_name: Nome do bucket
        file_key: Chave/nome do arquivo no S3
        expiration: Tempo de expiração em segundos (padrão: 1 hora)
        
    Returns:
        URL pré-assinada
    """
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": file_key},
            ExpiresIn=expiration
        )
        return url
    except ClientError as e:
        raise Exception(f"Erro ao gerar URL: {str(e)}")

