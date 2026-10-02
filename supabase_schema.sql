-- =====================================================================
-- 🛡️ PROJETO SUPABASE COMPARTILHADO: "rocketsbot"
-- ISOLAMENTO TOTAL MULTI-TENANT (Barbearia vs Restaurante)
-- =====================================================================
-- Este script adiciona o tenant 'restaurante_principal' SEM NUNCA
-- alterar, apagar ou misturar os dados da sua Barbearia ('barbearia_principal').
-- =====================================================================

-- 1. Habilita extensão para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Garante que as tabelas base existam (não altera dados existentes)
CREATE TABLE IF NOT EXISTS public.barbearias (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL DEFAULT 'Estabelecimento',
    telefone_dono TEXT DEFAULT '',
    chave_pix TEXT DEFAULT '',
    endereco TEXT DEFAULT '',
    fechado_hoje BOOLEAN DEFAULT FALSE,
    motivo_fechado TEXT DEFAULT '',
    data_fechada_manual TEXT DEFAULT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona colunas opcionais para restaurante com segurança
ALTER TABLE public.barbearias ADD COLUMN IF NOT EXISTS taxa_entrega NUMERIC(10, 2) DEFAULT 5.00;
ALTER TABLE public.barbearias ADD COLUMN IF NOT EXISTS horario_almoco TEXT DEFAULT '11:00 às 15:00';
ALTER TABLE public.barbearias ADD COLUMN IF NOT EXISTS horario_jantar TEXT DEFAULT '18:00 às 23:30';

-- 3. Tabela de Pedidos e Agendamentos (Isolada por barbearia_id)
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id TEXT PRIMARY KEY,
    barbearia_id TEXT NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    cliente TEXT NOT NULL,
    telefone TEXT NOT NULL,
    data TEXT NOT NULL,
    horario TEXT NOT NULL,
    servico TEXT NOT NULL,
    preco NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pendente',
    origem TEXT DEFAULT 'whatsapp',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    cancelado_em TIMESTAMPTZ,
    concluido_em TIMESTAMPTZ
);

-- 4. Tabela de Conversas (Isolada por barbearia_id + telefone)
CREATE TABLE IF NOT EXISTS public.conversas (
    barbearia_id TEXT NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    estado JSONB NOT NULL DEFAULT '{}'::jsonb,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (barbearia_id, telefone)
);

-- 5. Índices de Otimização
CREATE INDEX IF NOT EXISTS idx_agendamentos_tenant ON public.agendamentos(barbearia_id, data, status);
CREATE INDEX IF NOT EXISTS idx_conversas_tenant ON public.conversas(barbearia_id, telefone);

-- 6. Políticas de RLS
ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para barbearias anon" ON public.barbearias;
CREATE POLICY "Permitir tudo para barbearias anon" ON public.barbearias FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para agendamentos anon" ON public.agendamentos;
CREATE POLICY "Permitir tudo para agendamentos anon" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para conversas anon" ON public.conversas;
CREATE POLICY "Permitir tudo para conversas anon" ON public.conversas FOR ALL USING (true) WITH CHECK (true);

-- 7. Insere o Tenant do Restaurante Bom Sabor (SEM mexer no da Barbearia)
INSERT INTO public.barbearias (
    id,
    nome,
    telefone_dono,
    chave_pix,
    endereco,
    taxa_entrega,
    fechado_hoje,
    motivo_fechado,
    horario_almoco,
    horario_jantar
) VALUES (
    'restaurante_principal',
    'Restaurante Bom Sabor',
    '5515974062762@c.us',
    '15974062762',
    'Rua das Delícias, 123 - Centro',
    5.00,
    false,
    'Descanso semanal da equipe',
    '11:00 às 15:00',
    '18:00 às 23:30'
)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    endereco = EXCLUDED.endereco;
