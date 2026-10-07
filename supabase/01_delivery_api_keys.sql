-- =====================================================================
-- 🔐 TABELA DE CHAVES DE API POR CLIENTE
-- Habilita o isolamento multi-tenant real: o DeliveryBot.exe nunca recebe
-- a chave `service_role` — apenas uma chave de API exclusiva do próprio
-- estabelecimento. A Edge Function valida a chave no servidor e aplica
-- o filtro de `cliente_id`.
--
-- Aplicar no SQL Editor do Supabase (1x).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.delivery_api_keys (
    id           BIGSERIAL PRIMARY KEY,
    cliente_id   TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    -- Somente o SHA-256 da chave e guardado. Se o banco vazar, as chaves
    -- continuam seguras (não há como recuperar o valor original).
    chave_hash   TEXT NOT NULL UNIQUE,
    rotulo       TEXT DEFAULT '',
    ativo        BOOLEAN DEFAULT TRUE,
    criado_em    TIMESTAMPTZ DEFAULT NOW(),
    ultimo_uso   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.delivery_api_keys(chave_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_cliente ON public.delivery_api_keys(cliente_id);

-- =====================================================================
-- RLS: esta tabela NÃO pode ser acessível pelo papel `anon`.
-- O papel `anon` representa o cliente final. Qualquer acesso aqui
-- permitiria roubar a chave de outro estabelecimento.
-- =====================================================================
ALTER TABLE public.delivery_api_keys ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para `anon` / `authenticated` = acesso bloqueado.
-- A Edge Function usa `service_role`, que ignora RLS.

-- Limpeza defensiva: remove policies que alguém tenha criado por engano.
DROP POLICY IF EXISTS "anon_delivery_api_keys" ON public.delivery_api_keys;

-- =====================================================================
-- Como emitir a chave de um cliente
-- =====================================================================
-- 1) Gere a chave (32 bytes aleatórios em hex):
--      SELECT encode(gen_random_bytes(32), 'hex');
--
-- 2) Registre o hash (rode com o valor gerado no passo 1):
--      INSERT INTO public.delivery_api_keys (cliente_id, chave_hash, rotulo)
--      VALUES (
--        'pizzaria_da_ana_sp',
--        encode(digest('COLE_AQUI_A_CHAVE_GERADA', 'sha256'), 'hex'),
--        'Pizzaria da Ana - PDV 1'
--      );
--
-- 3) Coloque o valor em branco no config_delivery.json do cliente:
--      {
--        "clienteId": "pizzaria_da_ana_sp",
--        "apiKey": "COLE_AQUI_A_CHAVE_GERADA"
--      }
--
-- Revogar o acesso de um cliente:
--      UPDATE public.delivery_api_keys SET ativo = FALSE WHERE cliente_id = '...';