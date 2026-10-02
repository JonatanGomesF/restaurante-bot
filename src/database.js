const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// =====================================================================
// Diretório base da aplicação (compatível com pkg .exe e modo dev)
// =====================================================================
const APP_DIR = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');

// Configuração de Conexão Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mctppbkmyofeqfcursuz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_TBa-V_DmktUzSWkyc-Xl4A_ebaWcpee';

// ID padrão do Restaurante
let RESTAURANTE_ID = 'restaurante_principal';

const CONFIG_PATH = path.join(APP_DIR, 'config_salao.json');
const DB_PATH = path.join(APP_DIR, 'agendamentos.json');

try {
    if (fs.existsSync(CONFIG_PATH)) {
        const extraConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        if (extraConfig && (extraConfig.restauranteId || extraConfig.barbeariaId)) {
            RESTAURANTE_ID = extraConfig.restauranteId || extraConfig.barbeariaId;
        }
    }
} catch (e) {}

const DEFAULT_CARDAPIO = [
    // --- MARMITEX (ALMOÇO / DIA) ---
    {
        id: 1,
        categoria: 'marmitex',
        nome: 'Marmitex P (Pequena)',
        descricao: 'Arroz branco, feijão caseiro, 1 opção de carne e guarnição do dia',
        preco: 18.00,
        turno: 'dia',
        icone: '🍱',
        ativo: true
    },
    {
        id: 2,
        categoria: 'marmitex',
        nome: 'Marmitex M (Média - Mais Vendida)',
        descricao: 'Arroz branco, feijão fresquinho, carne generosa, farofa e guarnições',
        preco: 22.00,
        turno: 'dia',
        icone: '🍱',
        ativo: true
    },
    {
        id: 3,
        categoria: 'marmitex',
        nome: 'Marmitex G (Grande)',
        descricao: 'Porção reforçada: Arroz, feijão, 2 carnes à sua escolha, salada e acompanhamentos',
        preco: 26.00,
        turno: 'dia',
        icone: '🍛',
        ativo: true
    },
    {
        id: 4,
        categoria: 'marmitex',
        nome: 'Marmitex Executiva Especial',
        descricao: 'Bife de Picanha na chapa ou Filé Parmegiana com fritas crocantes e salada',
        preco: 32.00,
        turno: 'dia',
        icone: '🥩',
        ativo: true
    },
    {
        id: 5,
        categoria: 'marmitex',
        nome: 'Marmitex Fit & Saudável',
        descricao: 'Arroz integral, peito de frango grelhado suculento e mix de legumes cozidos no vapor',
        preco: 24.00,
        turno: 'dia',
        icone: '🥗',
        ativo: true
    },
    {
        id: 6,
        categoria: 'marmitex',
        nome: 'Marmitex Feijoada Completa (Especial)',
        descricao: 'Feijoada tradicional com carnes selecionadas, couve refogada, farofa e torresmo',
        preco: 28.00,
        turno: 'dia',
        icone: '🍲',
        ativo: true
    },

    // --- PIZZAS (JANTAR / NOITE) ---
    {
        id: 7,
        categoria: 'pizza',
        nome: 'Pizza Calabresa Especial',
        descricao: 'Molho artesanal, mussarela, calabresa fatiada crocante, cebola e azeitonas pretas',
        preco: 42.00,
        turno: 'noite',
        icone: '🍕',
        ativo: true
    },
    {
        id: 8,
        categoria: 'pizza',
        nome: 'Pizza Mussarela Tradicional',
        descricao: 'Molho de tomate especial, camada farta de mussarela derretida, rodelas de tomate e orégano',
        preco: 40.00,
        turno: 'noite',
        icone: '🧀',
        ativo: true
    },
    {
        id: 9,
        categoria: 'pizza',
        nome: 'Pizza Frango com Catupiry',
        descricao: 'Frango desfiado temperado com ervas finas, legítimo Catupiry cremoso e milho',
        preco: 48.00,
        turno: 'noite',
        icone: '🍗',
        ativo: true
    },
    {
        id: 10,
        categoria: 'pizza',
        nome: 'Pizza Portuguesa Completa',
        descricao: 'Mussarela, presunto selecionado, ovos cozidos, ervilhas, cebola, palmito e azeitonas',
        preco: 46.00,
        turno: 'noite',
        icone: '🍕',
        ativo: true
    },
    {
        id: 11,
        categoria: 'pizza',
        nome: 'Pizza Quatro Queijos Nobres',
        descricao: 'Mussarela, provolone defumado, parmesão ralado e requeijão cremoso',
        preco: 52.00,
        turno: 'noite',
        icone: '🧀',
        ativo: true
    },
    {
        id: 12,
        categoria: 'pizza',
        nome: 'Pizza Margherita da Casa',
        descricao: 'Mussarela, fatias de tomate fresco, folhas de manjericão aromático e azeite extravirgem',
        preco: 46.00,
        turno: 'noite',
        icone: '🌿',
        ativo: true
    },
    {
        id: 13,
        categoria: 'pizza',
        nome: 'Pizza Doce Brigadeiro com Morangos',
        descricao: 'Chocolate ao leite cremoso, granulado gourmet e fatias de morangos frescos',
        preco: 42.00,
        turno: 'noite',
        icone: '🍫',
        ativo: true
    },
    {
        id: 14,
        categoria: 'pizza',
        nome: 'Pizza Doce Banana com Canela',
        descricao: 'Fatias de banana caramelizadas, mussarela suave, leite condensado e canela em pó',
        preco: 38.00,
        turno: 'noite',
        icone: '🍌',
        ativo: true
    },

    // --- BEBIDAS E EXTRAS ---
    {
        id: 15,
        categoria: 'bebida',
        nome: 'Coca-Cola 2 Litros (Gelada)',
        descricao: 'Refrigerante garrafa 2L pet bem gelada',
        preco: 14.00,
        turno: 'todos',
        icone: '🥤',
        ativo: true
    },
    {
        id: 16,
        categoria: 'bebida',
        nome: 'Coca-Cola Lata 350ml',
        descricao: 'Lata 350ml geladinha',
        preco: 6.00,
        turno: 'todos',
        icone: '🥤',
        ativo: true
    },
    {
        id: 17,
        categoria: 'bebida',
        nome: 'Guaraná Antarctica 2 Litros',
        descricao: 'Refrigerante 2L pet bem gelado',
        preco: 12.00,
        turno: 'todos',
        icone: '🥤',
        ativo: true
    },
    {
        id: 18,
        categoria: 'bebida',
        nome: 'Suco Natural da Fruta 500ml',
        descricao: 'Sabores: Laranja, Maracujá ou Limonada Suíça',
        preco: 8.00,
        turno: 'todos',
        icone: '🍹',
        ativo: true
    },
    {
        id: 19,
        categoria: 'bebida',
        nome: 'Água Mineral 500ml',
        descricao: 'Sem gás ou com gás',
        preco: 4.00,
        turno: 'todos',
        icone: '💧',
        ativo: true
    },
    {
        id: 20,
        categoria: 'extra',
        nome: 'Porção de Batata Frita Crocante',
        descricao: 'Porção grande de batatas fritas sequinhas e crocantes com cheddar e bacon opcional',
        preco: 22.00,
        turno: 'todos',
        icone: '🍟',
        ativo: true
    }
];

