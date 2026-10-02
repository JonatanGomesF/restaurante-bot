const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');

const db = require('./database');
const whatsappManager = require('./whatsappClient');
const { processarMensagem } = require('./botEngine');
const updater = require('./updater');

const APP_DIR = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

const PORT = process.env.PORT || 3000;

// Resolução da pasta public
const publicDir = fs.existsSync(path.join(APP_DIR, 'public'))
    ? path.join(APP_DIR, 'public')
    : path.join(__dirname, '..', 'public');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir, {
    maxAge: 0,
    etag: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
}));

// Conecta o emissor de eventos do WhatsApp ao Socket.io
whatsappManager.setEventEmitter((event, data) => {
    io.emit(event, data);
});

// -----------------------------
// Rotas da API REST
// -----------------------------

// 1. Status do Bot e WhatsApp (sem cache)
app.get('/api/status', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const status = whatsappManager.getStatus();
    const stats = db.getEstatisticas();
    res.json({
        ...status,
        stats
    });
});

// 1.1 Endpoint de Imagem Direta do QR Code (PNG)
app.get('/api/qr.png', async (req, res) => {
    const status = whatsappManager.getStatus();
    if (!status.qr) {
        return res.status(404).send('QR Code ainda não disponível.');
    }

    try {
        const QRCode = require('qrcode');
        const buffer = await QRCode.toBuffer(status.qr, {
            width: 320,
            margin: 2,
            color: {
                dark: '#0F172A',
                light: '#FFFFFF'
            }
        });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.send(buffer);
    } catch (err) {
        res.status(500).send('Erro ao renderizar imagem do QR Code.');
    }
});

// 1.2 Endpoint Simples de QR Code
app.get('/api/bot/qr', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const status = whatsappManager.getStatus();
    res.json({
        status: status.status,
        qr: status.qr,
        qrImage: status.qrImage
    });
});

// 2. Listagem de Pedidos com filtros (e compatibilidade /api/appointments)
app.get(['/api/orders', '/api/appointments'], (req, res) => {
    const { data, status, busca } = req.query;
    const pedidos = db.getTodosPedidos({ data, status, busca });
    res.json(pedidos);
});

// 3. Criar Pedido Manual (pelo Painel do Restaurante)
app.post(['/api/orders', '/api/appointments'], (req, res) => {
    const { cliente, telefone, itens, servico, preco, tipoEntrega, enderecoEntrega, formaPagamento } = req.body;

    const itensFinal = Array.isArray(itens) && itens.length > 0 
        ? itens 
        : [{ nome: servico || 'Pedido Balcão', qtd: 1, preco: Number(preco) || 22.00 }];

    const resultado = db.criarPedido({
        cliente: cliente || 'Cliente Balcão',
        telefone: telefone ? (telefone.includes('@') ? telefone : `${telefone.replace(/\D/g, '')}@c.us`) : 'balcao@c.us',
        itens: itensFinal,
        tipoEntrega: tipoEntrega || 'retirada',
        enderecoEntrega: enderecoEntrega || '',
        formaPagamento: formaPagamento || 'Dinheiro / Balcão',
        origem: 'manual'
    });

    if (!resultado.success) {
        return res.status(409).json(resultado);
    }

    io.emit('novo_agendamento', resultado.pedido);
    io.emit('novo_pedido', resultado.pedido);
    io.emit('stats_update', db.getEstatisticas());

    res.status(201).json(resultado);
});

// 4. Alterar Status do Pedido (Pendente -> Em Preparo -> Saiu para Entrega -> Concluído -> Cancelado)
app.put('/api/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, avisarCliente = true } = req.body;

    const resultado = db.atualizarStatusPedido(id, status);

    if (!resultado.success) {
        return res.status(404).json(resultado);
    }

    io.emit('pedido_atualizado', resultado.pedido);
    io.emit('agendamento_atualizado', resultado.pedido);
    io.emit('stats_update', db.getEstatisticas());

    // Se solicitado e o WhatsApp estiver conectado, notifica o cliente
    if (avisarCliente && resultado.pedido.telefone && whatsappManager.status === 'READY') {
        const ped = resultado.pedido;
        let msgStatus = '';
        if (status === 'em_preparo') {
            msgStatus = `👨‍🍳 *Seu pedido [${ped.codigo}] já está no fogo/forno sendo preparado no capricho!*`;
        } else if (status === 'saiu_entrega') {
            msgStatus = ped.tipoEntrega === 'delivery'
                ? `🛵 *Oba! Seu pedido [${ped.codigo}] acabou de sair para entrega e está a caminho!*`
                : `🛍️ *Seu pedido [${ped.codigo}] está prontinho para retirada no balcão!*`;
        } else if (status === 'concluido') {
            msgStatus = `✅ *Pedido [${ped.codigo}] entregue com sucesso! Bom apetite e volte sempre!* 😋❤️`;
        }

        if (msgStatus) {
            try {
                await whatsappManager.sendMessage(ped.telefone, msgStatus);
            } catch (e) {}
        }
    }

    res.json(resultado);
});

// 4.1 Cancelar Pedido
app.delete(['/api/orders/:id', '/api/appointments/:id'], (req, res) => {
    const { id } = req.params;
    const resultado = db.cancelarPedido(id);

    if (!resultado.success) {
        return res.status(404).json(resultado);
    }

    io.emit('agendamento_cancelado', resultado.pedido);
    io.emit('stats_update', db.getEstatisticas());
    res.json(resultado);
});

