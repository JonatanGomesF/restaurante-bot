-- =====================================================================
-- 🚀 BANCO MULTI-TENANT: delivery_platform
-- URL: https://errczksxtizgpmjzfhnv.supabase.co
-- Cada cliente (delivery) tem seu próprio registro isolado por cliente_id
-- Tabelas escaláveis: novos dados por cliente nunca conflitam com outros
-- =====================================================================

-- 0. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- TABELA 1: clientes (um registro por estabelecimento)
-- Esta é a tabela "mestre" — criada automaticamente na 1ª execução
-- do bot na máquina do cliente.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.clientes (
    id TEXT PRIMARY KEY,                          -- Ex: "pizzaria_joao_sp"
    nome TEXT NOT NULL DEFAULT 'Meu Delivery',
    telefone_dono TEXT DEFAULT '',
    chave_pix TEXT DEFAULT '',
    endereco TEXT DEFAULT '',
    taxa_entrega NUMERIC(10, 2) DEFAULT 5.00,
    tempo_estimado_min INTEGER DEFAULT 30,
    tempo_estimado_max INTEGER DEFAULT 50,
    horario_almoco TEXT DEFAULT '11:00 às 15:00',
    horario_jantar TEXT DEFAULT '18:00 às 23:30',
    fechado_hoje BOOLEAN DEFAULT FALSE,
    motivo_fechado TEXT DEFAULT '',
    data_fechada_manual TEXT DEFAULT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    plano TEXT DEFAULT 'basico',                  -- 'basico', 'pro', 'enterprise'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- TABELA 2: pedidos (todos os pedidos de todos os clientes)
-- Isolados por cliente_id
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
    id TEXT PRIMARY KEY,                          -- Ex: "ped_17234567_1234"
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,                         -- Ex: "#PED-1234"
    nome_cliente TEXT NOT NULL DEFAULT '',
    telefone TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,                           -- "YYYY-MM-DD"
    horario TEXT NOT NULL,                        -- "HH:MM"
    itens JSONB NOT NULL DEFAULT '[]'::jsonb,     -- array completo de itens
    servico TEXT DEFAULT '',                      -- resumo texto dos itens
    subtotal NUMERIC(10, 2) DEFAULT 0.00,
    taxa_entrega NUMERIC(10, 2) DEFAULT 0.00,
    total NUMERIC(10, 2) DEFAULT 0.00,
    tipo_entrega TEXT DEFAULT 'delivery',         -- 'delivery' | 'retirada'
    endereco_entrega TEXT DEFAULT '',
    bairro TEXT DEFAULT '',
    forma_pagamento TEXT DEFAULT 'PIX',
    troco_para NUMERIC(10, 2) DEFAULT NULL,
    observacoes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendente',      -- pendente | em_preparo | saiu_entrega | concluido | cancelado
    origem TEXT DEFAULT 'whatsapp',               -- 'whatsapp' | 'manual' | 'painel'
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    cancelado_em TIMESTAMPTZ DEFAULT NULL,
    concluido_em TIMESTAMPTZ DEFAULT NULL
);

-- =====================================================================
-- TABELA 3: cardapio (cardápio por cliente, totalmente independente)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cardapio (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,                     -- ID local do item
    categoria TEXT NOT NULL DEFAULT 'geral',
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    preco NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    turno TEXT DEFAULT 'todos',                   -- 'dia' | 'noite' | 'todos'
    icone TEXT DEFAULT '🍽️',
    ativo BOOLEAN DEFAULT TRUE,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cliente_id, item_id)
);

-- =====================================================================
-- TABELA 4: categorias (categorias de cardápio por cliente)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.categorias (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    categoria_id TEXT NOT NULL,                   -- Ex: 'marmitex', 'pizza'
    nome TEXT NOT NULL,
    icone TEXT DEFAULT '🍽️',
    turno TEXT DEFAULT 'todos',
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(cliente_id, categoria_id)
);

-- =====================================================================
-- TABELA 5: opcoes_extras (carnes, bordas, complementos — por cliente)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.opcoes_extras (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,                           -- 'carne' | 'borda' | 'complemento'
    opcao_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    preco NUMERIC(10, 2) DEFAULT 0.00,
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(cliente_id, tipo, opcao_id)
);

-- =====================================================================
-- TABELA 6: conversas (estado do chatbot por telefone, por cliente)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.conversas (
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    estado JSONB NOT NULL DEFAULT '{}'::jsonb,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cliente_id, telefone)
);

-- =====================================================================
-- TABELA 7: mensagens_bot (templates de mensagens configuráveis por cliente)
-- CRUD Relacional (sem JSONs): cada mensagem é uma linha própria.
--   GET    → linhas por cliente_id
--   POST   → upsert por (cliente_id, chave)
--   DELETE → remove linha por chave ou id
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.mensagens_bot (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,                          -- Ex: 'menuPrincipal', 'pedidoConcluido'
    conteudo TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cliente_id, chave)
);

-- =====================================================================
-- TABELA 8: configuracoes_extras (chave-valor livre por cliente)
-- Permite acrescentar novas configurações sem alterar o schema
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.configuracoes_extras (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,
    valor JSONB NOT NULL DEFAULT 'null'::jsonb,
    descricao TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cliente_id, chave)
);

-- =====================================================================
-- ÍNDICES para performance
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_data    ON public.pedidos(cliente_id, data, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_telefone        ON public.pedidos(cliente_id, telefone);
CREATE INDEX IF NOT EXISTS idx_cardapio_cliente        ON public.cardapio(cliente_id, categoria, ativo);
CREATE INDEX IF NOT EXISTS idx_categorias_cliente      ON public.categorias(cliente_id, ordem);
CREATE INDEX IF NOT EXISTS idx_opcoes_cliente_tipo     ON public.opcoes_extras(cliente_id, tipo);
CREATE INDEX IF NOT EXISTS idx_conversas_cliente       ON public.conversas(cliente_id, telefone);
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente       ON public.mensagens_bot(cliente_id, chave);
CREATE INDEX IF NOT EXISTS idx_config_extras_cliente   ON public.configuracoes_extras(cliente_id, chave);

-- =====================================================================
-- RLS (Row Level Security) — garante isolamento multi-tenant
-- =====================================================================
ALTER TABLE public.clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardapio            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opcoes_extras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_bot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_extras ENABLE ROW LEVEL SECURITY;

-- Política permissiva para anon (acesso via publishable key controlado pelo cliente_id)
DROP POLICY IF EXISTS "anon_clientes"             ON public.clientes;
DROP POLICY IF EXISTS "anon_pedidos"              ON public.pedidos;
DROP POLICY IF EXISTS "anon_cardapio"             ON public.cardapio;
DROP POLICY IF EXISTS "anon_categorias"           ON public.categorias;
DROP POLICY IF EXISTS "anon_opcoes_extras"        ON public.opcoes_extras;
DROP POLICY IF EXISTS "anon_conversas"            ON public.conversas;
DROP POLICY IF EXISTS "anon_mensagens_bot"        ON public.mensagens_bot;
DROP POLICY IF EXISTS "anon_config_extras"        ON public.configuracoes_extras;

CREATE POLICY "anon_clientes"             ON public.clientes             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_pedidos"              ON public.pedidos              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_cardapio"             ON public.cardapio             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_categorias"           ON public.categorias           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_opcoes_extras"        ON public.opcoes_extras        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_conversas"           ON public.conversas            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_mensagens_bot"        ON public.mensagens_bot        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_config_extras"        ON public.configuracoes_extras FOR ALL USING (true) WITH CHECK (true);
