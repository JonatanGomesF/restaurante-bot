// =====================================================================
// 🔐 EDGE FUNCTION — delivery-api
// Proxy único entre o DeliveryBot.exe e o Postgres.
//
// POR QUE EXISTE:
//   A chave `anon` do Supabase é pública por definição (o prefixo
//   sb_publishable_ indica isso) e, com as políticas RLS atuais
//   (USING (true)), ela daria leitura/escrita em TODOS os clientes.
//   Aqui a chave `service_role` fica exclusivamente no servidor.
//   O .exe do cliente carrega apenas uma chave de API do próprio
//   estabelecimento, identificada aqui e convertida em `cliente_id`.
//
// O cliente NUNCA envia `cliente_id`. Ele é derivado da chave,
// o que elimina qualquer possibilidade de acessar outro tenant.
//
// DEPLOY:
//   supabase functions deploy delivery-api --no-verify-jwt
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Cliente privilegiado: service_role NUNCA sai do servidor.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

// Tabela `clientes` não tem coluna cliente_id — o isolamento é pela PK.
const TABELAS_SEM_CLIENTE_ID = new Set(['clientes']);

// Whitelist: nenhuma tabela fora desta lista é acessível.
const TABELAS_PERMITIDAS = new Set([
  'clientes',
  'pedidos',
  'cardapio',
  'categorias',
  'opcoes_extras',
  'conversas',
  'mensagens_bot',
  'configuracoes_extras'
]);

const OPERACOES_PERMITIDAS = new Set(['select', 'insert', 'update', 'upsert', 'delete']);

// Colunas que o cliente pode filtrar/ordenar. `cliente_id` é ignorado
// de propósito — o filtro é sempre forjado aqui no servidor.
const COLUNAS_PERMITIDAS = new Set([
  'id', 'codigo', 'data', 'horario', 'status', 'origem', 'tipo_entrega',
  'telefone', 'chave', 'tipo', 'item_id', 'categoria_id', 'opcao_id',
  'categoria', 'nome', 'turno', 'ativo', 'bairro', 'forma_pagamento',
  'created_at', 'criado_em', 'atualizado_em', 'updated_at'
]);

const OPS_FILTRO = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'like', 'is']);

type Filtro = { coluna: string; op: string; valor: unknown };

interface Req {
  tabela: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  colunas?: string;
  filtros?: Filtro[];
  dados?: unknown;
  onConflict?: string;
  limit?: number;
  order?: { coluna: string; desc: boolean };
  single?: boolean;
  maybeSingle?: boolean;
}

function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-key, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}

// Converte a chave do cliente em cliente_id. Retorna null se inválida.
async function resolverClienteId(chave: string | null): Promise<string | null> {
  if (!chave) return null;

  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chave));
  const hex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const { data, error } = await supabase
    .from('delivery_api_keys')
    .select('id, cliente_id, ativo')
    .eq('chave_hash', hex)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.ativo) return null;

  // Registro de uso (best effort, não bloqueia a requisição)
  supabase
    .from('delivery_api_keys')
    .update({ ultimo_uso: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}, () => {});

  return data.cliente_id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return resposta({}, 204);

  if (req.method !== 'POST') {
    return resposta({ erro: 'Método não permitido' }, 405);
  }

  // 1) Autenticação pela chave do cliente
  const chave = req.headers.get('x-client-key');
  const clienteId = await resolverClienteId(chave);
  if (!clienteId) {
    return resposta(
      { erro: 'Chave de API inválida, inativa ou ausente. Verifique o config_delivery.json.' },
      401
    );
  }

  // 2) Validação da requisição
  let body: Req;
  try {
    body = await req.json();
  } catch {
    return resposta({ erro: 'Corpo da requisição inválido' }, 400);
  }

  const { tabela, op } = body;

  if (!TABELAS_PERMITIDAS.has(tabela)) {
    return resposta({ erro: `Tabela não permitida: ${tabela}` }, 400);
  }
  if (!OPERACOES_PERMITIDAS.has(op)) {
    return resposta({ erro: `Operação não permitida: ${op}` }, 400);
  }

  // Nunca aceita cliente_id do cliente: é sempre o derivado da chave.
  const temColunaCliente = !TABELAS_SEM_CLIENTE_ID.has(tabela);

  try {
    // 3) Monta a query aplicando o filtro de tenant no servidor
    let q = supabase.from(tabela);

    if (temColunaCliente) {
      q = q.eq('cliente_id', clienteId);
    } else {
      q = q.eq('id', clienteId);
    }

    // Filtros enviados pelo cliente (whitelist de colunas e operadores)
    for (const f of body.filtros ?? []) {
      if (f.coluna === 'cliente_id') continue;          // ignorado de propósito
      if (!COLUNAS_PERMITIDAS.has(f.coluna)) continue;   // coluna não permitida
      if (!OPS_FILTRO.has(f.op)) continue;               // operador não permitido

      const alvo: Record<string, unknown> = q;
      (alvo as any)[f.op](f.coluna, f.valor);
    }

    if (body.order && COLUNAS_PERMITIDAS.has(body.order.coluna)) {
      q = q.order(body.order.coluna, { ascending: !body.order.desc });
    }
    if (typeof body.limit === 'number' && body.limit > 0 && body.limit <= 1000) {
      q = q.limit(body.limit);
    }

    // 4) Executa a operação
    let resultado: any;
    switch (op) {
      case 'select':
        resultado = body.colunas ? await q.select(body.colunas) : await q.select('*');
        break;

      case 'insert':
        resultado = await q.insert(forcarTenant(body.dados, clienteId, temColunaCliente));
        break;

      case 'upsert':
        resultado = await q.upsert(
          forcarTenant(body.dados, clienteId, temColunaCliente),
          body.onConflict ? { onConflict: body.onConflict } : undefined
        );
        break;

      case 'update':
        resultado = await q.update(forcarTenant(body.dados, clienteId, temColunaCliente));
        break;

      case 'delete':
        resultado = await q.delete();
        break;
    }

    // 5) Envolve no mesmo formato do supabase-js, para o .exe não mudar
    if (resultado.error) {
      return resposta({ error: resultado.error }, 400);
    }

    let data = resultado.data;
    if (body.single) {
      if (!data || data.length === 0) {
        return resposta({ data: null, error: { message: 'Nenhum registro encontrado' } }, 400);
      }
      data = data[0];
    } else if (body.maybeSingle) {
      data = data && data.length ? data[0] : null;
    }

    return resposta({ data, error: null });
  } catch (e) {
    return resposta({ erro: (e as Error).message }, 500);
  }
});

// Garante que o cliente não consiga escrever em outro tenant,
// mesmo que tente mandar `cliente_id` no corpo.
function forcarTenant(dados: unknown, clienteId: string, temColunaCliente: boolean): any {
  if (Array.isArray(dados)) {
    return dados.map(d => {
      const copia = { ...d };
      if (temColunaCliente) copia.cliente_id = clienteId;
      else copia.id = clienteId;
      return copia;
    });
  }
  const copia = { ...(dados as Record<string, unknown>) };
  if (temColunaCliente) copia.cliente_id = clienteId;
  else copia.id = clienteId;
  return copia;
}