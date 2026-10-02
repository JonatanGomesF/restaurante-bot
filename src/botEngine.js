const db = require('./database');

// Extrai número de opção de forma tolerante (ex: "1", "1️⃣", "1.", "opcao 1", "opção 1")
function extrairNumeroOpcao(texto) {
    if (!texto) return null;
    const limpo = String(texto).trim();
    // Emoji numérico (1️⃣, 2️⃣, etc.)
    const matchEmoji = limpo.match(/^([1-9]|1[0-9]|20)\uFE0F?\u20E3/);
    if (matchEmoji) return parseInt(matchEmoji[1]);

    // Prefixo tipo "opcao 1", "opção 1", "#1", "1.", "1)"
    const matchNum = limpo.match(/^(?:opç[aã]o|opcao|n[uú]mero|num|#)?\s*([1-9][0-9]?)(?:[.)\s-]|$)/i);
    if (matchNum) return parseInt(matchNum[1]);

    const num = parseInt(limpo);
    return isNaN(num) ? null : num;
}

// Formata valor em moeda BRL (R$ 22,00)
function formatarMoeda(valor) {
    return `R$ ${(Number(valor) || 0).toFixed(2).replace('.', ',')}`;
}

// Processador principal de mensagens do WhatsApp
async function processarMensagem({ from, nome, texto, sendMessage, sendTyping, emitEvent }) {
    const nomeCliente = (nome || 'Cliente').split(' ')[0];
    const mensagemLimpa = (texto || '').trim();
    const mensagemLower = mensagemLimpa.toLowerCase();
    const mensagemSemPontuacao = mensagemLower.replace(/[!?.,;]/g, '').trim();

    const config = db.getConfig();
    const estado = db.getEstadoConversa(from);

    const logEvento = (tipo, detalhe) => {
        if (emitEvent) {
            emitEvent('bot_log', {
                hora: new Date().toLocaleTimeString('pt-BR'),
                cliente: nome,
                telefone: from,
                tipo,
                detalhe
            });
        }
    };

    // Helper para enviar com digitação
    const responder = async (textoResposta) => {
        if (sendTyping) {
            try { await sendTyping(); } catch(e){}
        }
        await sendMessage(from, textoResposta);
        logEvento('saida', textoResposta);
    };

    // Helper para notificar o dono/cozinha
    const notificarDono = async (mensagemNotificacao) => {
        if (config.numeroDono && sendMessage) {
            try {
                await sendMessage(config.numeroDono, mensagemNotificacao);
            } catch (err) {
                console.error("⚠️ Erro ao notificar restaurante via WhatsApp:", err.message);
            }
        }
    };

    logEvento('entrada', mensagemLimpa);

    // 1. Comandos Globais de Interrupção / Menu / Início / Saudação
    if (mensagemSemPontuacao === 'menu' || mensagemSemPontuacao === 'voltar' || 
        mensagemSemPontuacao === 'inicio' || mensagemSemPontuacao === 'início' ||
        mensagemSemPontuacao === 'zerar' || mensagemSemPontuacao === 'recomecar' ||
        mensagemSemPontuacao.match(/^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|eai|eae|start|comecar|começar|oie|salve|fome|pedir)$/i)) {
        db.limparEstadoConversa(from);
        return await enviarMenuPrincipal(responder, nomeCliente, config);
    }

    if (mensagemSemPontuacao === 'cancelar' || mensagemSemPontuacao === 'desistir') {
        return await processarFluxoCancelamento(responder, from, nomeCliente, emitEvent, notificarDono);
    }

    if (mensagemSemPontuacao === 'status' || mensagemSemPontuacao === 'rastrear' || mensagemSemPontuacao === 'meu pedido') {
        return await consultarStatusPedido(responder, from, nomeCliente);
    }

    if (mensagemSemPontuacao === 'cardapio' || mensagemSemPontuacao === 'cardápio') {
        return await enviarCardapioCompleto(responder, config);
    }

    const numOpcao = extrairNumeroOpcao(mensagemLimpa);

    // 2. Se o cliente estiver sem estado ativo (idle)
    if (!estado || estado.status === 'idle' || !estado.status) {
        if (mensagemLower.match(/(pedir|pedido|marmita|marmitex|pizza|comida|fazer pedido|delivery|lanche)/i)) {
            return await iniciarFluxoPedido(responder, from, config);
        }

        // Respostas aos números do Menu Inicial
        if (numOpcao === 1) {
            return await iniciarFluxoPedido(responder, from, config);
        } else if (numOpcao === 2) {
            return await enviarCardapioCompleto(responder, config);
        } else if (numOpcao === 3) {
            return await consultarStatusPedido(responder, from, nomeCliente);
        } else if (numOpcao === 4) {
            return await enviarInfoRestaurante(responder, config);
        } else if (numOpcao === 5) {
            return await processarFluxoCancelamento(responder, from, nomeCliente, emitEvent, notificarDono);
        } else {
            return await enviarMenuPrincipal(responder, nomeCliente, config);
        }
    }

    // 3. Máquina de Estados da Conversa
    switch (estado.status) {
        // ---- ETAPA 1: ESCOLHA DA CATEGORIA DO CARDÁPIO ----
        case 'waiting_category': {
            let categoriaEscolhida = null;
            if (numOpcao === 1 || mensagemLower.includes('marmita') || mensagemLower.includes('almoço')) {
                categoriaEscolhida = 'marmitex';
            } else if (numOpcao === 2 || mensagemLower.includes('pizza') || mensagemLower.includes('jantar')) {
                categoriaEscolhida = 'pizza';
            } else if (numOpcao === 3 || mensagemLower.includes('bebida') || mensagemLower.includes('refrigerante')) {
                categoriaEscolhida = 'bebida';
            }

            if (!categoriaEscolhida) {
                return await responder(
                    `⚠️ Por favor, escolha uma das categorias digitando o número:\n\n` +
                    `1️⃣ 🍱 *Marmitex (Almoço)*\n` +
                    `2️⃣ 🍕 *Pizzas Artesanais (Jantar & Noite)*\n` +
                    `3️⃣ 🥤 *Bebidas & Extras*\n\n` +
                    `_Ou envie *MENU* para voltar._`
                );
            }

            const itensCategoria = db.getCardapio({ categoria: categoriaEscolhida });
            if (itensCategoria.length === 0) {
                return await responder(`Nenhum item disponível nesta categoria no momento. Digite *MENU* para voltar.`);
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_item',
                categoriaAtual: categoriaEscolhida,
                itensExibidos: itensCategoria
            });

            let tituloCat = '🍱 *MARMITEX DO DIA (ALMOÇO)*';
            if (categoriaEscolhida === 'pizza') tituloCat = '🍕 *PIZZAS ARTESANAIS (FORNO)*';
            if (categoriaEscolhida === 'bebida') tituloCat = '🥤 *BEBIDAS GELADAS & EXTRAS*';

            let listaTexto = itensCategoria.map((it, idx) => {
                return `${idx + 1}️⃣ ${it.icone || '🍽️'} *${it.nome}* — ${formatarMoeda(it.preco)}\n   _${it.descricao}_`;
            }).join('\n\n');

            return await responder(
                `${tituloCat}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${listaTexto}\n\n` +
                `👉 *Digite o número da opção que deseja adicionar:* (Ex: 1)\n` +
                `_Envie *MENU* para voltar ao início._`
            );
        }

        // ---- ETAPA 2: ESCOLHA DO ITEM ----
        case 'waiting_item': {
            const itens = estado.itensExibidos || [];
            const index = numOpcao !== null ? numOpcao - 1 : -1;

            if (index < 0 || index >= itens.length) {
                return await responder(
                    `⚠️ Opção inválida! Digite um número de *1 a ${itens.length}* correspondente ao item desejado, ou envie *MENU* para reiniciar.`
                );
            }

            const itemEscolhido = itens[index];

            // Se o item for Marmitex, pergunta a carne / acompanhamento
            if (itemEscolhido.categoria === 'marmitex') {
                const carnes = config.opcoesCarnes || [
                    '🥩 Bife Bovino Acebolado',
                    '🍗 Peito de Frango Grelhado',
                    '🥓 Bisteca Suína na Brasa',
                    '🧀 Filé de Frango à Parmegiana',
                    '🐟 Filé de Peixe Empanado'
                ];

                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_customization_meat',
                    itemEmEdicao: itemEscolhido,
                    carnesDisponiveis: carnes
                });

                let carnesTexto = carnes.map((c, i) => `${i + 1}️⃣ ${c}`).join('\n');

                return await responder(
                    `🍱 Você escolheu: *${itemEscolhido.nome}* (${formatarMoeda(itemEscolhido.preco)})\n\n` +
                    `🥩 *Escolha a opção de carne principal:*\n\n` +
                    `${carnesTexto}\n\n` +
                    `_Digite o número da carne desejada (Ex: 1) ou digite a sua preferência / observações:_`
                );
            }

            // Se for Pizza, pergunta a preferência de borda ou observação
            if (itemEscolhido.categoria === 'pizza') {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_customization_pizza',
                    itemEmEdicao: itemEscolhido
                });

                return await responder(
                    `🍕 Você escolheu: *${itemEscolhido.nome}* (${formatarMoeda(itemEscolhido.preco)})\n\n` +
                    `🧀 *Deseja adicionar Borda Recheada ou alguma observação?*\n\n` +
                    `1️⃣ *Sem Borda Recheada (Tradicional)*\n` +
                    `2️⃣ *Borda de Catupiry (+ R$ 8,00)*\n` +
                    `3️⃣ *Borda de Cheddar (+ R$ 8,00)*\n` +
                    `4️⃣ *Borda de Chocolate (+ R$ 10,00)*\n\n` +
                    `_Digite o número (1 a 4) ou escreva uma observação (Ex: 'Sem cebola'):_`
                );
            }

            // Se for Bebida ou Extra, vai direto para a quantidade
            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_quantity',
                itemEmEdicao: itemEscolhido,
                customizacao: ''
            });

            return await responder(
                `🥤 *${itemEscolhido.nome}* (${formatarMoeda(itemEscolhido.preco)})\n\n` +
                `Quantas unidades você deseja?\n` +
                `_Digite a quantidade (Ex: 1, 2, 3...):_`
            );
        }

        // ---- ETAPA 2.1: CUSTOMIZAÇÃO MARMITEX (CARNE) ----
        case 'waiting_customization_meat': {
            const carnes = estado.carnesDisponiveis || [];
            let carneEscolhida = '';

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= carnes.length) {
                carneEscolhida = carnes[numOpcao - 1];
            } else {
                carneEscolhida = mensagemLimpa; // aceita texto livre
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_quantity',
                customizacao: `Carne: ${carneEscolhida}`
            });

            return await responder(
                `✅ Escolhido: *${carneEscolhida}*\n\n` +
                `Quantas marmitex desse tipo você deseja?\n` +
                `_Digite a quantidade (Ex: 1, 2, 3):_`
            );
        }

        // ---- ETAPA 2.2: CUSTOMIZAÇÃO PIZZA (BORDA / OBS) ----
        case 'waiting_customization_pizza': {
            let bordaObs = 'Sem borda recheada';
            let acrescimo = 0;

            if (numOpcao === 1) {
                bordaObs = 'Tradicional (Sem borda extra)';
            } else if (numOpcao === 2) {
                bordaObs = 'Borda de Catupiry (+ R$ 8,00)';
                acrescimo = 8.00;
            } else if (numOpcao === 3) {
                bordaObs = 'Borda de Cheddar (+ R$ 8,00)';
                acrescimo = 8.00;
            } else if (numOpcao === 4) {
                bordaObs = 'Borda de Chocolate (+ R$ 10,00)';
                acrescimo = 10.00;
            } else {
                bordaObs = mensagemLimpa; // texto livre
            }

            const itemComAcrescimo = {
                ...estado.itemEmEdicao,
                preco: estado.itemEmEdicao.preco + acrescimo
            };

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_quantity',
                itemEmEdicao: itemComAcrescimo,
                customizacao: bordaObs
            });

            return await responder(
                `✅ Preferência anotada: *${bordaObs}*\n\n` +
                `Quantas pizzas dessa você deseja?\n` +
                `_Digite a quantidade (Ex: 1, 2):_`
            );
        }

        // ---- ETAPA 3: QUANTIDADE E CARRINHO ----
        case 'waiting_quantity': {
            let qtd = extrairNumeroOpcao(mensagemLimpa) || 1;
            if (qtd < 1) qtd = 1;
            if (qtd > 50) qtd = 50;

            const item = estado.itemEmEdicao;
            const customizacao = estado.customizacao || '';

            const itemCarrinho = {
                id: item.id,
                nome: item.nome,
                preco: item.preco,
                qtd: qtd,
                observacao: customizacao,
                totalItem: item.preco * qtd
            };

            const carrinhoAtual = Array.isArray(estado.carrinho) ? [...estado.carrinho] : [];
            carrinhoAtual.push(itemCarrinho);

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_more_or_finish',
                carrinho: carrinhoAtual,
                itemEmEdicao: null,
                customizacao: null
            });

            // Monta resumo do carrinho
            let subtotal = 0;
            let resumoCarrinho = carrinhoAtual.map((c, i) => {
                subtotal += c.totalItem;
                const obsTxt = c.observacao ? `\n      ↳ _${c.observacao}_` : '';
                return `🔹 *${c.qtd}x ${c.nome}* — ${formatarMoeda(c.totalItem)}${obsTxt}`;
            }).join('\n');

            return await responder(
                `🛒 *SEU PEDIDO ATUAL:*\n━━━━━━━━━━━━━━━━━━━━\n` +
                `${resumoCarrinho}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `💰 *Subtotal Parcial:* ${formatarMoeda(subtotal)}\n\n` +
                `👉 *O que deseja fazer agora?*\n\n` +
                `1️⃣ ➕ *Adicionar mais itens ao pedido*\n` +
                `2️⃣ 🛵 *Concluir pedido e informar endereço de entrega*\n\n` +
                `_Digite *1* para continuar comprando ou *2* para finalizar._`
            );
        }

        // ---- ETAPA 4: ADICIONAR MAIS OU FINALIZAR ----
        case 'waiting_more_or_finish': {
            if (numOpcao === 1 || mensagemLower.includes('adicionar') || mensagemLower.includes('mais')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_category'
                });

                return await responder(
                    `🍽️ *ESCOLHA UMA CATEGORIA PARA ADICIONAR:* 🍽️\n\n` +
                    `1️⃣ 🍱 *Marmitex (Almoço)*\n` +
                    `2️⃣ 🍕 *Pizzas Artesanais (Jantar & Noite)*\n` +
                    `3️⃣ 🥤 *Bebidas & Extras*\n\n` +
                    `_Digite o número da categoria desejada (1, 2 ou 3):_`
                );
            } else if (numOpcao === 2 || mensagemLower.includes('concluir') || mensagemLower.includes('finalizar') || mensagemLower.includes('entrega')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_delivery_type'
                });

                return await responder(
                    `🛵 *COMO DESEJA RECEBER SEU PEDIDO?*\n\n` +
                    `1️⃣ 🛵 *Delivery* (Entregar em casa / Taxa de entrega fixa ${formatarMoeda(config.taxaEntregaPadrao || 5.00)})\n` +
                    `2️⃣ 🛍️ *Retirada no Balcão* (Buscar no Restaurante sem taxa)\n\n` +
                    `_Digite *1* para Entrega ou *2* para Retirada no Restaurante:_`
                );
            } else {
                return await responder(
                    `⚠️ Digite *1* para adicionar mais itens ou *2* para concluir seu pedido.`
                );
            }
        }

        // ---- ETAPA 5: TIPO DE ENTREGA (DELIVERY / RETIRADA) ----
        case 'waiting_delivery_type': {
            if (numOpcao === 1 || mensagemLower.includes('delivery') || mensagemLower.includes('entrega') || mensagemLower.includes('casa')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_address',
                    tipoEntrega: 'delivery',
                    taxaEntrega: Number(config.taxaEntregaPadrao) || 5.00
                });

                return await responder(
                    `📍 *ENDEREÇO DE ENTREGA:*\n\n` +
                    `Por favor, digite seu endereço completo:\n` +
                    `_(Rua, Número, Bairro, Complemento e Ponto de Referência)_\n\n` +
                    `*Exemplo:* Rua das Flores, 142, Bairro Centro, Apto 23 (próximo à praça).`
                );
            } else if (numOpcao === 2 || mensagemLower.includes('retirada') || mensagemLower.includes('balcão') || mensagemLower.includes('buscar')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_payment_method',
                    tipoEntrega: 'retirada',
                    taxaEntrega: 0,
                    enderecoEntrega: 'Retirada no Balcão'
                });

                return await responder(
                    `🛍️ *RETIRADA NO BALCÃO SELECIONADA!*\n\n` +
                    `Nosso endereço para retirada: *${config.endereco}*\n\n` +
                    `💳 *Escolha a Forma de Pagamento:*\n\n` +
                    `1️⃣ 🔑 *PIX*\n` +
                    `2️⃣ 💳 *Cartão de Débito / Crédito*\n` +
                    `3️⃣ 💵 *Dinheiro*\n\n` +
                    `_Digite o número da forma de pagamento desejada (1, 2 ou 3):_`
                );
            } else {
                return await responder(`⚠️ Por favor, digite *1* para Delivery ou *2* para Retirada.`);
            }
        }

        // ---- ETAPA 6: ENDEREÇO DE ENTREGA ----
        case 'waiting_address': {
            if (mensagemLimpa.length < 5) {
                return await responder(`⚠️ Por favor, informe um endereço completo com rua, número e bairro para que possamos realizar a entrega com segurança!`);
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_payment_method',
                enderecoEntrega: mensagemLimpa
            });

            return await responder(
                `📍 Endereço registrado com sucesso:\n*${mensagemLimpa}*\n\n` +
                `💳 *Escolha a Forma de Pagamento:*\n\n` +
                `1️⃣ 🔑 *PIX* (Chave PIX instantânea)\n` +
                `2️⃣ 💳 *Cartão (Maquininha na Entrega)*\n` +
                `3️⃣ 💵 *Dinheiro*\n\n` +
                `_Digite o número da opção (1, 2 ou 3):_`
            );
        }

        // ---- ETAPA 7: FORMA DE PAGAMENTO ----
        case 'waiting_payment_method': {
            let forma = 'PIX';

            if (numOpcao === 1 || mensagemLower.includes('pix')) {
                forma = 'PIX';
                return await finalizarEConfirmarPedido({ responder, from, nomeCliente, estado, config, formaPagamento: 'PIX', trocoPara: null, emitEvent, notificarDono });
            } else if (numOpcao === 2 || mensagemLower.includes('cartao') || mensagemLower.includes('cartão')) {
                forma = 'Cartão na Entrega';
                return await finalizarEConfirmarPedido({ responder, from, nomeCliente, estado, config, formaPagamento: 'Cartão (Maquininha)', trocoPara: null, emitEvent, notificarDono });
            } else if (numOpcao === 3 || mensagemLower.includes('dinheiro')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_change',
                    formaPagamento: 'Dinheiro'
                });

                return await responder(
                    `💵 *PAGAMENTO EM DINHEIRO:*\n\n` +
                    `Você precisa de troco?\n` +
                    `_Digite o valor para o troco (Ex: *Troco para 50*) ou envie *NÃO* caso tenha o valor exato._`
                );
            } else {
                return await responder(
                    `⚠️ Por favor, digite o número correspondente à forma de pagamento:\n1️⃣ PIX\n2️⃣ Cartão\n3️⃣ Dinheiro`
                );
            }
        }

        // ---- ETAPA 7.1: TROCO PARA DINHEIRO ----
        case 'waiting_change': {
            let trocoPara = null;
            if (!mensagemLower.includes('nao') && !mensagemLower.includes('não') && !mensagemLower.includes('exato')) {
                const numTroco = mensagemLimpa.match(/(\d+(?:[.,]\d+)?)/);
                if (numTroco) {
                    trocoPara = parseFloat(numTroco[1].replace(',', '.'));
                }
            }

            return await finalizarEConfirmarPedido({
                responder,
                from,
                nomeCliente,
                estado,
                config,
                formaPagamento: 'Dinheiro',
                trocoPara,
                emitEvent,
                notificarDono
            });
        }

        // ---- ETAPA 8: CANCELAMENTO SELECIONADO ----
        case 'waiting_cancel_order_selection': {
            const pedidos = db.getPedidosCliente(from);
            const index = numOpcao !== null ? numOpcao - 1 : -1;

            if (index < 0 || index >= pedidos.length) {
                return await responder(`⚠️ Opção inválida. Digite o número correspondente ao pedido que deseja cancelar ou envie *MENU*.`);
            }

            const pedidoParaCancelar = pedidos[index];
            const cancelado = db.cancelarPedido(pedidoParaCancelar.id, from);
            db.limparEstadoConversa(from);

            if (cancelado.success) {
                if (emitEvent) {
                    emitEvent('agendamento_cancelado', cancelado.pedido);
                }

                await notificarDono(
                    `⚠️ *PEDIDO CANCELADO PELO CLIENTE*\n\n` +
                    `🆔 *Código:* ${pedidoParaCancelar.codigo}\n` +
                    `👤 *Cliente:* ${pedidoParaCancelar.cliente}\n` +
                    `📱 *Contato:* ${pedidoParaCancelar.telefone.replace('@c.us', '')}\n` +
                    `🍽️ *Itens:* ${pedidoParaCancelar.servico}\n` +
                    `💰 *Valor Total:* ${formatarMoeda(pedidoParaCancelar.total)}`
                );

                return await responder(
                    `✅ Seu pedido *${pedidoParaCancelar.codigo}* foi cancelado com sucesso!\n\n` +
                    `Se desejar fazer um novo pedido a qualquer momento, basta enviar *MENU*!`
                );
            } else {
                return await responder(`⚠️ ${cancelado.error || 'Não foi possível cancelar o pedido.'}`);
            }
        }

        default:
            db.limparEstadoConversa(from);
            return await enviarMenuPrincipal(responder, nomeCliente, config);
    }
}

// ---------------------------------------------------------------------
// Finalização e Criação do Pedido
// ---------------------------------------------------------------------
async function finalizarEConfirmarPedido({ responder, from, nomeCliente, estado, config, formaPagamento, trocoPara, emitEvent, notificarDono }) {
    const carrinho = estado.carrinho || [];
    if (carrinho.length === 0) {
        db.limparEstadoConversa(from);
        return await responder(`Seu carrinho estava vazio. Digite *MENU* para iniciar um novo pedido!`);
    }

    const taxa = estado.tipoEntrega === 'delivery' ? (Number(estado.taxaEntrega) || Number(config.taxaEntregaPadrao) || 5.00) : 0;
    
    const resultado = db.criarPedido({
        cliente: nomeCliente,
        telefone: from,
        itens: carrinho,
        tipoEntrega: estado.tipoEntrega || 'delivery',
        enderecoEntrega: estado.enderecoEntrega || '',
        formaPagamento: formaPagamento,
        trocoPara: trocoPara,
        taxaEntrega: taxa,
        origem: 'whatsapp'
    });

    if (!resultado.success) {
        db.limparEstadoConversa(from);
        return await responder(`😔 ${resultado.error || 'Não foi possível processar seu pedido no momento.'}`);
    }

    const ped = resultado.pedido;
    db.limparEstadoConversa(from);

    // Emite evento para o dashboard em tempo real
    if (emitEvent) {
        emitEvent('novo_agendamento', ped);
    }

    // Notifica a Cozinha / Dono
    let comandaItensDono = ped.itens.map(i => {
        const obs = i.observacao ? ` (${i.observacao})` : '';
        return `• ${i.qtd}x ${i.nome}${obs} = ${formatarMoeda(i.total)}`;
    }).join('\n');

    let entregaInfoDono = ped.tipoEntrega === 'delivery' 
        ? `🛵 *DELIVERY:* ${ped.enderecoEntrega}`
        : `🛍️ *RETIRADA NO BALCÃO*`;

    let trocoTxt = ped.trocoPara ? ` (Troco para ${formatarMoeda(ped.trocoPara)})` : '';

    await notificarDono(
        `🚨 *NOVO PEDIDO CHEGOU!* [${ped.codigo}]\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Cliente:* ${ped.cliente}\n` +
        `📱 *WhatsApp:* ${ped.telefone.replace('@c.us', '')}\n` +
        `${entregaInfoDono}\n` +
        `💳 *Pagamento:* ${ped.formaPagamento}${trocoTxt}\n\n` +
        `📝 *ITENS DO PEDIDO:*\n${comandaItensDono}\n\n` +
        `💵 *Subtotal:* ${formatarMoeda(ped.subtotal)}\n` +
        `🛵 *Taxa Entrega:* ${formatarMoeda(ped.taxaEntrega)}\n` +
        `💰 *TOTAL GERAL: ${formatarMoeda(ped.total)}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⏰ *Hora:* ${ped.horario} | 🆔 *ID:* ${ped.id}`
    );

    // Mensagem VIP de Confirmação para o Cliente
    let comandaCliente = ped.itens.map(i => {
        const obs = i.observacao ? `\n   ↳ _${i.observacao}_` : '';
        return `🔹 *${i.qtd}x ${i.nome}* — ${formatarMoeda(i.total)}${obs}`;
    }).join('\n');

    let pixInfoCliente = '';
    if (formaPagamento === 'PIX' && config.chavePix) {
        pixInfoCliente = `\n🔑 *Chave PIX para pagamento:*\n\`${config.chavePix}\`\n_(Envie o comprovante aqui no chat se preferir)_\n`;
    }

    let localEntregaCliente = ped.tipoEntrega === 'delivery'
        ? `📍 *Endereço de Entrega:* ${ped.enderecoEntrega}`
        : `🛍️ *Retirar no Restaurante:* ${config.endereco}`;

    return await responder(
        `🎉 *PEDIDO RECEBIDO COM SUCESSO!* 🎉\n\n` +
        `🍽️ *${config.nomeRestaurante.toUpperCase()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎫 *Número do Pedido:* *${ped.codigo}*\n` +
        `👤 *Cliente:* ${ped.cliente}\n` +
        `${localEntregaCliente}\n` +
        `💳 *Forma de Pagamento:* ${ped.formaPagamento}${trocoTxt}\n` +
        pixInfoCliente +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *ITENS:*\n${comandaCliente}\n\n` +
        `💵 *Subtotal:* ${formatarMoeda(ped.subtotal)}\n` +
        (ped.taxaEntrega > 0 ? `🛵 *Taxa de Entrega:* ${formatarMoeda(ped.taxaEntrega)}\n` : '') +
        `💰 *TOTAL A PAGAR: ${formatarMoeda(ped.total)}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⏳ *Tempo Estimado:* ${ped.tempoEstimado}\n` +
        `👨‍🍳 *Status Atual:* 🟡 _Recebido na cozinha e entrando em preparo!_\n\n` +
        `💡 *Dica:* A qualquer momento você pode enviar *STATUS* para acompanhar seu pedido!\n\n` +
        `_Bom apetite e muito obrigado pela preferência!_ 😋🍲🍕`
    );
}

// ---------------------------------------------------------------------
// Menus e Helpers
// ---------------------------------------------------------------------

// Envia o Menu Principal do Restaurante
async function enviarMenuPrincipal(responder, nomeCliente, config) {
    const fechadoHoje = db.isFechadoHoje();
    let avisoFechado = '';
    if (fechadoHoje) {
        avisoFechado = `\n🛑 *AVISO:* O restaurante está fechado hoje (${config.motivoFechado || 'Recesso/Descanso'}).\n`;
    }

    const turno = db.getTurnoAtual();
    let avisoTurno = `⏰ *Agora:* ${turno.icone} ${turno.nome} — _${turno.descricao}_\n`;

    return await responder(
        `🍽️ *BEM-VINDO AO ${config.nomeRestaurante.toUpperCase()}* 🍽️\n\n` +
        `Olá, *${nomeCliente}*! O que você gostaria de saborear hoje?\n\n` +
        avisoTurno +
        avisoFechado + `\n` +
        `1️⃣ 🛒 *Fazer Pedido (Marmitex / Pizzas / Bebidas)*\n` +
        `2️⃣ 📋 *Ver Cardápio Completo*\n` +
        `3️⃣ 🛵 *Acompanhar Meu Pedido (Status)*\n` +
        `4️⃣ 📍 *Horários, Endereço & Formas de Pagamento*\n` +
        `5️⃣ ❌ *Cancelar Pedido*\n\n` +
        `👉 _Digite o número da opção desejada para continuar (Ex: *1*):_`
    );
}

// Inicia o fluxo de pedido
async function iniciarFluxoPedido(responder, from, config) {
    db.setEstadoConversa(from, {
        status: 'waiting_category',
        carrinho: []
    });

    const turno = db.getTurnoAtual();

    return await responder(
        `🛒 *FAZER PEDIDO — ${config.nomeRestaurante.toUpperCase()}* 🍽️\n\n` +
        `Escolha a categoria desejada:\n\n` +
        `1️⃣ 🍱 *Marmitex do Dia (Almoço)* ${turno.tipo === 'dia' ? '🟢 _(Recomendado Agora)_' : ''}\n` +
        `2️⃣ 🍕 *Pizzas Artesanais (Jantar & Noite)* ${turno.tipo === 'noite' ? '🟢 _(Recomendado Agora)_' : ''}\n` +
        `3️⃣ 🥤 *Bebidas & Extras*\n\n` +
        `_Digite o número da categoria desejada (1, 2 ou 3):_`
    );
}

// Envia o cardápio completo organizado
async function enviarCardapioCompleto(responder, config) {
    const cardapio = db.getCardapio();

    const marmitex = cardapio.filter(i => i.categoria === 'marmitex');
    const pizzas = cardapio.filter(i => i.categoria === 'pizza');
    const bebidas = cardapio.filter(i => i.categoria === 'bebida' || i.categoria === 'extra');

    let texto = `📜 *CARDÁPIO COMPLETO — ${config.nomeRestaurante.toUpperCase()}*\n\n`;

    texto += `🍱 *MARMITEX (ALMOÇO — 11h às 15h)*\n`;
    texto += marmitex.map(m => `• *${m.nome}* — ${formatarMoeda(m.preco)}\n  _${m.descricao}_`).join('\n');
    texto += `\n\n🥩 *Carnes Disponíveis:* Bife Acebolado, Frango Grelhado, Bisteca Suína, Parmegiana, Peixe Empanado.\n\n`;

    texto += `🍕 *PIZZAS (JANTAR & NOITE — 18h às 23h30)*\n`;
    texto += pizzas.map(p => `• *${p.nome}* — ${formatarMoeda(p.preco)}\n  _${p.descricao}_`).join('\n');
    texto += `\n\n🥤 *BEBIDAS & EXTRAS*\n`;
    texto += bebidas.map(b => `• *${b.nome}* — ${formatarMoeda(b.preco)}`).join('\n');

    texto += `\n\n━━━━━━━━━━━━━━━━━━━━\n` +
        `🛵 *Taxa de Entrega Padrão:* ${formatarMoeda(config.taxaEntregaPadrao || 5.00)}\n` +
        `💳 *Pagamento:* PIX, Cartão e Dinheiro\n\n` +
        `_Envie *1* para fazer seu pedido agora mesmo!_`;

    return await responder(texto);
}

// Consulta status dos pedidos do cliente
async function consultarStatusPedido(responder, from, nomeCliente) {
    const pedidos = db.getPedidosCliente(from);

    if (pedidos.length === 0) {
        db.limparEstadoConversa(from);
        return await responder(
            `📋 Olá, *${nomeCliente}*!\n\n` +
            `Você não possui nenhum pedido em andamento no momento.\n\n` +
            `Deseja fazer um pedido delicioso agora? Envie *1* para pedir!`
        );
    }

    const mapaStatus = {
        'pendente': '🟡 *Recebido na Cozinha* (Aguardando forno/fogão)',
        'em_preparo': '👨‍🍳 *Em Preparo* (No fogo/forno com todo capricho!)',
        'saiu_entrega': '🛵 *Saiu para Entrega / Pronto para Retirada* (A caminho!)',
        'concluido': '✅ *Entregue / Concluído*',
        'cancelado': '❌ *Cancelado*'
    };

    let lista = pedidos.map(p => {
        const statusTexto = mapaStatus[p.status] || p.status;
        const tipoTxt = p.tipoEntrega === 'delivery' ? '🛵 Delivery' : '🛍️ Retirada';
        return `🎫 *Pedido ${p.codigo}*\n` +
            `🍽️ *Itens:* ${p.servico}\n` +
            `💰 *Total:* ${formatarMoeda(p.total)} (${tipoTxt})\n` +
            `⏳ *Previsão:* ${p.tempoEstimado}\n` +
            `📍 *Status:* ${statusTexto}\n`;
    }).join('\n━━━━━━━━━━━━━━━━━━━━\n\n');

    return await responder(
        `🛵 *STATUS DOS SEUS PEDIDOS:*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${lista}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_Qualquer dúvida ou alteração, nossa equipe está à disposição!_`
    );
}

// Cancelamento de pedidos
async function processarFluxoCancelamento(responder, from, nomeCliente, emitEvent, notificarDono) {
    const pedidos = db.getPedidosCliente(from);

    if (pedidos.length === 0) {
        db.limparEstadoConversa(from);
        return await responder(
            `📋 Olá, *${nomeCliente}*!\n\n` +
            `Você não possui pedidos ativos para cancelar no momento.\n\n` +
            `Envie *1* se desejar fazer um novo pedido.`
        );
    }

    if (pedidos.length === 1) {
        const ped = pedidos[0];
        const res = db.cancelarPedido(ped.id, from);
        db.limparEstadoConversa(from);

        if (res.success) {
            if (emitEvent) emitEvent('agendamento_cancelado', res.pedido);
            await notificarDono(
                `⚠️ *PEDIDO CANCELADO PELO CLIENTE*\n\n` +
                `🎫 *Código:* ${ped.codigo}\n` +
                `👤 *Cliente:* ${ped.cliente}\n` +
                `🍽️ *Itens:* ${ped.servico}\n` +
                `💰 *Valor:* ${formatarMoeda(ped.total)}`
            );

            return await responder(
                `✅ Seu pedido *${ped.codigo}* foi cancelado com sucesso!\n\n` +
                `Caso queira fazer um novo pedido, basta enviar *MENU*.`
            );
        } else {
            return await responder(`⚠️ ${res.error || 'Não foi possível cancelar o pedido.'}`);
        }
    }

    db.setEstadoConversa(from, { status: 'waiting_cancel_order_selection' });
    let lista = pedidos.map((p, i) => `${i + 1}️⃣ *Pedido ${p.codigo}* — ${p.servico} (${formatarMoeda(p.total)})`).join('\n');

    return await responder(
        `📋 *SEUS PEDIDOS ATIVOS:*\n\n` +
        `${lista}\n\n` +
        `_Digite o número do pedido que deseja cancelar (ou envie *MENU* para voltar):_`
    );
}

// Informações e Horários do Restaurante
async function enviarInfoRestaurante(responder, config) {
    const fechadoHoje = db.isFechadoHoje();
    let statusHoje = fechadoHoje 
        ? `🛑 *Hoje:* Fechado (${config.motivoFechado || 'Recesso'})`
        : `🟢 *Hoje:* Aberto para Almoço e Jantar`;

    return await responder(
        `📍 *INFORMAÇÕES & ATENDIMENTO — ${config.nomeRestaurante.toUpperCase()}* 🍽️\n\n` +
        `🏠 *Endereço:* ${config.endereco}\n` +
        `🍱 *Horário do Almoço (Marmitex):* ${config.horarioAlmoco || '11:00 às 15:00'}\n` +
        `🍕 *Horário da Noite (Pizzaria):* ${config.horarioJantar || '18:00 às 23:30'}\n` +
        `🛵 *Taxa de Entrega:* ${formatarMoeda(config.taxaEntregaPadrao || 5.00)}\n` +
        `🔑 *Chave PIX:* \`${config.chavePix || 'Não informada'}\`\n` +
        `📅 *Status Hoje:* ${statusHoje}\n` +
        `📱 *Contato / WhatsApp:* ${config.numeroDono ? config.numeroDono.replace('@c.us', '') : ''}\n\n` +
        `_Envie *1* para fazer seu pedido ou *MENU* para ver as opções._`
    );
}

module.exports = {
    processarMensagem
};
