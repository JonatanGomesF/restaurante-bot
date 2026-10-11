-- =====================================================================
-- MIGRAÇÃO: Nichos dinâmicos (Painel Master Admin)
-- Cria public.nichos (fonte das opções do cadastro de lojas) e libera
-- clientes.niche para valores dinâmicos (remove o CHECK fixo).
-- Idempotente — pode rodar quantas vezes quiser. Executar 1x no SQL Editor.
-- =====================================================================

-- 1. Tabela de nichos
CREATE TABLE IF NOT EXISTS public.nichos (
    id          TEXT PRIMARY KEY,
    nome        TEXT NOT NULL,
    icone       TEXT NOT NULL DEFAULT '🤖',
    tipo_fluxo  TEXT NOT NULL DEFAULT 'agendamento'
                CHECK (tipo_fluxo IN ('delivery', 'agendamento')),
    ordem       INTEGER NOT NULL DEFAULT 0,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para a consulta do select: WHERE ativo = true ORDER BY ordem
CREATE INDEX IF NOT EXISTS idx_nichos_ativos_ordem ON public.nichos(ativo, ordem);

-- 2. Seed inicial — nichos oficiais (ordem = posição no select)
INSERT INTO public.nichos (id, nome, icone, tipo_fluxo, ordem, ativo) VALUES
    ('delivery',   'Delivery / Restaurante', '🍽️', 'delivery',    1, TRUE),
    ('barbershop', 'Barbearia',              '✂️', 'agendamento', 2, TRUE),
    ('clinic',     'Clínica',                '🩺', 'agendamento', 3, TRUE),
    ('petshop',    'PetShop',                '🐾', 'agendamento', 4, TRUE),
    ('salon',      'Salão de Beleza',        '💅', 'agendamento', 5, TRUE)
ON CONFLICT (id) DO UPDATE SET
    nome       = EXCLUDED.nome,
    icone      = EXCLUDED.icone,
    tipo_fluxo = EXCLUDED.tipo_fluxo,
    ordem      = EXCLUDED.ordem,
    ativo      = TRUE,
    updated_at = NOW();

-- 3. RLS: só a role service_role (Painel Master) acessa a tabela.
--    Clientes (anon/authenticated) não leem nem escrevem nichos.
ALTER TABLE public.nichos ENABLE ROW LEVEL SECURITY;

-- 4. Libera clientes.niche para nichos dinâmicos (remover o CHECK fixo).
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_niche_check;

-- 5. Garantia em nível de banco: clientes.niche NUNCA pode ser null/vazio.
--    Normaliza linhas existentes e cria um CHECK de integridade.
UPDATE public.clientes
SET    niche = 'delivery'
WHERE  niche IS NULL OR length(trim(COALESCE(niche, ''))) = 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clientes_niche_not_empty') THEN
        ALTER TABLE public.clientes
            ADD CONSTRAINT clientes_niche_not_empty
            CHECK (niche IS NOT NULL AND length(trim(niche)) > 0);
    END IF;
END $$;

-- =====================================================================
-- NOTA: um novo nicho cadastrado aqui alimenta o select do cadastro de
-- lojas no Painel Master. O fluxo do bot (engine) precisa conhecer o
-- nicho — para nichos com tipo_fluxo 'agendamento' novos, o suporte na
-- engine (niches.js / mensagens_bot) deve ser adicionado à parte.
-- =====================================================================