const OPCOES_CARNES_MARMITEX = [
    '🥩 Bife Bovino Acebolado',
    '🍗 Peito de Frango Grelhado',
    '🥓 Bisteca Suína na Brasa',
    '🧀 Filé de Frango à Parmegiana',
    '🐟 Filé de Peixe Empanado',
    '🍳 Omelete com Queijo e Tomate'
];

const DEFAULT_CONFIG = {
    nomeRestaurante: "Restaurante Bom Sabor",
    nomeSalao: "Restaurante Bom Sabor", // retrocompatibilidade
    slogan: "O melhor sabor da cidade no almoço e no jantar!",
    numeroDono: "5515974062762@c.us",
    chavePix: "15974062762",
    endereco: "Rua das Delícias, 123 - Centro",
    taxaEntregaPadrao: 5.00,
    tempoEstimadoMin: 30,
    tempoEstimadoMax: 50,
    horarioAlmoco: "11:00 às 15:00",
    horarioJantar: "18:00 às 23:30",
    fechadoHoje: false,
    motivoFechado: "Descanso semanal da equipe",
    dataFechadaManual: null,
    diasSemana: {
        0: "Domingo",
        1: "Segunda",
        2: "Terça",
        3: "Quarta",
        4: "Quinta",
        5: "Sexta",
        6: "Sábado"
    },
    cardapio: DEFAULT_CARDAPIO,
    opcoesCarnes: OPCOES_CARNES_MARMITEX,
    servicos: DEFAULT_CARDAPIO.map(item => ({
        id: item.id,
        nome: item.nome,
        preco: item.preco,
        duracao: item.categoria === 'marmitex' ? 'Almoço' : 'Jantar',
        icone: item.icone
    }))
};

