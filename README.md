# 🚀 Bot Delivery — Plataforma Multi-Cliente

Sistema de bot para WhatsApp voltado a estabelecimentos de **delivery** (restaurantes, pizzarias, marmitarias), com painel web em tempo real e banco de dados compartilhado na nuvem (**Supabase**).

---

## 📦 Estrutura do Projeto

```
botDelivery/
├── config_delivery.json     ← ✏️ ÚNICO ARQUIVO QUE MUDA POR CLIENTE
├── setup_banco.js           ← Script de setup (rode 1x na instalação)
├── supabase_schema.sql      ← Schema do banco (cole no SQL Editor 1x)
├── agendamentos.json        ← Cache local (gerado automaticamente)
├── src/
│   ├── database.js          ← Lógica do banco (multi-tenant)
│   ├── botEngine.js         ← Lógica do chatbot WhatsApp
│   ├── server.js            ← API REST + Painel Web
│   └── whatsappClient.js    ← Conexão com WhatsApp Web
└── public/                  ← Painel administrativo (frontend)
```

> ⚠️ **Atenção — segurança do pacote de distribuição:**
> - O `DeliveryBot.exe` **não deve** ser testado a partir da pasta `dist`: o app cria ali a pasta `.wwebjs_auth` com a **sessão do WhatsApp logada**. Enviar essa pasta a um cliente entrega o seu WhatsApp.
> - Rode `node build_exe.js --limpar` antes de compactar/enviar. Esse comando remove `.wwebjs_auth`, `.wwebjs_cache`, `agendamentos.json` e logs.
> - O isolamento multi-tenant descrito abaixo **não está implementado** — veja [`SEGURANCA_MULTITENANT.md`](./SEGURANCA_MULTITENANT.md).

---

## 🔐 Checklist de sigilo (antes de enviar para qualquer cliente)

| Item | Como garantir |
|---|---|
| Sessão do WhatsApp | Não testar o `.exe` dentro de `dist`; rodar `node build_exe.js --limpar` |
| Chave PIX / telefone do dono | Não ficam no pacote — o cliente preenche no painel |
| Cardápio e pedidos do cliente anterior | `agendamentos.json` não é mais copiado no build; é criado limpo no 1º boot |
| RLS do banco | ⚠️ ** Pendente** — hoje a chave `anon` acessa todos os clientes |

---

## 📁 Distribuição para um novo cliente

```
1. Abra config_delivery.json (raiz) e ajuste clienteId + nomeEstabelecimento
2. npm run build:exe
3. NÃO abra o .exe de dentro de dist/ para testar
4. Compacte a pasta dist e envie ao cliente
5. O cliente edita dist/config_delivery.json e dá 2 cliques em INICIAR.bat
```

---

## 🗄️ Como o Banco está Organizado

O banco **Supabase** é **compartilhado** entre todos os clientes, mas cada cliente é **totalmente isolado** por um `cliente_id` único.

### Tabelas

| Tabela | Descrição | Isolamento |
|---|---|---|
| `clientes` | Um registro por estabelecimento | `id` (PRIMARY KEY) |
| `pedidos` | Todos os pedidos de todos os clientes | `cliente_id` |
| `cardapio` | Cardápio de cada cliente | `cliente_id` + `item_id` |
| `categorias` | Categorias do cardápio por cliente | `cliente_id` + `categoria_id` |
| `opcoes_extras` | Carnes, bordas, complementos | `cliente_id` + `tipo` + `opcao_id` |
| `conversas` | Estado do chatbot por cliente/telefone | `cliente_id` + `telefone` |
| `mensagens_bot` | Templates de mensagens configuráveis | `cliente_id` + `chave` |
| `configuracoes_extras` | Chave-valor livre (expansível) | `cliente_id` + `chave` |

### Diagrama de Relações

```
clientes (id)
    │
    ├── pedidos          (cliente_id → clientes.id)
    ├── cardapio         (cliente_id → clientes.id)
    ├── categorias       (cliente_id → clientes.id)
    ├── opcoes_extras    (cliente_id → clientes.id)
    ├── conversas        (cliente_id → clientes.id)
    ├── mensagens_bot    (cliente_id → clientes.id)
    └── configuracoes_extras (cliente_id → clientes.id)
```

> ❌ **Segurança — ATENÇÃO:** o RLS está ativado, mas as políticas atuais usam `USING (true)`. Na prática, **qualquer cliente com o `.exe` em mãos acessa os dados de todos os outros** (nome, telefone e endereço dos consumidores). O isolamento real ainda **não foi implementado** — leia [`SEGURANCA_MULTITENANT.md`](./SEGURANCA_MULTITENANT.md) antes de escalar para múltiplos clientes.

