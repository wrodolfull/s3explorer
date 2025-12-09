# Frontend - S3 Explorer

Interface React com Tailwind CSS para gerenciar buckets S3.

## Instalação

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

## Executar

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

## Build para Produção

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`

## Variáveis de Ambiente

- `VITE_SUPABASE_URL`: URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `VITE_API_URL`: URL da API backend (padrão: http://localhost:8000)



