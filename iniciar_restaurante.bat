@echo off
title Restaurante Bom Sabor - WhatsApp Delivery Bot
chcp 65001 > nul
color 0E

echo =====================================================================
echo    🍽️ INICIANDO BOT DE PEDIDOS - RESTAURANTE BOM SABOR 🍽️
echo    Marmitex de Dia (Almoço) e Pizzaria de Noite (Jantar)
echo =====================================================================
echo.
echo [1/3] Acessando pasta do projeto...
cd /d "%~dp0"

echo [2/3] Abrindo o Painel de Controle no seu navegador...
start "" "http://localhost:3000"

echo [3/3] Iniciando o servidor e WhatsApp Web...
echo.
echo =====================================================================
echo   STATUS: Painel online em http://localhost:3000
echo   DICA: Deixe esta janela aberta durante o expediente de vendas!
echo =====================================================================
echo.

node chatbot.js

echo.
echo O bot foi encerrado.
pause