// 4.2 Concluir Pedido
app.put(['/api/orders/:id/concluir', '/api/appointments/:id/concluir'], (req, res) => {
    const { id } = req.params;
    const resultado = db.atualizarStatusPedido(id, 'concluido');

    if (!resultado.success) {
        return res.status(404).json(resultado);
    }

    io.emit('agendamento_atualizado', resultado.pedido);
    io.emit('stats_update', db.getEstatisticas());
    res.json(resultado);
});

// 5. Cardápio do Restaurante
app.get('/api/menu', (req, res) => {
    const cardapio = db.getCardapio({ apenasAtivos: false });
    res.json(cardapio);
});

app.post('/api/menu', (req, res) => {
    const novoCardapio = req.body;
    const configAtual = db.getConfig();
    const salva = db.salvarConfig({ ...configAtual, cardapio: novoCardapio });
    io.emit('config_atualizada', salva);
    res.json({ success: true, cardapio: salva.cardapio });
});

// 6. Métricas e Estatísticas
app.get('/api/stats', (req, res) => {
    const stats = db.getEstatisticas();
    res.json(stats);
});

// 7. Configurações do Restaurante
app.get('/api/config', (req, res) => {
    const config = db.getConfig();
    res.json(config);
});

app.post('/api/config', (req, res) => {
    const novaConfig = req.body;
    const salva = db.salvarConfig(novaConfig);
    io.emit('config_atualizada', salva);
    io.emit('stats_update', db.getEstatisticas());
    res.json({ success: true, config: salva });
});

// 7.1 Alternar Modo "HOJE ESTAMOS FECHADOS"
app.post('/api/config/fechado-hoje', (req, res) => {
    const { fechado, motivo } = req.body;
    const configAtual = db.getConfig();
    const hojeStr = db.formatarDataLocal(new Date());

    const novaConfig = db.salvarConfig({
        ...configAtual,
        fechadoHoje: Boolean(fechado),
        motivoFechado: motivo !== undefined ? motivo : configAtual.motivoFechado,
        dataFechadaManual: fechado ? hojeStr : null
    });

    io.emit('config_atualizada', novaConfig);
    io.emit('stats_update', db.getEstatisticas());

    res.json({
        success: true,
        fechadoHoje: novaConfig.fechadoHoje,
        motivoFechado: novaConfig.motivoFechado,
        config: novaConfig
    });
});

// 8. Ações do Bot WhatsApp
app.post('/api/bot/restart', async (req, res) => {
    try {
        await whatsappManager.restart();
        res.json({ success: true, message: 'Reiniciando WhatsApp Web...' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/bot/logout', async (req, res) => {
    const resultado = await whatsappManager.logout();
    res.json(resultado);
});

// 9. Simulador de Pedidos via WhatsApp (Testes Direto no Navegador)
app.post('/api/simulator/chat', async (req, res) => {
    const { telefone = '5511999998888@c.us', nome = 'Cliente Teste', mensagem } = req.body;

    if (!mensagem) {
        return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const respostas = [];

    await processarMensagem({
        from: telefone,
        nome,
        texto: mensagem,
        sendMessage: async (to, texto) => {
            respostas.push({ to, texto, hora: new Date().toLocaleTimeString('pt-BR') });
        },
        sendTyping: async () => {},
        emitEvent: (event, data) => io.emit(event, data)
    });

    res.json({
        success: true,
        respostas,
        estadoAtual: db.getEstadoConversa(telefone)
    });
});

// 10. Auto-Update de Layout via GitHub
app.get('/api/system/version', (req, res) => {
    res.json(updater.obterVersaoLocal());
});

app.post('/api/system/update', async (req, res) => {
    const { force = false } = req.body;
    const resultado = await updater.verificarEAtualizarLayout(force);
    res.json(resultado);
});

// Rota coringa para o frontend SPA
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(publicDir, 'index.html'));
    }
    next();
});

// -----------------------------
// Conexão WebSocket (Socket.io)
// -----------------------------
io.on('connection', (socket) => {
    console.log(`🔌 Novo cliente conectado ao Painel (Socket ID: ${socket.id})`);

    socket.emit('status_change', whatsappManager.getStatus());
    socket.emit('stats_update', db.getEstatisticas());
});

// -----------------------------
// Inicialização do Servidor
// -----------------------------
function startServer() {
    db.inicializarDatabase();

    updater.verificarEAtualizarLayout(false).catch(() => {});

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n❌ ERRO: A porta ${PORT} já está sendo usada por outro processo!`);
            console.error(`Feche qualquer outra janela do RestauranteBot aberta ou encerre processos anteriores.\n`);
        } else {
            console.error(`❌ Erro no servidor web:`, err.message);
        }
    });

    server.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 [PAINEL DO RESTAURANTE ONLINE] Acesse http://localhost:${PORT}`);
        console.log(`🍽️ Restaurante Bom Sabor — Marmitex (Dia) & Pizzaria (Noite)`);
        console.log(`======================================================\n`);
        
        whatsappManager.initialize();
    });
}

module.exports = {
    app,
    server,
    startServer
};
