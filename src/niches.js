// =====================================================================
// src/niches.js — Termos dinâmicos por nicho (mensagens padrão)
// ---------------------------------------------------------------------
// A engine usa estas mensagens apenas quando o cliente NÃO possui
// mensagens customizadas no Supabase (tabela relacional mensagens_bot:
// id, cliente_id, chave, conteudo — sem JSONs empacotados).
//
// Precedência resolvida em database.js#sincronizarComSupabase:
//   custom (Supabase) > nicho (este arquivo)
//
// Nichos suportados pelo ecossistema (painel SaaS):
//   delivery (padrão) | barbershop | clinic | petshop | salon
// =====================================================================

// ── DELIVERY — restaurantes, marmitarias, pizzarias ─────────────────
const MENSAGENS_DELIVERY = {
    menuPrincipal: `🍽️ *BEM-VINDO AO {restaurante}* 🍽️\n\nOlá, *{nome}*! O que você gostaria de saborear hoje?\n\n{avisoTurno}\n{avisoFechado}\n1️⃣ 🛒 *Fazer Pedido (Marmitex / Pizzas / Bebidas)*\n2️⃣ 📋 *Ver Cardápio Completo*\n3️⃣ 🛵 *Acompanhar Meu Pedido (Status)*\n4️⃣ 📍 *Horários, Endereço & Formas de Pagamento*\n5️⃣ ❌ *Cancelar Pedido*\n\n👉 _Digite o número da opção desejada (Ex: *1*):_`,
    fechadoAviso: `🛑 *AVISO:* O restaurante está fechado hoje ({motivo}).`,
    escolhaCategoria: `🛒 *FAZER PEDIDO — {restaurante}* 🍽️\n\nEscolha a categoria desejada:\n\n{listaCategorias}\n\n_Digite o número da categoria desejada (Ex: 1):_`,
    escolhaItem: `{tituloCategoria}\n━━━━━━━━━━━━━━━━━━━━\n\n{listaItens}\n\n👉 *Digite o número da opção que deseja adicionar:* (Ex: 1)\n_Envie *MENU* para voltar ao início._`,
    escolhaModoPizza: `🍕 Você escolheu: *{item}* ({preco})\n\nComo deseja montar a sua pizza?\n\n1️⃣ 🍕 *Pizza Inteira (Apenas {item})*\n2️⃣ 🌓 *Pizza Meio a Meio (Escolher 2º sabor)*\n\n_Digite *1* para Inteira ou *2* para Meio a Meio:_`,
    escolhaSegundaMetade: `🌓 *ESCOLHA O 2º SABOR DA SUA PIZZA:*\n━━━━━━━━━━━━━━━━━━━━\n1º Sabor: *{primeiroSabor}* ({precoPrimeiro})\n━━━━━━━━━━━━━━━━━━━━\n\n{listaSabores}\n\n👉 *Digite o número do 2º sabor desejado:*\n_(O valor da pizza será calculado pelo sabor de maior valor)_`,
    escolhaCarne: `🍱 Você escolheu: *{item}* ({preco})\n\n🥩 *Escolha a opção de carne principal:*\n\n{listaCarnes}\n\n_Digite o número da carne desejada (Ex: 1) ou digite sua preferência / observações:_`,
    escolhaBorda: `🍕 Você escolheu: *{item}* ({preco})\n\n🧀 *Deseja adicionar Borda Recheada ou alguma observação?*\n\n{listaBordas}\n\n_Digite o número ou escreva sua observação (Ex: 'Sem cebola'):_`,
    carrinhoResumo: `🛒 *SEU PEDIDO ATUAL:*\n━━━━━━━━━━━━━━━━━━━━\n{resumoCarrinho}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Subtotal Parcial:* {subtotal}\n\n👉 *O que deseja fazer agora?*\n\n1️⃣ ➕ *Adicionar mais itens ao pedido*\n2️⃣ 🛵 *Concluir pedido e informar endereço de entrega*\n\n_Digite *1* para continuar comprando ou *2* para finalizar._`,
    tipoEntrega: `🛵 *COMO DESEJA RECEBER SEU PEDIDO?*\n\n1️⃣ 🛵 *Delivery* (Entregar em casa / Taxa {taxa})\n2️⃣ 🛍️ *Retirada no Balcão* (Buscar no Restaurante sem taxa)\n\n_Digite *1* para Entrega ou *2* para Retirada no Restaurante:_`,
    solicitarEndereco: `📍 *ENDEREÇO DE ENTREGA:*\n\nPor favor, digite seu endereço completo:\n_(Rua, Número, Bairro, Complemento e Ponto de Referência)_\n\n*Exemplo:* Rua das Flores, 142, Bairro Centro, Apto 23 (próximo à praça).`,
    formaPagamento: `📍 Endereço registrado com sucesso:\n*{endereco}*\n\n💳 *Escolha a Forma de Pagamento:*\n\n1️⃣ 🔑 *PIX* (Chave instantânea)\n2️⃣ 💳 *Cartão (Maquininha na Entrega)*\n3️⃣ 💵 *Dinheiro*\n\n_Digite o número da opção (1, 2 ou 3):_`,
    trocoDinheiro: `💵 *PAGAMENTO EM DINHEIRO:*\n\nVocê precisa de troco?\n_Digite o valor para o troco (Ex: *Troco para 50*) ou envie *NÃO* caso tenha o valor exato._`,
    pedidoConfirmadoCliente: `🎉 *PEDIDO RECEBIDO COM SUCESSO!* 🎉\n\n🍽️ *{restaurante}*\n━━━━━━━━━━━━━━━━━━━━\n🎫 *Número do Pedido:* *{codigo}*\n👤 *Cliente:* {nome}\n{localEntrega}\n💳 *Forma de Pagamento:* {formaPagamento}\n{pixInfo}\n━━━━━━━━━━━━━━━━━━━━\n📋 *ITENS:*\n{itens}\n\n💵 *Subtotal:* {subtotal}\n{taxaInfo}💰 *TOTAL A PAGAR: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏳ *Tempo Estimado:* {tempo}\n👨‍🍳 *Status Atual:* 🟡 _Recebido na cozinha e entrando em preparo!_\n\n💡 *Dica:* A qualquer momento você pode enviar *STATUS* para acompanhar seu pedido!\n\n_Bom apetite e muito obrigado pela preferência!_ 😋🍲🍕`,
    notificacaoCozinha: `🚨 *NOVO PEDIDO CHEGOU!* [{codigo}]\n━━━━━━━━━━━━━━━━━━━━\n👤 *Cliente:* {nome}\n📱 *WhatsApp:* {telefone}\n{localEntrega}\n💳 *Pagamento:* {formaPagamento}\n\n📝 *ITENS DO PEDIDO:*\n{itens}\n\n💵 *Subtotal:* {subtotal}\n🛵 *Taxa Entrega:* {taxa}\n💰 *TOTAL GERAL: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏰ *Hora:* {hora} | 🆔 *ID:* {id}`,
    pedidoEmPreparo:      `👨‍🍳 *Seu pedido [{codigo}] já está no fogo/forno sendo preparado no capricho!*`,
    pedidoSaiuEntrega:    `🛵 *Oba! Seu pedido [{codigo}] acabou de sair para entrega e está a caminho!*`,
    pedidoProntoRetirada: `🛍️ *Seu pedido [{codigo}] está prontinho para retirada no balcão!*`,
    pedidoConcluido:      `✅ *Pedido [{codigo}] entregue com sucesso! Bom apetite e volte sempre!* 😋❤️`,
    pedidoCancelado:      `✅ Seu pedido *{codigo}* foi cancelado com sucesso!\n\nCaso queira fazer um novo pedido, basta enviar *MENU*.`,
    infoRestaurante:      `📍 *INFORMAÇÕES & ATENDIMENTO — {restaurante}* 🍽️\n\n🏠 *Endereço:* {endereco}\n🍱 *Horário do Almoço (Marmitex):* {horarioAlmoco}\n🍕 *Horário da Noite (Pizzaria):* {horarioJantar}\n🛵 *Taxa de Entrega:* {taxa}\n🔑 *Chave PIX:* \`{pix}\`\n📅 *Status Hoje:* {statusHoje}\n📱 *Contato / WhatsApp:* {telefoneDono}\n\n_Envie *1* para fazer seu pedido ou *MENU* para ver as opções._`
};

