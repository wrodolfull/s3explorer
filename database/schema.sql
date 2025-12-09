-- Tabela para armazenar buckets dos clientes
CREATE TABLE IF NOT EXISTS clientes_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bucket_name TEXT NOT NULL,
    aws_access_key TEXT NOT NULL,
    aws_secret_key TEXT NOT NULL,
    region TEXT DEFAULT 'us-east-1',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, bucket_name)
);

-- Adicionar coluna active se não existir (para tabelas já criadas)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes_buckets' AND column_name = 'active'
    ) THEN
        ALTER TABLE clientes_buckets ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_clientes_buckets_user_id ON clientes_buckets(user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_clientes_buckets_updated_at ON clientes_buckets;
CREATE TRIGGER update_clientes_buckets_updated_at
    BEFORE UPDATE ON clientes_buckets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security
ALTER TABLE clientes_buckets ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios buckets
DROP POLICY IF EXISTS "Users can view own buckets" ON clientes_buckets;
CREATE POLICY "Users can view own buckets"
    ON clientes_buckets
    FOR SELECT
    USING (auth.uid() = user_id);

-- Política: Usuários podem inserir apenas seus próprios buckets
DROP POLICY IF EXISTS "Users can insert own buckets" ON clientes_buckets;
CREATE POLICY "Users can insert own buckets"
    ON clientes_buckets
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar apenas seus próprios buckets
DROP POLICY IF EXISTS "Users can update own buckets" ON clientes_buckets;
CREATE POLICY "Users can update own buckets"
    ON clientes_buckets
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar apenas seus próprios buckets
DROP POLICY IF EXISTS "Users can delete own buckets" ON clientes_buckets;
CREATE POLICY "Users can delete own buckets"
    ON clientes_buckets
    FOR DELETE
    USING (auth.uid() = user_id);

-- Tabela para armazenar logs de ações (download, delete)
CREATE TABLE IF NOT EXISTS acoes_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('download', 'delete')),
    bucket_id UUID NOT NULL REFERENCES clientes_buckets(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_acoes_logs_user_id ON acoes_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_acoes_logs_bucket_id ON acoes_logs(bucket_id);
CREATE INDEX IF NOT EXISTS idx_acoes_logs_action_type ON acoes_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_acoes_logs_created_at ON acoes_logs(created_at DESC);

-- Habilitar Row Level Security
ALTER TABLE acoes_logs ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios logs
DROP POLICY IF EXISTS "Users can view own logs" ON acoes_logs;
CREATE POLICY "Users can view own logs"
    ON acoes_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Política: Sistema pode inserir logs (via service role ou com verificação de user_id)
DROP POLICY IF EXISTS "System can insert logs" ON acoes_logs;
CREATE POLICY "System can insert logs"
    ON acoes_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Tabela para armazenar metadados de arquivos de chamadas
CREATE TABLE IF NOT EXISTS arquivos_chamadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id UUID NOT NULL REFERENCES clientes_buckets(id) ON DELETE CASCADE,
    file_key TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('audio', 'transcription')),
    call_uuid UUID, -- UUID da chamada (extraído do nome do arquivo)
    file_uuid UUID, -- UUID do arquivo (extraído do nome do arquivo)
    leg TEXT, -- Leg A ou B (para arquivos de áudio)
    phone_number TEXT, -- Número de telefone
    timestamp TIMESTAMP WITH TIME ZONE, -- Timestamp extraído do nome
    date_path TEXT, -- Caminho da data (ex: 2025/11/26)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bucket_id, file_key)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_arquivos_chamadas_bucket_id ON arquivos_chamadas(bucket_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_chamadas_call_uuid ON arquivos_chamadas(call_uuid);
CREATE INDEX IF NOT EXISTS idx_arquivos_chamadas_file_uuid ON arquivos_chamadas(file_uuid);
CREATE INDEX IF NOT EXISTS idx_arquivos_chamadas_file_type ON arquivos_chamadas(file_type);
CREATE INDEX IF NOT EXISTS idx_arquivos_chamadas_timestamp ON arquivos_chamadas(timestamp);

-- Habilitar Row Level Security
ALTER TABLE arquivos_chamadas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas arquivos de seus próprios buckets
DROP POLICY IF EXISTS "Users can view own call files" ON arquivos_chamadas;
CREATE POLICY "Users can view own call files"
    ON arquivos_chamadas
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clientes_buckets 
            WHERE clientes_buckets.id = arquivos_chamadas.bucket_id 
            AND clientes_buckets.user_id = auth.uid()
        )
    );

-- Política: Sistema pode inserir metadados de arquivos
DROP POLICY IF EXISTS "System can insert call files" ON arquivos_chamadas;
CREATE POLICY "System can insert call files"
    ON arquivos_chamadas
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM clientes_buckets 
            WHERE clientes_buckets.id = arquivos_chamadas.bucket_id 
            AND clientes_buckets.user_id = auth.uid()
        )
    );

-- Política: Sistema pode atualizar metadados de arquivos
DROP POLICY IF EXISTS "System can update call files" ON arquivos_chamadas;
CREATE POLICY "System can update call files"
    ON arquivos_chamadas
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM clientes_buckets 
            WHERE clientes_buckets.id = arquivos_chamadas.bucket_id 
            AND clientes_buckets.user_id = auth.uid()
        )
    );

-- Política: Sistema pode deletar metadados de arquivos
DROP POLICY IF EXISTS "System can delete call files" ON arquivos_chamadas;
CREATE POLICY "System can delete call files"
    ON arquivos_chamadas
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM clientes_buckets 
            WHERE clientes_buckets.id = arquivos_chamadas.bucket_id 
            AND clientes_buckets.user_id = auth.uid()
        )
    );

