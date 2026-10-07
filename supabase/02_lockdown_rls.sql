-- =====================================================================
-- 🔒 FECHAMENTO DO RLS — aplicado APÓS a Edge Function estar no ar
-- =====================================================================
-- ⚠️  ORDEM OBRIGATÓRIA
--   1. Rodar 01_delivery_api_keys.sql
--   2. Fazer deploy da função:  supabase functions deploy delivery-api --no-verify-jwt
--   3. Emitir a chave de cada cliente e colocar no config_delivery.json
--   4. Testar o bot com o DeliveryBot.exe de um cliente
--   5. SÓ ENTÃO rodar este arquivo
--
--   Se você rodar este arquivo antes do passo 4, o bot perde o acesso
--   ao banco (as políticas USING(true) serão removidas e a função ainda
--   não exists). Não tem como reverter automaticamente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PASSO 1 — Confirme que a função está funcionando ANTES de remover as
--           políticas permissivas. Rode e espere "OK".
-- ---------------------------------------------------------------------
--   curl -X POST \
--     'https://errczksxtizgpmjzfhnv.supabase.co/functions/v1/delivery-api' \
--     -H 'x-client-key: SUA_CHAVE_DE_CLIENTE' \
--     -H 'Content-Type: application/json' \
--     -d '{"tabela":"clientes","op":"select","single":true}'

-- ---------------------------------------------------------------------
-- PASSO 2 — Remove as políticas permissivas (a origem do vazamento)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_clientes"             ON public.clientes;
DROP POLICY IF EXISTS "anon_pedidos"              ON public.pedidos;
DROP POLICY IF EXISTS "anon_cardapio"             ON public.cardapio;
DROP POLICY IF EXISTS "anon_categorias"           ON public.categorias;
DROP POLICY IF EXISTS "anon_opcoes_extras"        ON public.opcoes_extras;
DROP POLICY IF EXISTS "anon_conversas"            ON public.conversas;
DROP POLICY IF EXISTS "anon_mensagens_bot"        ON public.mensagens_bot;
DROP POLICY IF EXISTS "anon_config_extras"        ON public.configuracoes_extras;

-- Nenhuma policy nova é criada para `anon`.
-- Com RLS ativado e sem policy, o papel `anon` não lê nem escreve nada.

-- ---------------------------------------------------------------------
-- PASSO 3 — Garante que a tabela de chaves está inacessível ao cliente
-- ---------------------------------------------------------------------
ALTER TABLE public.delivery_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_delivery_api_keys" ON public.delivery_api_keys;

-- ---------------------------------------------------------------------
-- PASSO 4 — Verificação
-- ---------------------------------------------------------------------
-- Rode estas queries depois de aplicar. Todas devem retornar 0 linhas.
--
-- Confere se sobrou alguma policy permissiva:
SELECT tablename, policyname, cmd, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND policyname LIKE 'anon%';

-- Confere que RLS está ativo em todas as tabelas:
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public'
 ORDER BY tablename;

-- =====================================================================
-- DEPOIS DISSO: rotacione a chave `anon` atual
-- =====================================================================
-- A chave publishable sb_publishable_MmLNWGDwYO0fVxVUC8lCEA_pU113fNw
-- estava dentro do .exe e gave acesso total ao banco. Com o RLS
-- fechado ela deixa de ser útil para ataques, mas ainda assim
-- recomendo revogá-la no painel do Supabase
-- (Project Settings → API Keys).
-- =====================================================================