// Instância do Cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// Cache em memória
let cacheLocal = {
    config: DEFAULT_CONFIG,
    pedidos: [],
    agendamentos: [], // retrocompatibilidade
    conversa: {}
};

// Carrega os dados do arquivo local
function carregarDados() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            
            const config = { ...DEFAULT_CONFIG, ...(parsed.config || {}) };
            // Garante que o cardápio esteja preenchido
            if (!config.cardapio || config.cardapio.length === 0) {
                config.cardapio = DEFAULT_CARDAPIO;
            }
            if (!config.nomeRestaurante) {
                config.nomeRestaurante = "Restaurante Bom Sabor";
            }
            config.nomeSalao = config.nomeRestaurante;

            const pedidos = Array.isArray(parsed.pedidos) ? parsed.pedidos : (Array.isArray(parsed.agendamentos) ? parsed.agendamentos : []);

            cacheLocal = {
                config: config,
                pedidos: pedidos,
                agendamentos: pedidos,
                conversa: parsed.conversa || {}
            };
            return cacheLocal;
        }
    } catch (err) {
        console.error("⚠️ Erro ao ler agendamentos.json:", err.message);
    }

    cacheLocal = {
        config: DEFAULT_CONFIG,
        pedidos: [],
        agendamentos: [],
        conversa: {}
    };
    salvarDados(cacheLocal);
    return cacheLocal;
}

