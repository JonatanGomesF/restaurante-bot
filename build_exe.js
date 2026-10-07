const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { rcedit } = require('rcedit');

// Lê config do cliente para personalizar o build
let CLIENTE_ID   = 'delivery_bot';
let NOME_CLIENTE = 'Delivery Bot';
try {
    const cfgRaw = fs.readFileSync(path.join(__dirname, 'config_delivery.json'), 'utf8');
    const cfg    = JSON.parse(cfgRaw);
    if (cfg.clienteId)           CLIENTE_ID   = cfg.clienteId.trim().toLowerCase().replace(/\s+/g, '_');
    if (cfg.nomeEstabelecimento) NOME_CLIENTE = cfg.nomeEstabelecimento.trim();
} catch (e) {}

console.log(`\n=====================================================================`);
console.log(` 🚀 GERADOR DE EXECUTÁVEL — ${NOME_CLIENTE.toUpperCase()}`);
console.log(`=====================================================================\n`);

const ROOT_DIR = __dirname;
const STAGING_DIR = path.join(ROOT_DIR, 'build_staging');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ICON_PATH = path.join(ROOT_DIR, 'rocket.ico');

// =====================================================================
// HIGIENIZAÇÃO DO PACOTE DE DISTRIBUIÇÃO
// Garante que NUNCA sejam enviados para o cliente: sessão do WhatsApp
// logada, dados do cliente anterior, logs e configs do desenvolvedor.
// =====================================================================
const ARQUIVOS_SENSIVEIS_DIST = [
    '.wwebjs_auth',            // sessão autenticada do WhatsApp Web
    '.wwebjs_cache',           // cache do WhatsApp Web
    'agendamentos.json',       // cardápio/PIX/telefone/pedidos do cliente atual
    'erro_log.txt',            // log de erros do desenvolvedor
    'build_staging'
];

function* listarArquivos(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) yield* listarArquivos(p);
        else yield p;
    }
}

// Termos que NUNCA podem existir no pacote entregue ao cliente.
// Incluem dados pessoais do desenvolvedor e o nome de clientes anteriores.
const TERMOS_PROIBIDOS = [
    'Bom Sabor',
    'bom_sabor',
    '5515974062762',
    '15974062762',
    'Rua das Del'
];

function auditarConteudo() {
    console.log(`🔎 Auditando o pacote contra vazamento de dados...`);
    let vazamentos = 0;

    for (const termo of TERMOS_PROIBIDOS) {
        const bufTermo = Buffer.from(termo, 'utf8');
        const achados = [];
        for (const arquivo of listarArquivos(DIST_DIR)) {
            if (fs.readFileSync(arquivo).includes(bufTermo)) {
                achados.push(path.relative(DIST_DIR, arquivo));
            }
        }
        if (achados.length) {
            vazamentos++;
            console.error(`   ❌ VAZAMENTO: "${termo}" presente em ${achados.join(', ')}`);
        }
    }

    if (vazamentos) {
        console.error(`   ❌ Build abortada por vazamento de dados. Corrija e rode de novo.`);
        process.exit(1);
    }
    console.log(`   ✅ Nenhum dado sensível encontrado (${TERMOS_PROIBIDOS.length} termos verificados).`);
}