// ── BASE "AGENDA/SERVIÇOS" — barbershop, clinic, petshop, salon ─────
// Mesmas chaves da engine; a redação é neutra para agendamento.
function montarTemplatesAgendamento() {
    return {
        menuPrincipal: `👋 *BEM-VINDO AO {restaurante}* 👋\n\nOlá, *{nome}*! Como podemos ajudar hoje?\n\n{avisoTurno}\n{avisoFechado}\n1️⃣ 🛒 *Agendar / Contratar Serviço*\n2️⃣ 📋 *Ver Serviços & Preços*\n3️⃣ 📍 *Horários, Endereço & Pagamento*\n4️⃣ ❌ *Cancelar Agendamento*\n\n👉 _Digite o número da opção desejada (Ex: *1*):_`,
        fechadoAviso: `🛑 *AVISO:* O estabelecimento está fechado hoje ({motivo}).`,
        escolhaCategoria: `🛒 *AGENDAMENTO — {restaurante}* 📅\n\nEscolha a categoria desejada:\n\n{listaCategorias}\n\n_Digite o número da categoria desejada (Ex: 1):_`,
        escolhaItem: `{tituloCategoria}\n━━━━━━━━━━━━━━━━━━━━\n\n{listaItens}\n\n👉 *Digite o número do serviço que deseja contratar:* (Ex: 1)\n_Envie *MENU* para voltar ao início._`,
        escolhaModoPizza: `Você escolheu: *{item}* ({preco})\n\n_Digite *1* para confirmar este serviço._`,
        escolhaSegundaMetade: `Você escolheu: *{item}* ({preco})\n\n_Digite *1* para confirmar ou *2* para escolher outro serviço:_`,
        escolhaCarne: `Você escolheu: *{item}* ({preco})\n\n📝 *Alguma preferência ou observação?*\n_Digite sua observação ou envie *OK* para continuar:_`,
        escolhaBorda: `Você escolheu: *{item}* ({preco})\n\n📝 *Alguma observação adicional?*\n_Digite ou envie *OK* para continuar:_`,
        carrinhoResumo: `🛒 *SEU ATENDIMENTO ATUAL:*\n━━━━━━━━━━━━━━━━━━━━\n{resumoCarrinho}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total:* {subtotal}\n\n👉 *O que deseja fazer agora?*\n\n1️⃣ ➕ *Adicionar outro serviço*\n2️⃣ ✅ *Confirmar e concluir agendamento*\n\n_Digite *1* para continuar ou *2* para finalizar._`,
        tipoEntrega: `📋 *COMO DESEJA CONCLUIR O AGENDAMENTO?*\n\n1️⃣ ✅ *Confirmar agendamento*\n2️⃣ ➕ *Adicionar outro serviço*\n\n_Digite *1* ou *2*:_`,
        solicitarEndereco: `📍 *ENDEREÇO:*\n\nSe necessário, informe um endereço / ponto de referência:\n\n*Exemplo:* Rua das Flores, 142, Bairro Centro.`,
        formaPagamento: `✅ Registrado!\n\n💳 *Escolha a Forma de Pagamento:*\n\n1️⃣ 🔑 *PIX*\n2️⃣ 💳 *Cartão*\n3️⃣ 💵 *Dinheiro*\n\n_Digite o número da opção (1, 2 ou 3):_`,
        trocoDinheiro: `💵 *PAGAMENTO EM DINHEIRO:*\n\nVocê precisa de troco?\n_Digite o valor (Ex: *Troco para 50*) ou envie *NÃO*._`,
        pedidoConfirmadoCliente: `🎉 *AGENDAMENTO CONFIRMADO COM SUCESSO!* 🎉\n\n🏪 *{restaurante}*\n━━━━━━━━━━━━━━━━━━━━\n🎫 *Número:* *{codigo}*\n👤 *Cliente:* {nome}\n{localEntrega}\n💳 *Forma de Pagamento:* {formaPagamento}\n{pixInfo}\n━━━━━━━━━━━━━━━━━━━━\n📋 *SERVIÇOS:*\n{itens}\n\n{taxaInfo}💰 *TOTAL: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏳ *Previsão:* {tempo}\n👨‍💼 *Status Atual:* 🟡 _Recebido e em análise._\n\n_Bom atendimento e muito obrigado pela preferência!_ 😊`,
        notificacaoCozinha: `🚨 *NOVO AGENDAMENTO!* [{codigo}]\n━━━━━━━━━━━━━━━━━━━━\n👤 *Cliente:* {nome}\n📱 *WhatsApp:* {telefone}\n{localEntrega}\n💳 *Pagamento:* {formaPagamento}\n\n📝 *SERVIÇOS:*\n{itens}\n\n💰 *TOTAL: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏰ *Hora:* {hora} | 🆔 *ID:* {id}`,
        pedidoEmPreparo:      `👨‍💼 *Seu atendimento [{codigo}] já está sendo providenciado!*`,
        pedidoSaiuEntrega:    `🚚 *Seu atendimento [{codigo}] está a caminho / em andamento!*`,
        pedidoProntoRetirada: `🛍️ *Seu atendimento [{codigo}] está pronto!*`,
        pedidoConcluido:      `✅ *Atendimento [{codigo}] concluído com sucesso! Volte sempre!* 😊`,
        pedidoCancelado:      `✅ Seu atendimento *{codigo}* foi cancelado com sucesso!\n\nCaso queira reagendar, basta enviar *MENU*.`,
        infoRestaurante:      `📍 *INFORMAÇÕES & ATENDIMENTO — {restaurante}* 🏪\n\n🏠 *Endereço:* {endereco}\n🗓️ *Horário de Funcionamento:* {horarioAlmoco} | {horarioJantar}\n🛵 *Taxa:* {taxa}\n🔑 *Chave PIX:* \`{pix}\`\n📅 *Status Hoje:* {statusHoje}\n📱 *Contato / WhatsApp:* {telefoneDono}\n\n_Envie *1* para agendar ou *MENU* para ver as opções._`
    };
}

const MENSAGENS_NICHO = {
    delivery:   MENSAGENS_DELIVERY,
    barbershop: montarTemplatesAgendamento(),
    clinic:     montarTemplatesAgendamento(),
    petshop:    montarTemplatesAgendamento(),
    salon:      montarTemplatesAgendamento()
};

// Resolve as mensagens padrão de um nicho, com fallback para delivery.
function getMensagensNicho(niche) {
    return MENSAGENS_NICHO[niche] || MENSAGENS_DELIVERY;
}

module.exports = {
    MENSAGENS_NICHO,
    getMensagensNicho
};