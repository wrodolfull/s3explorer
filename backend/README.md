# Backend - S3 Explorer API

API FastAPI para gerenciar buckets S3 com autenticação via Supabase.

## Instalação

1. Crie um ambiente virtual:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

2. Instale as dependências:
```bash
pip install -r requirements.txt
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o .env com suas credenciais do Supabase
```

## Executar

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

A API estará disponível em `http://localhost:8000`

Documentação interativa: `http://localhost:8000/docs`

## Endpoints

- `POST /api/buckets` - Criar/atualizar bucket
- `GET /api/buckets` - Listar buckets do usuário
- `GET /api/buckets/{bucket_id}/files` - Listar arquivos
- `POST /api/buckets/{bucket_id}/upload` - Upload de arquivo
- `GET /api/buckets/{bucket_id}/files/{file_key}/download` - Download (URL pré-assinada)
- `DELETE /api/buckets/{bucket_id}/files/{file_key}` - Deletar arquivo

## Autenticação

Todas as rotas requerem autenticação via JWT do Supabase:
```
Authorization: Bearer <token>
```


