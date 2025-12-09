from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BucketCreate(BaseModel):
    """Schema para criar bucket"""
    name: str = Field(..., description="Nome amigável do bucket")
    bucket_name: str = Field(..., description="Nome do bucket S3")
    aws_access_key: str = Field(..., description="AWS Access Key ID")
    aws_secret_key: str = Field(..., description="AWS Secret Access Key")
    region: str = Field(default="us-east-1", description="Região AWS")
    active: bool = Field(default=True, description="Status ativo/inativo")


class BucketUpdate(BaseModel):
    """Schema para atualizar bucket"""
    name: Optional[str] = Field(None, description="Nome amigável do bucket")
    bucket_name: Optional[str] = Field(None, description="Nome do bucket S3")
    aws_access_key: Optional[str] = Field(None, description="AWS Access Key ID")
    aws_secret_key: Optional[str] = Field(None, description="AWS Secret Access Key")
    region: Optional[str] = Field(None, description="Região AWS")
    active: Optional[bool] = Field(None, description="Status ativo/inativo")


class BucketResponse(BaseModel):
    """Schema de resposta para bucket"""
    id: str
    user_id: str
    name: str
    bucket_name: str
    region: str
    active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BucketDeleteResponse(BaseModel):
    """Schema de resposta para delete de bucket"""
    message: str
    bucket_id: str


class FileResponse(BaseModel):
    """Schema de resposta para arquivo"""
    key: str
    size: int
    last_modified: datetime
    etag: Optional[str] = None
    call_metadata: Optional[dict] = None  # Metadados parseados do arquivo de chamada


class FileListResponse(BaseModel):
    """Schema de resposta para lista de arquivos"""
    bucket_id: str
    bucket_name: str
    files: List[FileResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
    next_token: Optional[str] = None


class FileUploadResponse(BaseModel):
    """Schema de resposta para upload"""
    message: str
    file_key: str
    bucket_name: str


class FileDeleteResponse(BaseModel):
    """Schema de resposta para delete"""
    message: str
    file_key: str


class LogResponse(BaseModel):
    """Schema de resposta para log"""
    id: str
    user_id: str
    action_type: str
    bucket_id: str
    file_key: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    """Schema de resposta para lista de logs"""
    logs: List[LogResponse]
    total: int
