-- =====================================================================
-- 🍽️ RESTAURANTE BOM SABOR — WHATSAPP DELIVERY & PAINEL DE PEDIDOS
-- SCHEMA SUPABASE (POSTGRESQL)
-- =====================================================================
-- Instruções:
-- 1. Acesse https://supabase.com e entre no seu projeto.
-- 2. Vá em "SQL Editor" na barra lateral esquerda.
-- 3. Clique em "New Query".
-- 4. Cole o código abaixo e clique em "Run" (Executar).
-- =====================================================================

-- 1. Habilita extensão para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Restaurantes / Estabelecimentos
CREATE TABLE IF NOT EXISTS public.barbearias (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL DEFAULT 'Restaurante Bom Sabor',
    telefone_dono TEXT DEFAULT '5515974062762@c.us',
    chave_pix TEXT DEFAULT '15974062762',
    endereco TEXT DEFAULT 'Rua das Delícias, 123 - Centro',
    taxa_entrega NUMERIC(10, 2) DEFAULT 5.00,
    fechado_hoje BOOLEAN DEFAULT FALSE,
    motivo_fechado TEXT DEFAULT 'Descanso da equipe',
    data_fechada_manual TEXT DEFAULT NULL,
    horario_almoco TEXT DEFAULT '11:00 às 15:00',
    horario_jantar TEXT DEFAULT '18:00 às 23:30',
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Pedidos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id TEXT PRIMARY KEY,
    barbearia_id TEXT NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    cliente TEXT NOT NULL,
    telefone TEXT NOT NULL,
    data TEXT NOT NULL, -- YYYY-MM-DD
    horario TEXT NOT NULL, -- HH:MM
    servico TEXT NOT NULL, -- Itens resumidos do pedido
    preco NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- Valor Total
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'em_preparo', 'saiu_entrega', 'concluido', 'cancelado'
    origem TEXT DEFAULT 'whatsapp', -- 'whatsapp' ou 'manual'
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    cancelado_em TIMESTAMPTZ,
    concluido_em TIMESTAMPTZ
);

-- 4. Tabela de Conversas (Estado do WhatsApp Bot)
CREATE TABLE IF NOT EXISTS public.conversas (
    barbearia_id TEXT NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    estado JSONB NOT NULL DEFAULT '{}'::jsonb,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (barbearia_id, telefone)
);

-- 5. Índices de Busca Rápida
CREATE INDEX IF NOT EXISTS idx_pedidos_restaurante_data ON public.agendamentos(barbearia_id, data, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_telefone ON public.agendamentos(barbearia_id, telefone);

-- 6. Row Level Security (RLS)
ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para restaurantes anon" ON public.barbearias;
CREATE POLICY "Permitir tudo para restaurantes anon" ON public.barbearias FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para pedidos anon" ON public.agendamentos;
CREATE POLICY "Permitir tudo para pedidos anon" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para conversas anon" ON public.conversas;
CREATE POLICY "Permitir tudo para conversas anon" ON public.conversas FOR ALL USING (true) WITH CHECK (true);

-- 7. Inserção Inicial
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
