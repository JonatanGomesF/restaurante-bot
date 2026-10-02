const path = require('path');
const fs = require('fs');
const { startServer } = require('./src/server');
const db = require('./src/database');
const whatsappManager = require('./src/whatsappClient');

const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

function registrarErro(tipo, erro) {
    try {
        const msg = erro ? (erro.stack || erro.message || String(erro)) : 'Erro desconhecido';
        const logPath = path.join(APP_DIR, 'erro_log.txt');
        const linha = `[${new Date().toISOString()}] ${tipo}: ${msg}\n`;
        fs.appendFileSync(logPath, linha, 'utf8');
    } catch (e) {}
}

process.on('uncaughtException', function (err) {
    console.error('\n❌ [ERRO NÃO TRATADO]:', err);
    registrarErro('UNCAUGHT_EXCEPTION', err);
});

process.on('unhandledRejection', function (reason) {
    const msg = reason ? (reason.message || String(reason)) : '';
    // Ignora erros normais de ciclo de vida do Puppeteer ao desconectar/navegar
    if (msg.includes('Execution context was destroyed') || 
        msg.includes('EBUSY') || 
        msg.includes('Target closed') || 
        msg.includes('Session closed') ||
        msg.includes('Protocol error')) {
        return;
    }
    console.error('\n⚠️ [REJEIÇÃO NÃO TRATADA]:', reason);
    registrarErro('UNHANDLED_REJECTION', reason);
});

// Relatório semanal automático todo domingo às 22h
setInterval(async () => {
    const agora = new Date();
    // 0 = Domingo
    if (agora.getDay() === 0 && agora.getHours() === 22 && agora.getMinutes() === 0) {
        const stats = db.getEstatisticas();
        const config = db.getConfig();

        if (config.numeroDono && whatsappManager.status === 'READY') {
            try {
                await whatsappManager.sendMessage(
                    config.numeroDono,
                    `📊 *RELATÓRIO SEMANAL — ${config.nomeRestaurante.toUpperCase()}*\n\n` +
                    `🍱 *Total de Pedidos:* ${stats.totalGeral || stats.totalConfirmados}\n` +
                    `✅ *Pedidos Entregues:* ${stats.pedidosConcluidos || stats.totalConcluidos}\n` +
                    `💰 *Faturamento Total:* R$ ${(stats.faturamentoHoje || stats.faturamentoEstimado).toFixed(2)}\n\n` +
                    `_Excelente trabalho a toda a equipe do Restaurante Bom Sabor!_ 🍽️🍕`
                );
            } catch (err) {
                console.error("Erro ao enviar relatório semanal:", err.message);
            }
        }
    }
}, 60 * 1000);

// Inicia servidor web com dashboard e bot WhatsApp
startServer();

// Abre o painel no navegador automaticamente após subir o servidor
setTimeout(() => {
    try {
        const { exec } = require('child_process');
        if (process.platform === 'win32') {
            exec('start "" "http://localhost:3000"');
        }
    } catch (e) {}
}, 2000);