---

## ⚙️ Configurando para um Novo Cliente

### 1. Edite o `config_delivery.json`

Este é o **único arquivo que precisa ser alterado** para cada cliente:

```json
{
  "clienteId": "pizzaria_joao_sp",
  "nomeEstabelecimento": "Pizzaria do João",
  "descricao": "Configuração do cliente delivery.",
  "githubRepo": "JonatanGomesF/restaurante-bot",
  "branch": "main"
}
```

> ⚠️ **Regras para o `clienteId`:**
> - Use apenas letras minúsculas, números e `_`
> - Sem espaços ou acentos
> - Deve ser **único** para cada cliente
> - Exemplos: `pizzaria_maria_rj`, `marmitex_da_ana_sp`, `hamburgueria_top_mg`

---

### 2. Execute o Setup (apenas 1x por cliente)

```bash
node setup_banco.js
```

O script irá:
- ✅ Testar a conexão com o banco
- 🎉 Criar o registro do cliente no Supabase
- 📋 Popular o cardápio padrão
- 📂 Criar as categorias padrão
- 🥩 Criar as opções de carnes e bordas

**Se as tabelas ainda não existirem no banco**, o script exibirá o SQL para você copiar e colar no [SQL Editor do Supabase](https://supabase.com/dashboard/project/errczksxtizgpmjzfhnv/sql/new).

---

### 3. Inicie o Bot

```bash
npm start
```

Acesse o painel em: **http://localhost:3000**

Na primeira vez, escaneie o QR Code com o WhatsApp do estabelecimento.

---

## 🔄 Fluxo Completo de Instalação em um Cliente

```
1. Copiar a pasta do projeto para a máquina do cliente
         ↓
2. Editar config_delivery.json
   (clienteId e nomeEstabelecimento)
         ↓
3. npm install
         ↓
4. node setup_banco.js
   → Se pedir SQL: cole no Supabase e rode de novo
         ↓
5. npm start
         ↓
6. Escanear QR Code com WhatsApp do cliente
         ↓
✅ Bot funcionando!
```

---

## 🌐 Informações do Banco

| Item | Valor |
|---|---|
| **Plataforma** | Supabase (PostgreSQL) |
| **URL** | `https://errczksxtizgpmjzfhnv.supabase.co` |
| **Projeto** | `rocketBotDelivery` |
| **Schema** | `public` |
| **Estratégia** | Multi-tenant por `cliente_id` |

---

## ➕ Adicionando Funcionalidades por Cliente

Para acrescentar dados extras sem alterar o schema, use a tabela `configuracoes_extras`:

```sql
-- Exemplo: adicionar taxa de entrega por bairro para um cliente
INSERT INTO configuracoes_extras (cliente_id, chave, valor, descricao)
VALUES (
  'pizzaria_joao_sp',
  'taxas_por_bairro',
  '{"Centro": 5.00, "Vila Nova": 8.00, "Jardim": 12.00}',
  'Taxa de entrega separada por bairro'
);
```

Isso permite expandir o sistema **sem criar novas colunas**, mantendo o schema limpo.

---

## 🛠️ Comandos Úteis

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o bot e o painel web |
| `node setup_banco.js` | Configura o banco para o cliente atual |
| `npm run build:exe` | Gera o `.exe` para distribuição |

---

## 📁 Arquivos Importantes

| Arquivo | Função |
|---|---|
| [`config_delivery.json`](./config_delivery.json) | Identidade do cliente (editar por instalação) |
| [`supabase_schema.sql`](./supabase_schema.sql) | SQL completo do banco (aplicar 1x no Supabase) |
| [`setup_banco.js`](./setup_banco.js) | Script de provisionamento do cliente |
| [`src/database.js`](./src/database.js) | Toda a lógica de acesso ao banco |

---

## ❓ Perguntas Frequentes

**O banco de um cliente pode ver os dados de outro?**
> Não. O isolamento é garantido pelo campo `cliente_id` em todas as tabelas e pelo RLS do Supabase.

**E se o cliente não tiver internet?**
> O bot opera em modo offline usando o arquivo `agendamentos.json` local. Quando a conexão voltar, sincroniza automaticamente.

**Posso ter dois clientes na mesma máquina?**
> Sim, desde que em pastas diferentes, cada uma com seu próprio `config_delivery.json` com `clienteId` único.

**Como mudar o cardápio de um cliente?**
> Pelo painel web em `http://localhost:3000`. Qualquer alteração é salva localmente e sincronizada para o Supabase automaticamente.