function sanearDist() {
    console.log(`🧼 Higienizando o pacote de distribuição em ${DIST_DIR}...`);
    let removidos = 0;

    for (const item of ARQUIVOS_SENSIVEIS_DIST) {
        const alvo = path.join(DIST_DIR, item);
        if (!fs.existsSync(alvo)) continue;
        const tamanho = fs.statSync(alvo).isDirectory()
            ? (fs.readdirSync(alvo, { withFileTypes: true }).length + ' itens')
            : (fs.statSync(alvo).size + ' bytes');
        try {
            fs.rmSync(alvo, { recursive: true, force: true });
            console.log(`   🗑️  Removido: ${item} (${tamanho})`);
            removidos++;
        } catch (e) {
            console.error(`   ❌ Falha ao remover ${item}: ${e.message}`);
        }
    }

    // Validação final: nada sensível pode ter sobrado
    const restantes = ARQUIVOS_SENSIVEIS_DIST.filter(i => fs.existsSync(path.join(DIST_DIR, i)));
    if (restantes.length) {
        console.error(`   ❌ FALHA DE SEGURANÇA — ainda presente: ${restantes.join(', ')}`);
        process.exitCode = 1;
    } else {
        console.log(`   ✅ Pacote limpo (${removidos} item(ns) removido(s)).`);
    }

    // Relatório final do conteúdo entregue
    const entregues = fs.readdirSync(DIST_DIR, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.'))
        .map(e => e.name);
    console.log(`   📦 Conteúdo final: ${entregues.join(', ')}`);

    auditarConteudo();
}

async function patchPkgCacheIcons() {
    if (!fs.existsSync(ICON_PATH)) return;

    const cacheBase = process.env.PKG_CACHE_PATH || path.join(os.homedir(), '.pkg-cache');
    if (!fs.existsSync(cacheBase)) return;

    function scanDir(dir) {
        let results = [];
        try {
            const list = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of list) {
                const full = path.join(dir, item.name);
                if (item.isDirectory()) {
                    results = results.concat(scanDir(full));
                } else if (item.name.includes('win')) {
                    results.push(full);
                }
            }
        } catch(e) {}
        return results;
    }

    const winBinaries = scanDir(cacheBase);
    for (const bin of winBinaries) {
        try {
            await rcedit(bin, {
                icon: ICON_PATH,
                'file-version': '1.0.0',
                'product-version': '1.0.0',
                'version-string': {
                    'ProductName': 'WhatsApp Delivery Bot',
                    'FileDescription': 'WhatsApp Delivery Hub',
                    'CompanyName': 'Delivery Bot',
                    'LegalCopyright': 'Copyright © 2026'
                }
            });
            console.log(`   🚀 Ícone de Foguete preparado no binário base: ${path.basename(bin)}`);
        } catch (err) {
            // Se falhar em algum binário inativo, continua
        }
    }
}

