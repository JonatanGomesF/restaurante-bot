# ⚠️ Segurança Multi-Tenant — Pendência Crítica

> **Status:** NÃO CORRIGIDO. Leia antes de distribuir para mais de um cliente.

## O problema

O README afirma que *"os dados de um cliente nunca vazam para outro"*. Isso **não é verdade** na implementação atual.

Em `supabase_schema.sql:187-194`, todas as políticas RLS são permissivas:

```sql
CREATE POLICY "anon_pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);
```

`USING (true)` significa que **qualquer requisição autenticada com a chave `anon` lê e escreve todas as linhas de todos os clientes**.

## Por que isso é explorável

A chave do banco está hardcoded em `src/database.js:15`:

```js
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_MmLNWGDwYO0fVxVUC8lCEA_pU113fNw';
```

Esse código é ofuscado e embutido no `DeliveryBot.exe` distribuído. O prefixo `sb_publishable_` indica que é uma chave **projetada para ser pública** (equivalente à antiga `anon key`) — ou seja, ela **não pode ser considered segredo**, e o `.exe` do cliente sempre vai a conter.

Além disso, `pedidos` guarda dados pessoais de clientes finais (schema linhas 45-56):

| Coluna | Dado |
|---|---|
| `nome_cliente` | Nome de quem pediu |
| `telefone` | Telefone com DDD |
| `endereco_entrega` | Endereço completo |
| `bairro` | Bairro |

## Impacto

Qualquer cliente pode abrir o DevTools, copiar a chave do próprio `.exe` dele e executar:

```js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://errczksxtizgpmjzfhnv.supabase.co',
  'sb_publishable_MmLNWGDwYO0fVxVUC8lCEA_pU113fNw'
);
const { data } = await supabase.from('pedidos').select('*'); // TODOS os clientes
```

Resultado: vazamento da base completa de pedidos dos **outros** estabelecimentos — nome, telefone e endereço de consumidores.

Além disso, `FOR ALL` com `WITH CHECK (true)` permite **escrita**: um cliente pode apagar pedidos, alterar cardápios ouPrices de concorrentes.

---

## Correções possíveis

### Opção A — Proxy no servidor (recomendada)

O cliente nunca fala com o Supabase diretamente. Um **Edge Function** com a chave `service_role` (que fica no servidor) aplica o filtro por `cliente_id`:

```js
// supabase/functions/delivery-api/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!   // NUNCA vai para o .exe
);

Deno.serve(async (req) => {
  const clienteId = new URL(req.url).searchParams.get('clienteId');
  // ...
  const { data } = await supabase
    .from('pedidos')
    .select('*')
    .eq('cliente_id', clienteId);             // filtro aplicado no servidor
  return Response.json(data);
});
```

No cliente, `SUPABASE_URL`/`SUPABASE_KEY` passam a apontar para a Edge Function, e `clienteId` vem do `config_delivery.json`.

**Prós:** isolamento real, chave `service_role` nunca sai do servidor.
**Contras:** exige migrar as ~40 chamadas de `database.js` para HTTP; adiciona latência.

### Opção B — JWT com claim `cliente_id`

Manter o acesso direto, mas trocar a chave `anon` por um **token do Supabase Auth** que carrega o `cliente_id`, e apertar as políticas:

```sql
CREATE POLICY "pedidos_isolado" ON public.pedidos
  FOR ALL
  USING  ((auth.jwt() ->> 'cliente_id') = cliente_id)
  WITH CHECK ((auth.jwt() ->> 'cliente_id') = cliente_id);
```

O `cliente_id` entra no token via um **custom access token hook** ou uma Edge Function de login.

**Prós:** mantém o código atual quase intacto.
**Contras:** o token ainda fica no disco do cliente (pode ser reutilizado até expirar); exige revogar tokens no desligamento do cliente.

### Independente da opção escolhida

Independentemente do isolamento, ainda recomendo:

1. **Uma chave `anon` distinta por cliente** (o Supabase permite criar várias chaves), o que permite revogar o acesso de um cliente específico sem afetar os outros.
2. **Auditar os dados já expostos** — se o pacote com a sessão do WhatsApp chegou a ser enviado a alguém, considere que seu WhatsApp e os pedidos do Bom Sabor podem ter sido acessados.
3. **Rotacionar a chave atual** depois de migrar para a Opção A.

---

## Nota sobre o `.exe`

Enquanto isso não for corrigido, o `.exe` distribuído é, por definição, um cliente com acesso total ao banco. Isso não é corrigível por ofuscação — a chave precisa sair de dentro do artefato entregue ao cliente.