// Salva dados no arquivo JSON local
function salvarDados(data) {
    try {
        cacheLocal = data;
        if (!cacheLocal.pedidos && cacheLocal.agendamentos) {
            cacheLocal.pedidos = cacheLocal.agendamentos;
        }
        if (!cacheLocal.agendamentos && cacheLocal.pedidos) {
            cacheLocal.agendamentos = cacheLocal.pedidos;
        }
        fs.writeFileSync(DB_PATH, JSON.stringify(cacheLocal, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error("❌ Erro ao salvar dados no JSON local:", err.message);
        return false;
    }
}

// Inicializa o cache
carregarDados();

// Sincronização com Supabase (com fallback gracioso)
async function sincronizarComSupabase() {
    try {
        // 1. Busca Restaurante
        const { data: restData } = await supabase
            .from('barbearias')
            .select('*')
            .eq('id', RESTAURANTE_ID)
            .single();

        if (restData) {
            cacheLocal.config.nomeRestaurante = restData.nome || cacheLocal.config.nomeRestaurante;
            cacheLocal.config.nomeSalao = cacheLocal.config.nomeRestaurante;
            cacheLocal.config.numeroDono = restData.telefone_dono || cacheLocal.config.numeroDono;
            cacheLocal.config.chavePix = restData.chave_pix || cacheLocal.config.chavePix;
            cacheLocal.config.endereco = restData.endereco || cacheLocal.config.endereco;
            cacheLocal.config.fechadoHoje = restData.fechado_hoje !== undefined ? restData.fechado_hoje : cacheLocal.config.fechadoHoje;
            cacheLocal.config.motivoFechado = restData.motivo_fechado || cacheLocal.config.motivoFechado;
        } else {
            // Insere cadastro padrão se não existir
            await supabase.from('barbearias').upsert({
                id: RESTAURANTE_ID,
                nome: cacheLocal.config.nomeRestaurante,
                telefone_dono: cacheLocal.config.numeroDono,
                chave_pix: cacheLocal.config.chavePix,
                endereco: cacheLocal.config.endereco,
                fechado_hoje: false,
                motivo_fechado: cacheLocal.config.motivoFechado
            }).catch(() => {});
        }

        // 2. Busca Pedidos do Supabase
        const { data: pedData } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('barbearia_id', RESTAURANTE_ID);

        if (pedData && pedData.length > 0) {
            const mapped = pedData.map(a => ({
                id: a.id,
                codigo: a.id.startsWith('ped_') ? '#' + a.id.substr(-4).toUpperCase() : `#PED-${a.id.substr(0, 4)}`,
                cliente: a.cliente,
                telefone: a.telefone,
                data: a.data,
                horario: a.horario,
                itens: a.servico ? [{ nome: a.servico, qtd: 1, preco: Number(a.preco) }] : [],
                servico: a.servico,
                total: Number(a.preco),
                preco: Number(a.preco),
                status: a.status || 'pendente',
                tipoEntrega: 'delivery',
                enderecoEntrega: '',
                formaPagamento: 'PIX / Cartão',
                origem: a.origem || 'whatsapp',
                criadoEm: a.criado_em,
                canceladoEm: a.cancelado_em,
                concluidoEm: a.concluido_em
            }));

            // Combina com cache local sem duplicatas
            const idsExistentes = new Set(mapped.map(m => m.id));
            const novosDoCache = (cacheLocal.pedidos || []).filter(p => !idsExistentes.has(p.id));
            cacheLocal.pedidos = [...mapped, ...novosDoCache];
            cacheLocal.agendamentos = cacheLocal.pedidos;
            salvarDados(cacheLocal);
        }

        return true;
    } catch (err) {
        return false;
    }
}

async function inicializarDatabase() {
    console.log(`🔌 Conectando ao Banco (Restaurante ID: ${RESTAURANTE_ID})...`);
    const ok = await sincronizarComSupabase();
    if (ok) {
        console.log(`✅ [NUVEM RESTAURANTE] Dados sincronizados com sucesso!`);
    } else {
        console.log(`ℹ️ [OFFLINE / LOCAL] Operando com cardápio e dados locais.`);
    }

    setInterval(() => {
        sincronizarComSupabase().catch(() => {});
    }, 20000);
}

// Retorna data formatada no fuso local (YYYY-MM-DD)
function formatarDataLocal(d = new Date()) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Verifica se o restaurante está marcado como fechado hoje
function isFechadoHoje(dados = null) {
    if (!dados) dados = cacheLocal;
    const config = dados.config || {};
    const hojeStr = formatarDataLocal(new Date());

    if (config.fechadoHoje === true) {
        if (!config.dataFechadaManual || config.dataFechadaManual === hojeStr) {
            return true;
        }
    }
    return false;
}

// Identifica o turno atual com base na hora do dia
// - Dia (10:00 às 15:30): Marmitex (Almoço)
// - Noite (17:30 às 23:59): Pizza (Jantar)
// - Outros horários: Aberto para pedidos programados / consulta
function getTurnoAtual() {
    const agora = new Date();
    const hora = agora.getHours();
    const min = agora.getMinutes();
    const tempoMinutos = hora * 60 + min;

    // Almoço: das 10:30 às 15:30 (630 a 930 minutos)
    if (tempoMinutos >= 630 && tempoMinutos <= 930) {
        return {
            tipo: 'dia',
            nome: 'Almoço (Marmitex)',
            icone: '🍱',
            descricao: 'Marmitex fresquinhos saindo quentinhos do fogão!'
        };
    }

    // Jantar / Pizzaria: das 17:30 às 23:59 (1050 a 1439 minutos)
    if (tempoMinutos >= 1050 || tempoMinutos <= 60) {
        return {
            tipo: 'noite',
            nome: 'Jantar & Pizzaria',
            icone: '🍕',
            descricao: 'Pizzas artesanais quentinhas assadas no capricho!'
        };
    }

    return {
        tipo: 'geral',
        nome: 'Restaurante Bom Sabor',
        icone: '🍽️',
        descricao: 'Almoço (Marmitex 11h às 15h) e Noite (Pizzas 18h às 23h30)'
    };
}

// Retorna itens do cardápio filtrados por turno ou categoria
function getCardapio(filtro = {}) {
    const dados = cacheLocal;
    let cardapio = dados.config.cardapio || DEFAULT_CARDAPIO;

    if (filtro.categoria) {
        cardapio = cardapio.filter(item => item.categoria === filtro.categoria);
    }
    if (filtro.turno && filtro.turno !== 'todos') {
        cardapio = cardapio.filter(item => item.turno === filtro.turno || item.turno === 'todos');
    }
    if (filtro.apenasAtivos !== false) {
        cardapio = cardapio.filter(item => item.ativo !== false);
    }

    return cardapio;
}

// Criação Atômica de Pedido
function criarPedido({
    cliente,
    telefone,
    itens = [],
    tipoEntrega = 'delivery', // 'delivery' ou 'retirada'
    enderecoEntrega = '',
    bairro = '',
    formaPagamento = 'PIX', // 'PIX', 'Cartão', 'Dinheiro'
    trocoPara = null,
    taxaEntrega = 0,
    observacoes = '',
    origem = 'whatsapp'
}) {
    const dados = cacheLocal;
    const agora = new Date();
    const dataStr = formatarDataLocal(agora);
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isFechadoHoje(dados)) {
        return {
            success: false,
            error: `O restaurante está fechado no momento (${dados.config.motivoFechado || 'Atendimento pausado'}).`,
            codigo: 'RESTAURANTE_FECHADO'
        };
    }

    // Calcula subtotal dos itens
    let subtotal = 0;
    const itensProcessados = itens.map((item, idx) => {
        const preco = Number(item.preco) || 0;
        const qtd = Number(item.qtd) || 1;
        const totalItem = preco * qtd;
        subtotal += totalItem;

        return {
            id: item.id || (idx + 1),
            nome: item.nome,
            qtd: qtd,
            preco: preco,
            total: totalItem,
            observacao: item.observacao || '',
            opcoesCarne: item.opcoesCarne || null,
            borda: item.borda || null
        };
    });

    const taxa = (tipoEntrega === 'delivery') ? (Number(taxaEntrega) || Number(dados.config.taxaEntregaPadrao) || 5.00) : 0;
    const total = subtotal + taxa;

    const numAleatorio = Math.floor(1000 + Math.random() * 9000);
    const idGerado = 'ped_' + Date.now() + '_' + numAleatorio;
    const codigoExibicao = `#PED-${numAleatorio}`;

    const resumoItensTexto = itensProcessados.map(i => `${i.qtd}x ${i.nome}`).join(' + ');

    const novoPedido = {
        id: idGerado,
        codigo: codigoExibicao,
        cliente: cliente || 'Cliente WhatsApp',
        telefone: telefone,
        data: dataStr,
        horario: horaStr,
        itens: itensProcessados,
        servico: resumoItensTexto || 'Pedido Bom Sabor',
        subtotal: subtotal,
        taxaEntrega: taxa,
        total: total,
        preco: total, // compatibilidade
        tipoEntrega: tipoEntrega, // 'delivery' | 'retirada'
        enderecoEntrega: enderecoEntrega || '',
        bairro: bairro || '',
        formaPagamento: formaPagamento,
        trocoPara: trocoPara ? Number(trocoPara) : null,
        observacoes: observacoes || '',
        status: 'pendente', // 'pendente', 'em_preparo', 'saiu_entrega', 'concluido', 'cancelado'
        origem: origem,
        tempoEstimado: `${dados.config.tempoEstimadoMin || 35} a ${dados.config.tempoEstimadoMax || 50} min`,
        criadoEm: agora.toISOString(),
        canceladoEm: null,
        concluidoEm: null
    };

    dados.pedidos.unshift(novoPedido);
    dados.agendamentos = dados.pedidos;

    if (dados.conversa && dados.conversa[telefone]) {
        delete dados.conversa[telefone];
    }

    salvarDados(dados);

    // Persiste no Supabase em segundo plano
    (async () => {
        try {
            await supabase.from('agendamentos').insert({
                id: novoPedido.id,
                barbearia_id: RESTAURANTE_ID,
                cliente: novoPedido.cliente,
                telefone: novoPedido.telefone,
                data: novoPedido.data,
                horario: novoPedido.horario,
                servico: `[${novoPedido.codigo}] ${novoPedido.servico}`,
                preco: novoPedido.total,
                status: novoPedido.status,
                origem: novoPedido.origem,
                criado_em: novoPedido.criadoEm
            });
        } catch (err) {}
    })();

    return {
        success: true,
        pedido: novoPedido,
        agendamento: novoPedido // compatibilidade
    };
}

// Atualiza o status do pedido (Pendente -> Em Preparo -> Saiu para Entrega -> Concluído)
function atualizarStatusPedido(id, novoStatus) {
    const dados = cacheLocal;
    const pedido = dados.pedidos.find(p => p.id === id || p.codigo === id);

    if (!pedido) {
        return { success: false, error: 'Pedido não encontrado.' };
    }

    const agora = new Date().toISOString();
    pedido.status = novoStatus;

    if (novoStatus === 'concluido') {
        pedido.concluidoEm = agora;
    } else if (novoStatus === 'cancelado') {
        pedido.canceladoEm = agora;
    }

    salvarDados(dados);

    // Persiste no Supabase
    (async () => {
        try {
            await supabase
                .from('agendamentos')
                .update({ 
                    status: novoStatus,
                    concluido_em: (novoStatus === 'concluido') ? agora : null,
                    cancelado_em: (novoStatus === 'cancelado') ? agora : null
                })
                .eq('id', pedido.id)
                .eq('barbearia_id', RESTAURANTE_ID);
        } catch (err) {}
    })();

    return { success: true, pedido: pedido, agendamento: pedido };
}

// Cancela pedido
function cancelarPedido(id, telefoneSolicitante = null) {
    const dados = cacheLocal;
    const pedido = dados.pedidos.find(p => 
        (p.id === id || p.codigo === id) &&
        (!telefoneSolicitante || p.telefone === telefoneSolicitante)
    );

    if (!pedido) {
        return { success: false, error: 'Pedido não encontrado ou não pertence a este número.' };
    }

    if (pedido.status === 'concluido' || pedido.status === 'saiu_entrega') {
        return {
            success: false,
            error: 'Este pedido já saiu para entrega ou foi concluído e não pode ser cancelado automaticamente pelo chat.'
        };
    }

    return atualizarStatusPedido(pedido.id, 'cancelado');
}

// Busca pedidos ativos do cliente
function getPedidosCliente(telefone) {
    const dados = cacheLocal;
    return dados.pedidos.filter(p => 
        p.telefone === telefone && 
        p.status !== 'cancelado' &&
        p.status !== 'concluido'
    );
}

// Busca histórico completo de pedidos com filtros
function getTodosPedidos(filtro = {}) {
    const dados = cacheLocal;
    let lista = [...(dados.pedidos || [])];

    if (filtro.data) {
        lista = lista.filter(p => p.data === filtro.data);
    }
    if (filtro.status) {
        lista = lista.filter(p => p.status === filtro.status);
    }
    if (filtro.busca) {
        const b = filtro.busca.toLowerCase();
        lista = lista.filter(p => 
            (p.cliente && p.cliente.toLowerCase().includes(b)) ||
            (p.telefone && p.telefone.includes(b)) ||
            (p.codigo && p.codigo.toLowerCase().includes(b)) ||
            (p.servico && p.servico.toLowerCase().includes(b))
        );
    }

    return lista.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

// Métricas para o Dashboard do Restaurante
function getEstatisticas() {
    const dados = cacheLocal;
    const hoje = formatarDataLocal(new Date());

    const pedidosHoje = dados.pedidos.filter(p => p.data === hoje && p.status !== 'cancelado');
    const pendentes = pedidosHoje.filter(p => p.status === 'pendente' || p.status === 'em_preparo');
    const concluidosHoje = pedidosHoje.filter(p => p.status === 'concluido');
    const faturamentoHoje = pedidosHoje.reduce((acc, curr) => acc + (curr.total || curr.preco || 0), 0);
    const totalGeral = dados.pedidos.filter(p => p.status !== 'cancelado').length;

    return {
        pedidosHoje: pedidosHoje.length,
        pedidosPendentes: pendentes.length,
        pedidosConcluidos: concluidosHoje.length,
        faturamentoHoje: faturamentoHoje,
        totalGeral: totalGeral,
        totalConfirmados: pedidosHoje.length, // compatibilidade
        totalConcluidos: concluidosHoje.length, // compatibilidade
        faturamentoEstimado: faturamentoHoje, // compatibilidade
        agendamentosHoje: pedidosHoje.length // compatibilidade
    };
}

// Gerenciamento de Estado de Conversa
function getEstadoConversa(telefone) {
    const dados = cacheLocal;
    return (dados.conversa && dados.conversa[telefone]) || { status: 'idle' };
}

function setEstadoConversa(telefone, estado) {
    const dados = cacheLocal;
    if (!dados.conversa) dados.conversa = {};
    dados.conversa[telefone] = {
        ...estado,
        atualizadoEm: Date.now()
    };
    salvarDados(dados);

    // Persiste no Supabase
    (async () => {
        try {
            await supabase.from('conversas').upsert({
                barbearia_id: RESTAURANTE_ID,
                telefone: telefone,
                estado: dados.conversa[telefone],
                atualizado_em: new Date().toISOString()
            });
        } catch (e) {}
    })();
}

function limparEstadoConversa(telefone) {
    const dados = cacheLocal;
    if (dados.conversa && dados.conversa[telefone]) {
        delete dados.conversa[telefone];
        salvarDados(dados);
    }

    (async () => {
        try {
            await supabase
                .from('conversas')
                .delete()
                .eq('barbearia_id', RESTAURANTE_ID)
                .eq('telefone', telefone);
        } catch (e) {}
    })();
}

// Configurações
function getConfig() {
    const dados = cacheLocal;
    return dados.config;
}

function salvarConfig(novaConfig) {
    const dados = cacheLocal;
    dados.config = { ...dados.config, ...novaConfig };
    if (novaConfig.nomeRestaurante) {
        dados.config.nomeSalao = novaConfig.nomeRestaurante;
    }
    salvarDados(dados);

    (async () => {
        try {
            await supabase.from('barbearias').upsert({
                id: RESTAURANTE_ID,
                nome: dados.config.nomeRestaurante || dados.config.nomeSalao,
                telefone_dono: dados.config.numeroDono,
                chave_pix: dados.config.chavePix,
                endereco: dados.config.endereco,
                fechado_hoje: Boolean(dados.config.fechadoHoje),
                motivo_fechado: dados.config.motivoFechado,
                data_fechada_manual: dados.config.dataFechadaManual,
                updated_at: new Date().toISOString()
            });
        } catch (err) {}
    })();

    return dados.config;
}

// Mapeamentos de compatibilidade para código anterior
const criarAgendamento = (params) => {
    return criarPedido({
        cliente: params.cliente,
        telefone: params.telefone,
        itens: [{ nome: params.servico || 'Refeição / Pedido', preco: params.preco || 25, qtd: 1 }],
        tipoEntrega: 'delivery',
        formaPagamento: 'PIX',
        origem: params.origem || 'manual'
    });
};
const cancelarAgendamento = (id, tel) => cancelarPedido(id, tel);
const concluirAgendamento = (id) => atualizarStatusPedido(id, 'concluido');
const getAgendamentosCliente = (tel) => getPedidosCliente(tel);
const getTodosAgendamentos = (filtro) => getTodosPedidos(filtro);
const getHorariosDisponiveis = () => ["11:00", "12:00", "13:00", "14:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
const getProximosDiasDisponiveis = () => [];

module.exports = {
    inicializarDatabase,
    sincronizarComSupabase,
    carregarDados,
    salvarDados,
    formatarDataLocal,
    isFechadoHoje,
    getTurnoAtual,
    getCardapio,
    criarPedido,
    atualizarStatusPedido,
    cancelarPedido,
    getPedidosCliente,
    getTodosPedidos,
    getEstatisticas,
    getEstadoConversa,
    setEstadoConversa,
    limparEstadoConversa,
    getConfig,
    salvarConfig,
    // Funções de compatibilidade
    criarAgendamento,
    cancelarAgendamento,
    concluirAgendamento,
    getAgendamentosCliente,
    getTodosAgendamentos,
    getHorariosDisponiveis,
    getProximosDiasDisponiveis
};