async function build() {
    // 1. Limpeza de processos e pastas temporárias de build
    console.log(`🧹 [1/5] Limpando processos e pastas temporárias de build...`);
    try {
        execSync('taskkill /F /IM RestauranteBot.exe /T 2>nul || taskkill /F /IM BarbeariaBot.exe /T 2>nul || exit 0', { shell: 'cmd.exe' });
    } catch (e) {}

    if (fs.existsSync(STAGING_DIR)) {
        try { fs.rmSync(STAGING_DIR, { recursive: true, force: true }); } catch(e){}
    }
    if (fs.existsSync(DIST_DIR)) {
        try { fs.rmSync(DIST_DIR, { recursive: true, force: true }); } catch(e){}
    }

    fs.mkdirSync(STAGING_DIR, { recursive: true });
    fs.mkdirSync(path.join(STAGING_DIR, 'src'), { recursive: true });
    fs.mkdirSync(DIST_DIR, { recursive: true });

    // 2. Ofuscação de Código Fonte
    console.log(`🔒 [2/5] Ofuscando código JavaScript para proteção contra cópia...`);

    const obfuscatorOptions = {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        simplify: true,
        stringArray: true,
        stringArrayEncoding: ['none'],
        stringArrayThreshold: 0.8,
        rotateStringArray: true,
        shuffleStringArray: true,
        splitStrings: true,
        splitStringsChunkLength: 8,
        ignoreImports: true,
        target: 'node'
    };

    function ofuscarArquivo(origem, destino) {
        const code = fs.readFileSync(origem, 'utf8');
        const obfuscated = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions).getObfuscatedCode();
        fs.writeFileSync(destino, obfuscated, 'utf8');
        console.log(`   🛡️ Protegido: ${path.relative(ROOT_DIR, origem)} -> ${path.relative(ROOT_DIR, destino)}`);
    }

    ofuscarArquivo(path.join(ROOT_DIR, 'chatbot.js'), path.join(STAGING_DIR, 'chatbot.js'));
    ofuscarArquivo(path.join(ROOT_DIR, 'src', 'database.js'), path.join(STAGING_DIR, 'src', 'database.js'));
    ofuscarArquivo(path.join(ROOT_DIR, 'src', 'botEngine.js'), path.join(STAGING_DIR, 'src', 'botEngine.js'));
    ofuscarArquivo(path.join(ROOT_DIR, 'src', 'server.js'), path.join(STAGING_DIR, 'src', 'server.js'));
    ofuscarArquivo(path.join(ROOT_DIR, 'src', 'whatsappClient.js'), path.join(STAGING_DIR, 'src', 'whatsappClient.js'));
    ofuscarArquivo(path.join(ROOT_DIR, 'src', 'updater.js'), path.join(STAGING_DIR, 'src', 'updater.js'));

    // 3. Cópia de arquivos estáticos e de suporte
    console.log(`📂 [3/5] Copiando arquivos estáticos (HTML/CSS/JS/Config/Ícones)...`);

    function copyDirSync(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                copyDirSync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    copyDirSync(path.join(ROOT_DIR, 'public'), path.join(STAGING_DIR, 'public'));
    copyDirSync(path.join(ROOT_DIR, 'public'), path.join(DIST_DIR, 'public'));

    if (fs.existsSync(path.join(ROOT_DIR, 'agendamentos.json'))) {
        // NÃO copiar o agendamentos.json do desenvolvedor: ele contém cardápio,
        // chave PIX, telefone e pedidos do cliente atual. O app recria o arquivo
        // limpo a partir do DEFAULT_CONFIG no primeiro boot (ver database.js).
        console.log('   ⚠️  agendamentos.json local NÃO será copiado (contém dados de outro cliente).');
    }

    // config_delivery.json — gera um MODELO neutro em vez de copiar o do desenvolvedor
    const configModelo = {
        clienteId: 'troque_este_campo',
        nomeEstabelecimento: 'Meu Delivery',
        descricao: "Configuração do cliente delivery. Altere apenas 'clienteId' e 'nomeEstabelecimento' para cada novo cliente.",
        githubRepo: 'JonatanGomesF/restaurante-bot',
        branch: 'main'
    };
    fs.writeFileSync(
        path.join(DIST_DIR, 'config_delivery.json'),
        JSON.stringify(configModelo, null, 2) + '\n',
        'utf8'
    );
    // setup_banco.js — script de provisionamento do banco
    if (fs.existsSync(path.join(ROOT_DIR, 'setup_banco.js'))) {
        fs.copyFileSync(path.join(ROOT_DIR, 'setup_banco.js'), path.join(DIST_DIR, 'setup_banco.js'));
    }
    if (fs.existsSync(path.join(ROOT_DIR, 'version.json'))) {
        fs.copyFileSync(path.join(ROOT_DIR, 'version.json'), path.join(DIST_DIR, 'version.json'));
    }
    if (fs.existsSync(ICON_PATH)) {
        fs.copyFileSync(ICON_PATH, path.join(DIST_DIR, 'rocket.ico'));
    }

    fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(STAGING_DIR, 'package.json'));

    // 4. Injeção do Ícone de Foguete na Base Binary e Compilação em .EXE
    console.log(`⚙️  [4/5] Aplicando ícone de Foguete e empacotando em .EXE nativo do Windows...`);

    await patchPkgCacheIcons();

    const entryFile = path.join(STAGING_DIR, 'chatbot.js');
    const outputExe = path.join(DIST_DIR, 'DeliveryBot.exe');

    const pkgBinPath = path.join(ROOT_DIR, 'node_modules', '.bin', 'pkg');
    const pkgCmd = `"${pkgBinPath}" "${entryFile}" --target host --output "${outputExe}" --public`;

    try {
        execSync(pkgCmd, { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (err) {
        console.error("❌ Falha na compilação do PKG:", err.message);
        process.exit(1);
    }

    // 5. Criação do arquivo de inicialização simplificado na pasta dist
    console.log(`📝 [5/5] Finalizando pacote de distribuição para o cliente...`);

    const batLauncher = `@echo off
title WhatsApp Delivery Bot
cd /d "%~dp0"
cls
echo =====================================================================
echo       WHATSAPP DELIVERY BOT - PAINEL E AUTOMACAO
echo =====================================================================
echo.
echo [1/3] Verificando arquivos...
if not exist "DeliveryBot.exe" (
    echo [ERRO FATAL] DeliveryBot.exe nao foi encontrado nesta pasta!
    echo Certifique-se de copiar a pasta inteira.
    pause
    exit /b 1
)

echo [2/3] Verificando config_delivery.json...
if not exist "config_delivery.json" (
    echo [ERRO] config_delivery.json nao encontrado!
    echo Crie o arquivo com clienteId e nomeEstabelecimento antes de iniciar.
    pause
    exit /b 1
)

echo [3/3] Iniciando servidor local e WhatsApp Bot...
echo.
echo =====================================================================
echo Painel Web: http://localhost:3000
echo Mantenha esta janela aberta enquanto o delivery estiver funcionando.
echo =====================================================================
echo.

DeliveryBot.exe

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Processo encerrou com codigo: %ERRORLEVEL%
    echo Se houver erro, veja o arquivo 'erro_log.txt' nesta mesma pasta.
)

echo.
pause
`;
    fs.writeFileSync(path.join(DIST_DIR, 'INICIAR.bat'), batLauncher, 'utf8');

const leiaMeTxt = `=====================================================================
    WHATSAPP DELIVERY BOT - PAINEL E AUTOMACAO
=====================================================================

COMO USAR:
1. Copie esta pasta INTEIRA para o computador (ou pendrive).
2. Abra o arquivo "config_delivery.json" e preencha:
   - "clienteId"           -> identificador unico do seu estabelecimento
                               (so letras minusculas, numeros e "_")
   - "nomeEstabelecimento" -> nome que aparecera no WhatsApp e no painel
3. De 2 cliques no arquivo "INICIAR.bat" (ou "DeliveryBot.exe").
4. O painel web abrira automaticamente em: http://localhost:3000
5. Escaneie o QR Code com o WhatsApp do delivery.
6. Pronto! O bot respondera os clientes automaticamente.

CONFIGURANDO CARDAPIO, PIX E MENSAGENS:
   Acesse http://localhost:3000 no navegador.
   Cardapio, categorias, precos, taxa de entrega e mensagens do bot
   sao configuraveis pelo painel e salvos automaticamente.
   IMPORTANTE: o "WhatsApp da cozinha/dono" e a "Chave PIX" NAO vem
   preenchidos - cadastre os dados do SEU estabelecimento em
   Configuracoes antes de divulgar o bot para os seus clientes.

BANCO DE DADOS:
   O cadastro do seu estabelecimento e criado automaticamente na
   primeira execucao. Nao e preciso instalar nada.

REQUISITOS:
   - Windows 10 ou 11 (64-bit)
   - Conexao com a Internet
   - Google Chrome ou Microsoft Edge instalado

ARQUIVOS NA MESMA PASTA:
   - DeliveryBot.exe
   - config_delivery.json   <- OBRIGATORIO editar por cliente
   - public/
   - version.json
   - INICIAR.bat / LEIA_ME.txt / rocket.ico

OBSERVACOES:
   - Nao apague nem renomeie o DeliveryBot.exe.
   - Guarde esta pasta inteira: o sistema cria nela os arquivos de
     sessao do WhatsApp e os dados locais ao ser usado.
   - Para instalar em outra maquina, copie a pasta e apague apenas a
     pasta ".wwebjs_auth" (sessao do WhatsApp) antes de usar.
=====================================================================
`;
    fs.writeFileSync(path.join(DIST_DIR, 'LEIA_ME.txt'), leiaMeTxt, 'utf8');

    // Limpa staging temporário
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });

    // SEMPRE higieniza o dist antes de considerar pronto para o cliente
    sanearDist();

    console.log(`\n=====================================================================`);
    console.log(`✅ [SUCESSO] EXECUTÁVEL GERADO NA PASTA /dist !`);
    console.log(`🚀 Arquivo: dist/DeliveryBot.exe`);
    console.log(`🏪 Cliente: ${NOME_CLIENTE} (${CLIENTE_ID})`);
    console.log(`📁 Pasta pronta para pendrive/instalação: ${DIST_DIR}`);
    console.log(`=====================================================================\n`);
}

// Permite higienizar o dist sem recompilar (útil depois de testar o .exe localmente):
//   node build_exe.js --limpar
if (process.argv.includes('--limpar')) {
    if (!fs.existsSync(DIST_DIR)) {
        console.error(`❌ Pasta ${DIST_DIR} não encontrada. Rode "npm run build:exe" primeiro.`);
        process.exit(1);
    }
    sanearDist();
} else {
    build().catch(err => {
        console.error("❌ Erro fatal durante a geração da build:", err);
        process.exit(1);
    });
}
