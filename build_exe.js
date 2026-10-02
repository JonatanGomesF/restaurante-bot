const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

console.log(`\n=====================================================================`);
console.log(` 🍽️  GERADOR DE EXECUTÁVEL PROTEGIDO — RESTAURANTE DELIVERY BOT 🍕`);
console.log(`=====================================================================\n`);

const ROOT_DIR = __dirname;
const STAGING_DIR = path.join(ROOT_DIR, 'build_staging');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

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

// 2. Ofuscação de Código Fonte (Configuração Segura e Otimizada para evitar falsos positivos de Antivírus)
console.log(`🔒 [2/5] Ofuscando código JavaScript para proteção contra cópia...`);

const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: false, // Desativado para performance nativa e zero bloqueios do Windows Defender
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

// Arquivos principais a ofuscar
ofuscarArquivo(path.join(ROOT_DIR, 'chatbot.js'), path.join(STAGING_DIR, 'chatbot.js'));
ofuscarArquivo(path.join(ROOT_DIR, 'src', 'database.js'), path.join(STAGING_DIR, 'src', 'database.js'));
ofuscarArquivo(path.join(ROOT_DIR, 'src', 'botEngine.js'), path.join(STAGING_DIR, 'src', 'botEngine.js'));
ofuscarArquivo(path.join(ROOT_DIR, 'src', 'server.js'), path.join(STAGING_DIR, 'src', 'server.js'));
ofuscarArquivo(path.join(ROOT_DIR, 'src', 'whatsappClient.js'), path.join(STAGING_DIR, 'src', 'whatsappClient.js'));
ofuscarArquivo(path.join(ROOT_DIR, 'src', 'updater.js'), path.join(STAGING_DIR, 'src', 'updater.js'));

// 3. Cópia de arquivos estáticos e de suporte
console.log(`📂 [3/5] Copiando arquivos estáticos (HTML/CSS/JS/Config)...`);

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

// Copia pasta public para a staging e para a dist final
copyDirSync(path.join(ROOT_DIR, 'public'), path.join(STAGING_DIR, 'public'));
copyDirSync(path.join(ROOT_DIR, 'public'), path.join(DIST_DIR, 'public'));

// Copia agendamentos.json se existir
if (fs.existsSync(path.join(ROOT_DIR, 'agendamentos.json'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'agendamentos.json'), path.join(DIST_DIR, 'agendamentos.json'));
}

// Copia config_salao.json se existir
if (fs.existsSync(path.join(ROOT_DIR, 'config_salao.json'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'config_salao.json'), path.join(DIST_DIR, 'config_salao.json'));
}

// Copia version.json se existir
if (fs.existsSync(path.join(ROOT_DIR, 'version.json'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'version.json'), path.join(DIST_DIR, 'version.json'));
}

// Copia package.json para staging
fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(STAGING_DIR, 'package.json'));

// 4. Compilação em .EXE usando @yao-pkg/pkg
console.log(`⚙️  [4/5] Empacotando em arquivo executável .EXE nativo do Windows...`);

const entryFile = path.join(STAGING_DIR, 'chatbot.js');
const outputExe = path.join(DIST_DIR, 'RestauranteBot.exe');

const pkgBinPath = path.join(ROOT_DIR, 'node_modules', '.bin', 'pkg');
const pkgCmd = `"${pkgBinPath}" "${entryFile}" --target host --output "${outputExe}" --public`;

try {
    execSync(pkgCmd, { stdio: 'inherit', cwd: ROOT_DIR });
} catch (err) {
    console.error("❌ Falha na compilação do PKG:", err.message);
    process.exit(1);
}

// 5. Criação do arquivo de inicialização simplificado na pasta dist
console.log(`📝 [5/5] Finalizando pacote de distribuição para o restaurante...`);

const batLauncher = `@echo off
title Restaurante Bom Sabor & WhatsApp Delivery Hub
cd /d "%~dp0"
cls
echo =====================================================================
echo    🍽️  INICIANDO RESTAURANTE BOM SABOR & WHATSAPP DELIVERY HUB 🍕
echo =====================================================================
echo.
echo [1/2] Verificando integridade dos arquivos...
if not exist "RestauranteBot.exe" (
    echo [ERRO FATAL] RestauranteBot.exe nao foi encontrado nesta pasta!
    echo Certifique-se de copiar a pasta 'dist' completa.
    echo.
    pause
    exit /b 1
)

echo [2/2] Abrindo servidor local e WhatsApp Bot...
echo.
echo =====================================================================
echo O painel web abrira automaticamente em: http://localhost:3000
echo Mantenha esta janela aberta enquanto o delivery estiver funcionando.
echo =====================================================================
echo.

RestauranteBot.exe

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo =====================================================================
    echo [AVISO] O processo encerrou com codigo: %ERRORLEVEL%
    echo Se houver erro, veja o arquivo 'erro_log.txt' nesta mesma pasta.
    echo =====================================================================
)

echo.
pause
`;
fs.writeFileSync(path.join(DIST_DIR, 'INICIAR_RESTAURANTE.bat'), batLauncher, 'utf8');

const leiaMeTxt = `=====================================================================
🍽️ RESTAURANTE BOM SABOR & WHATSAPP DELIVERY HUB — GUIA DE USO 🍕
=====================================================================

COMO USAR EM QUALQUER COMPUTADOR OU NOTEBOOK NO RESTAURANTE:
1. Copie a pasta "dist" inteira para o computador do restaurante (ou pendrive).
2. Dê 2 cliques no arquivo "INICIAR_RESTAURANTE.bat" (ou "RestauranteBot.exe").
3. A janela do servidor será aberta e o navegador abrirá automaticamente em:
   http://localhost:3000
4. Escaneie o QR Code com o WhatsApp do restaurante (ou número do delivery).
5. Pronto! O bot responderá os clientes automaticamente:
   - Almoço (Dia): Marmitex com opções de carne.
   - Jantar (Noite): Pizzas inteiras ou meio a meio (cobrando maior valor), bordas e bebidas.
   - Comanda enviada diretamente para a cozinha e pedidos ao vivo no painel!

COMO PERSONALIZAR CARDÁPIO E MENSAGENS:
- Acesse http://localhost:3000 no navegador.
- Vá na aba "Cardápio, Carnes & Bordas" para adicionar pratos ou mudar preços.
- Vá na aba "Mensagens do WhatsApp" para editar qualquer texto enviado pelo bot.

REQUISITOS DO SISTEMA:
- Windows 10 ou 11 (64-bit).
- Conexão com a Internet.
- Navegador Google Chrome ou Microsoft Edge instalado no computador.

DICA IMPORTANTE:
- Mantenha os arquivos "public", "agendamentos.json", "config_salao.json" e "version.json"
  sempre na mesma pasta do "RestauranteBot.exe".
=====================================================================
`;
fs.writeFileSync(path.join(DIST_DIR, 'LEIA_ME.txt'), leiaMeTxt, 'utf8');

// Limpa staging temporário
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

console.log(`\n=====================================================================`);
console.log(`✅ [SUCESSO] EXECUTÁVEL CRIADO COM SUCESSO NA PASTA /dist !`);
console.log(`📦 Arquivo gerado: dist/RestauranteBot.exe`);
console.log(`📁 Pasta pronta para copiar e usar no restaurante: ${DIST_DIR}`);
console.log(`=====================================================================\n`);
