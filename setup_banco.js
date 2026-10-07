/**
 * =====================================================================
 * SCRIPT DE SETUP DO BANCO - delivery_platform
 * Execute: node setup_banco.js
 *
 * Este script cria todas as tabelas necessárias no Supabase e
 * provisiona o primeiro cliente definido em config_delivery.json
 * =====================================================================
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://errczksxtizgpmjzfhnv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MmLNWGDwYO0fVxVUC8lCEA_pU113fNw';

// Lê config do cliente
let CLIENTE_ID   = 'delivery_bot';
let NOME_CLIENTE = 'Meu Delivery';
try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config_delivery.json'), 'utf8'));
    if (cfg.clienteId)           CLIENTE_ID   = cfg.clienteId.trim().toLowerCase().replace(/\s+/g, '_');
    if (cfg.nomeEstabelecimento) NOME_CLIENTE = cfg.nomeEstabelecimento.trim();
} catch (e) {}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// SQL para criar as tabelas (executado via Management API se tiver service_role, ou manual)
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.clientes (
    id TEXT PRIMARY KEY,
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
    plano TEXT DEFAULT 'basico',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pedidos (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nome_cliente TEXT NOT NULL DEFAULT '',
    telefone TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    horario TEXT NOT NULL,
    itens JSONB NOT NULL DEFAULT '[]'::jsonb,
    servico TEXT DEFAULT '',
    subtotal NUMERIC(10, 2) DEFAULT 0.00,
    taxa_entrega NUMERIC(10, 2) DEFAULT 0.00,
    total NUMERIC(10, 2) DEFAULT 0.00,
    tipo_entrega TEXT DEFAULT 'delivery',
    endereco_entrega TEXT DEFAULT '',
    bairro TEXT DEFAULT '',
    forma_pagamento TEXT DEFAULT 'PIX',
    troco_para NUMERIC(10, 2) DEFAULT NULL,
    observacoes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendente',
    origem TEXT DEFAULT 'whatsapp',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    cancelado_em TIMESTAMPTZ DEFAULT NULL,
    concluido_em TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.cardapio (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'geral',
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    preco NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    turno TEXT DEFAULT 'todos',
    icone TEXT DEFAULT '🍽️',
    ativo BOOLEAN DEFAULT TRUE,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cliente_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.categorias (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    categoria_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    icone TEXT DEFAULT '🍽️',
    turno TEXT DEFAULT 'todos',
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(cliente_id, categoria_id)
);

CREATE TABLE IF NOT EXISTS public.opcoes_extras (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    opcao_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    preco NUMERIC(10, 2) DEFAULT 0.00,
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(cliente_id, tipo, opcao_id)
);

CREATE TABLE IF NOT EXISTS public.conversas (
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    estado JSONB NOT NULL DEFAULT '{}'::jsonb,
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cliente_id, telefone)
);

CREATE TABLE IF NOT EXISTS public.mensagens_bot (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,
    conteudo TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cliente_id, chave)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_extras (
    id SERIAL PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    chave TEXT NOT NULL,
    valor JSONB NOT NULL DEFAULT 'null'::jsonb,
    descricao TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cliente_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_data ON public.pedidos(cliente_id, data, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_telefone ON public.pedidos(cliente_id, telefone);
CREATE INDEX IF NOT EXISTS idx_cardapio_cliente ON public.cardapio(cliente_id, categoria, ativo);
CREATE INDEX IF NOT EXISTS idx_categorias_cliente ON public.categorias(cliente_id, ordem);
CREATE INDEX IF NOT EXISTS idx_opcoes_cliente_tipo ON public.opcoes_extras(cliente_id, tipo);
CREATE INDEX IF NOT EXISTS idx_conversas_cliente ON public.conversas(cliente_id, telefone);
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente ON public.mensagens_bot(cliente_id, chave);
CREATE INDEX IF NOT EXISTS idx_config_extras_cliente ON public.configuracoes_extras(cliente_id, chave);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardapio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opcoes_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_bot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_clientes" ON public.clientes;
DROP POLICY IF EXISTS "anon_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "anon_cardapio" ON public.cardapio;
DROP POLICY IF EXISTS "anon_categorias" ON public.categorias;
DROP POLICY IF EXISTS "anon_opcoes_extras" ON public.opcoes_extras;
DROP POLICY IF EXISTS "anon_conversas" ON public.conversas;
DROP POLICY IF EXISTS "anon_mensagens_bot" ON public.mensagens_bot;
DROP POLICY IF EXISTS "anon_config_extras" ON public.configuracoes_extras;

CREATE POLICY "anon_clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_cardapio" ON public.cardapio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_categorias" ON public.categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_opcoes_extras" ON public.opcoes_extras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_conversas" ON public.conversas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_mensagens_bot" ON public.mensagens_bot FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_config_extras" ON public.configuracoes_extras FOR ALL USING (true) WITH CHECK (true);
`;

async function testarConexao() {
    console.log('\n🔍 Testando conexão com o Supabase...');
    const { data, error } = await supabase.from('clientes').select('id').limit(1);
    if (error && error.code === '42P01') {
        console.log('⚠️  Tabelas ainda não existem. É necessário aplicar o schema manualmente.');
        return false;
    }
    if (error) {
        console.log('❌ Erro de conexão:', error.message);
        return false;
    }
    console.log('✅ Conexão OK! Tabelas já existem.');
    return true;
}

async function provisionarCliente() {
    console.log(`\n🏪 Provisionando cliente: "${CLIENTE_ID}" (${NOME_CLIENTE})...`);

    // Verifica se já existe
    const { data: existe } = await supabase.from('clientes').select('id').eq('id', CLIENTE_ID).single();
    if (existe) {
        console.log(`ℹ️  Cliente "${CLIENTE_ID}" já existe no banco.`);
        return true;
    }

    const { error } = await supabase.from('clientes').insert({
        id:                 CLIENTE_ID,
        nome:               NOME_CLIENTE,
        telefone_dono:      '',
        chave_pix:          '',
        endereco:           '',
        taxa_entrega:       5.00,
        tempo_estimado_min: 30,
        tempo_estimado_max: 50,
        horario_almoco:     '11:00 às 15:00',
        horario_jantar:     '18:00 às 23:30',
        fechado_hoje:       false,
        motivo_fechado:     '',
        ativo:              true,
        plano:              'basico',
        created_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString()
    });

    if (error) {
        console.error('❌ Erro ao criar cliente:', error.message);
        return false;
    }

    console.log(`🎉 Cliente "${CLIENTE_ID}" criado com sucesso!`);

    // Provisiona cardápio padrão
    await provisionarCardapio();
    await provisionarCategorias();
    await provisionarOpcoes();
    return true;
}

async function provisionarCardapio() {
    const DEFAULT_CARDAPIO = [
        { id:1,  categoria:'marmitex', nome:'Marmitex P (Pequena)',              descricao:'Arroz branco, feijão caseiro, 1 opção de carne e guarnição do dia',                preco:18.00, turno:'dia',   icone:'🍱', ativo:true },
        { id:2,  categoria:'marmitex', nome:'Marmitex M (Média - Mais Vendida)', descricao:'Arroz branco, feijão fresquinho, carne generosa, farofa e guarnições',            preco:22.00, turno:'dia',   icone:'🍱', ativo:true },
        { id:3,  categoria:'marmitex', nome:'Marmitex G (Grande)',               descricao:'Porção reforçada: Arroz, feijão, 2 carnes à sua escolha, salada e acompanhamentos', preco:26.00, turno:'dia',  icone:'🍛', ativo:true },
        { id:7,  categoria:'pizza',    nome:'Pizza Calabresa Especial',           descricao:'Molho artesanal, mussarela, calabresa fatiada crocante, cebola e azeitonas',       preco:42.00, turno:'noite', icone:'🍕', ativo:true },
        { id:8,  categoria:'pizza',    nome:'Pizza Mussarela Tradicional',        descricao:'Molho de tomate especial, camada farta de mussarela derretida e orégano',         preco:40.00, turno:'noite', icone:'🧀', ativo:true },
        { id:15, categoria:'bebida',   nome:'Coca-Cola 2 Litros (Gelada)',        descricao:'Refrigerante garrafa 2L pet bem gelada',                                           preco:14.00, turno:'todos', icone:'🥤', ativo:true },
        { id:19, categoria:'bebida',   nome:'Água Mineral 500ml',                 descricao:'Sem gás ou com gás',                                                              preco:4.00,  turno:'todos', icone:'💧', ativo:true }
    ];
    const rows = DEFAULT_CARDAPIO.map(i => ({ cliente_id:CLIENTE_ID, item_id:i.id, categoria:i.categoria, nome:i.nome, descricao:i.descricao||'', preco:i.preco, turno:i.turno||'todos', icone:i.icone||'🍽️', ativo:i.ativo!==false, ordem:i.id }));
    const { error } = await supabase.from('cardapio').upsert(rows, { onConflict: 'cliente_id,item_id' });
    if (error) console.warn('  ⚠️  Cardápio:', error.message);
    else console.log('  📋 Cardápio padrão criado.');
}

async function provisionarCategorias() {
    const cats = [
        { id:'marmitex', nome:'Marmitex do Dia (Almoço)',          icone:'🍱', turno:'dia',   ordem:1 },
        { id:'pizza',    nome:'Pizzas Artesanais (Jantar & Noite)', icone:'🍕', turno:'noite', ordem:2 },
        { id:'bebida',   nome:'Bebidas & Extras',                   icone:'🥤', turno:'todos', ordem:3 }
    ];
    const rows = cats.map(c => ({ cliente_id:CLIENTE_ID, categoria_id:c.id, nome:c.nome, icone:c.icone, turno:c.turno, ordem:c.ordem, ativo:true }));
    const { error } = await supabase.from('categorias').upsert(rows, { onConflict: 'cliente_id,categoria_id' });
    if (error) console.warn('  ⚠️  Categorias:', error.message);
    else console.log('  📂 Categorias padrão criadas.');
}

async function provisionarOpcoes() {
    const carnes = [
        { id:1, nome:'🥩 Bife Bovino Acebolado' }, { id:2, nome:'🍗 Peito de Frango Grelhado' },
        { id:3, nome:'🥓 Bisteca Suína na Brasa' }, { id:4, nome:'🧀 Filé de Frango à Parmegiana' }
    ].map(o => ({ cliente_id:CLIENTE_ID, tipo:'carne', opcao_id:o.id, nome:o.nome, preco:0, ativo:true }));

    const bordas = [
        { id:1, nome:'Tradicional (Sem borda extra)', preco:0 }, { id:2, nome:'Borda de Catupiry Original', preco:8 },
        { id:3, nome:'Borda de Cheddar Cremoso', preco:8 },      { id:4, nome:'Borda de Chocolate ao Leite', preco:10 }
    ].map(o => ({ cliente_id:CLIENTE_ID, tipo:'borda', opcao_id:o.id, nome:o.nome, preco:o.preco, ativo:true }));

    const { error } = await supabase.from('opcoes_extras').upsert([...carnes, ...bordas], { onConflict: 'cliente_id,tipo,opcao_id' });
    if (error) console.warn('  ⚠️  Opções extras:', error.message);
    else console.log('  🥩 Opções de carnes e bordas criadas.');
}

async function main() {
    console.log('═══════════════════════════════════════════════');
    console.log('   🚀 SETUP DO BANCO — DELIVERY PLATFORM');
    console.log('═══════════════════════════════════════════════');
    console.log(`   🌐 Banco: ${SUPABASE_URL}`);
    console.log(`   🏪 Cliente: ${CLIENTE_ID}`);
    console.log('═══════════════════════════════════════════════\n');

    const tabelasExistem = await testarConexao();

    if (!tabelasExistem) {
        console.log('\n📋 PASSO NECESSÁRIO — Cole o SQL abaixo no SQL Editor do Supabase:');
        console.log('   https://supabase.com/dashboard/project/errczksxtizgpmjzfhnv/sql/new\n');
        console.log('─── SQL PARA COPIAR ──────────────────────────────────────────────');
        console.log(SCHEMA_SQL);
        console.log('──────────────────────────────────────────────────────────────────');
        console.log('\nApós executar o SQL, rode novamente: node setup_banco.js\n');
        process.exit(0);
    }

    await provisionarCliente();

    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ Setup concluído! O bot está pronto para rodar.');
    console.log('   Execute: npm start');
    console.log('═══════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('❌ Erro fatal no setup:', err.message);
    process.exit(1);
});
