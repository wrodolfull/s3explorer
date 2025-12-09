# S3 Explorer - Aplicação Completa com Supabase

Aplicação completa para clientes acessarem seus próprios buckets S3 usando credenciais próprias, com autenticação via Supabase Auth e banco de dados no Supabase.

## 🏗️ Arquitetura

```
Cliente → Frontend (React) → Backend (FastAPI) → Supabase Auth → S3
```

### Fluxo de Segurança

1. Cliente faz login via Supabase Auth
2. Frontend recebe JWT token
3. Backend valida JWT com Supabase
4. Backend busca credenciais S3 do cliente no banco (com RLS)
5. Backend acessa S3 em nome do cliente
6. Resposta segura retornada ao cliente

**Por que é seguro:**
- Cliente nunca vê o Secret Key da AWS diretamente
- Credenciais ficam armazenadas no Supabase com RLS
- Backend acessa S3 em nome do cliente
- Tudo passa por autenticação JWT do Supabase

## 📂 Estrutura do Projeto

```
Meeb_explorer/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── main.py      # Rotas da API
│   │   ├── auth.py      # Validação JWT
│   │   ├── s3.py        # Operações S3
│   │   ├── database.py  # Cliente Supabase
│   │   ├── schemas.py   # Modelos Pydantic
│   │   └── config.py    # Configurações
│   ├── requirements.txt
│   └── .env.example
├── frontend/            # Interface React
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── lib/         # Clientes Supabase e API
│   │   └── App.tsx
│   └── package.json
└── database/
    └── schema.sql       # Schema do banco
```

## 🚀 Setup Rápido

### 1. Banco de Dados (Supabase)

Execute o script SQL em `database/schema.sql` no SQL Editor do Supabase:

```sql
-- Cria tabela e políticas RLS
-- (veja database/schema.sql completo)
```

### 2. Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase

# Executar
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Executar
npm run dev
```

## 🔑 Configuração

### Variáveis de Ambiente - Backend

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=chave_anon
API_V1_PREFIX=/api
```

### Variáveis de Ambiente - Frontend

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=chave_anon
VITE_API_URL=http://localhost:8000
```

## 📡 Endpoints da API

### Buckets

- `POST /api/buckets` - Criar/atualizar bucket
- `GET /api/buckets` - Listar buckets do usuário

### Arquivos

- `GET /api/buckets/{bucket_id}/files` - Listar arquivos
- `POST /api/buckets/{bucket_id}/upload` - Upload de arquivo
- `GET /api/buckets/{bucket_id}/files/{file_key}/download` - Download (URL pré-assinada)
- `DELETE /api/buckets/{bucket_id}/files/{file_key}` - Deletar arquivo

Todas as rotas requerem autenticação:
```
Authorization: Bearer <jwt-token>
```

## 🗄️ Banco de Dados

### Tabela `clientes_buckets`

- `id` (uuid) - Primary key
- `user_id` (uuid) - Foreign key para auth.users
- `name` (text) - Nome amigável
- `bucket_name` (text) - Nome do bucket S3
- `aws_access_key` (text) - Access Key ID
- `aws_secret_key` (text) - Secret Access Key
- `region` (text) - Região AWS
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Row Level Security (RLS)

- Usuários só veem seus próprios buckets
- Políticas para SELECT, INSERT, UPDATE, DELETE
- Isolamento completo de dados entre usuários

## 🎨 Funcionalidades

### Frontend

- ✅ Login/Registro com Supabase Auth
- ✅ Gerenciamento de múltiplos buckets
- ✅ Listagem de arquivos
- ✅ Upload com drag & drop
- ✅ Download de arquivos (URL pré-assinada)
- ✅ Delete de arquivos
- ✅ Interface moderna e responsiva

### Backend

- ✅ Autenticação JWT via Supabase
- ✅ Validação de permissões
- ✅ Operações S3 completas
- ✅ URLs pré-assinadas para downloads seguros
- ✅ Tratamento de erros
- ✅ CORS configurado

## 🔒 Segurança

1. **Autenticação**: JWT do Supabase em todas as rotas
2. **RLS**: Row Level Security no Supabase
3. **Isolamento**: Cada usuário só acessa seus próprios buckets
4. **Credenciais**: AWS credentials nunca expostas ao frontend
5. **URLs Pré-assinadas**: Downloads seguros com expiração

## 📝 Uso

1. **Registre-se/Login** no frontend
2. **Adicione um bucket** com suas credenciais AWS
3. **Selecione o bucket** para trabalhar
4. **Faça upload** de arquivos (drag & drop)
5. **Liste, baixe ou delete** arquivos

## 🛠️ Tecnologias

- **Backend**: FastAPI, Python, boto3, Supabase
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Auth**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Storage**: AWS S3

## 📚 Documentação

- Backend API: `http://localhost:8000/docs` (Swagger UI)
- Frontend: `http://localhost:3000`

## 🚢 Deploy

### Backend

Pode ser deployado em:
- Railway
- Render
- Heroku
- VPS com Docker

### Frontend

Pode ser deployado em:
- Vercel
- Netlify
- GitHub Pages
- Qualquer servidor estático

## 📄 Licença

Este projeto é open source e está disponível sob a licença MIT.



