# 🍽️ Restaurante Bom Sabor — WhatsApp Delivery Bot & Painel de Cozinha

Sistema inteligente e automatizado para **Restaurante e Delivery via WhatsApp**.

- 🍱 **Almoço / Dia (11h às 15h):** Marmitex variadas com opções de carnes e guarnições do dia.
- 🍕 **Jantar / Noite (18h às 23h30):** Pizzas artesanais assadas no forno e bebidas geladas.
- 🛵 **Delivery & Retirada:** Cálculo automático de taxa de entrega, endereço e formas de pagamento (PIX, Cartão na Entrega, Dinheiro com troco).
- 👨‍🍳 **Painel da Cozinha em Tempo Real:** Acompanhamento de pedidos ao vivo (Pendentes, Em Preparo, Saiu para Entrega, Entregues).

---

## 🚀 Como Iniciar

1. Dê um duplo clique no arquivo `iniciar_restaurante.bat` (ou execute `npm start`).
2. O Painel de Controle abrirá automaticamente em `http://localhost:3000`.
3. Na aba **Conexão WhatsApp**, aponte a câmera do WhatsApp para escanear o QR Code.
4. Pronto! O bot começará a atender os clientes e receber os pedidos automaticamente.

---

## 📱 Fluxo do Cliente no WhatsApp

1. **Cardápio Inteligente:** O cliente digita `1` ou `pedir` e o bot lista as opções de Marmitex ou Pizzas conforme o turno do dia.
2. **Personalização:** Escolha da carne (Bife, Frango, Bisteca, Parmegiana) ou Borda Recheada.
3. **Carrinho de Compras:** Adiciona itens, quantidades e complementos.
4. **Entrega ou Retirada:** Solicita o endereço completo ou confirma retirada no balcão.
5. **Pagamento:** PIX com envio da chave, Cartão na entrega ou Dinheiro com cálculo de troco.
6. **Acompanhamento de Status:** O cliente pode enviar `STATUS` a qualquer momento para ver se o pedido está sendo preparado ou já saiu com o motoboy.

---

## ⚙️ Tecnologias

- **Node.js & Express**
- **whatsapp-web.js & Puppeteer**
- **Socket.io** (atualizações em tempo real)
- **Vanilla CSS & JS** com tema Gourmet Dark moderno
