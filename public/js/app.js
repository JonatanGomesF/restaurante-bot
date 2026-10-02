// Restaurante Bom Sabor & WhatsApp Delivery Hub Engine
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        lucide.createIcons();
    }

    function getTodayDateString() {
        const d = new Date();
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

    function formatarMoeda(val) {
        return `R$ ${(Number(val) || 0).toFixed(2).replace('.', ',')}`;
    }

    // Estado da Aplicação
    const state = {
        currentTab: 'tab-qrcode',
        selectedDate: getTodayDateString(),
        menu: [],
        activeMenuFilter: 'marmitex',
        config: {},
        stats: {},
        botStatus: 'DISCONNECTED',
        orders: []
    };

    // Elementos DOM
    const elements = {
        navBtns: document.querySelectorAll('.nav-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        pageTitle: document.getElementById('page-title'),
        pageSubtitle: document.getElementById('page-subtitle'),
        sidebarSalonName: document.getElementById('sidebar-salon-name'),
        liveClock: document.getElementById('live-clock'),

        // Status Sidebar & QR
        statusPulse: document.getElementById('status-pulse'),
        sidebarStatusText: document.getElementById('sidebar-status-text'),
        sidebarStatusSubtext: document.getElementById('sidebar-status-subtext'),
        qrNavBadge: document.getElementById('qr-nav-badge'),
        qrStatusPill: document.getElementById('qr-status-pill'),
        qrContainerWaiting: document.getElementById('qr-container-waiting'),
        qrContainerConnected: document.getElementById('qr-container-connected'),
        qrImage: document.getElementById('qr-image'),
        qrLoader: document.getElementById('qr-loader'),
        qrProgress: document.getElementById('qr-progress'),

        // Connected Info
        userPushname: document.getElementById('user-pushname'),
        userPhone: document.getElementById('user-phone'),
        userPlatform: document.getElementById('user-platform'),
        btnRestartBot: document.getElementById('btn-restart-bot'),
        btnLogoutBot: document.getElementById('btn-logout-bot'),
        btnManualRefreshQr: document.getElementById('btn-manual-refresh-qr'),

        // Stats Cards
        statHoje: document.getElementById('stat-hoje'),
        statLivres: document.getElementById('stat-livres'),
        statTotal: document.getElementById('stat-total'),
        statFaturamento: document.getElementById('stat-faturamento'),
        todayCountBadge: document.getElementById('today-count-badge'),

        // Live Orders Cozinha
        calendarSelectedDateLabel: document.getElementById('calendar-selected-date-label'),
        calendarSelectedDateSub: document.getElementById('calendar-selected-date-sub'),
        btnPrevDay: document.getElementById('btn-prev-day'),
        btnNextDay: document.getElementById('btn-next-day'),
        slotsGridContainer: document.getElementById('slots-grid-container'),
        calendarClosedAlert: document.getElementById('calendar-closed-alert'),
        calendarClosedReason: document.getElementById('calendar-closed-reason'),
        btnQuickReopen: document.getElementById('btn-quick-reopen'),

        // Orders Table
        searchAppointments: document.getElementById('search-appointments'),
        filterStatus: document.getElementById('filter-status'),
        filterDate: document.getElementById('filter-date'),
        appointmentsTableBody: document.getElementById('appointments-table-body'),

        // Simulator & Logs
        simBarberTitle: document.getElementById('sim-barber-title'),
        simMessagesBody: document.getElementById('sim-messages-body'),
        simInput: document.getElementById('sim-input'),
        btnSimSend: document.getElementById('btn-sim-send'),
        logsConsole: document.getElementById('logs-console'),
        btnClearLogs: document.getElementById('btn-clear-logs'),

        // Config Geral
        formConfigGeral: document.getElementById('form-config-geral'),
        cfgNome: document.getElementById('cfg-nome'),
        cfgDono: document.getElementById('cfg-dono'),
        cfgEndereco: document.getElementById('cfg-endereco'),
        cfgTaxa: document.getElementById('cfg-taxa'),
        cfgPix: document.getElementById('cfg-pix'),
        cfgAlmoco: document.getElementById('cfg-almoco'),
        cfgJantar: document.getElementById('cfg-jantar'),

        // Modo Hoje Fechado
        cardStatusFuncionamento: document.getElementById('card-status-funcionamento'),
        badgeStatusFechado: document.getElementById('badge-status-fechado'),
        txtBadgeStatusFechado: document.getElementById('txt-badge-status-fechado'),
        cfgMotivoFechado: document.getElementById('cfg-motivo-fechado'),
        btnToggleFechadoHoje: document.getElementById('btn-toggle-fechado-hoje'),
        txtBtnToggleFechado: document.getElementById('txt-btn-toggle-fechado'),

        // Cardápio
        servicesListContainer: document.getElementById('services-list-container'),
        btnAddService: document.getElementById('btn-add-service'),
        btnFilterMarmitex: document.getElementById('btn-filter-marmitex'),
        btnFilterPizza: document.getElementById('btn-filter-pizza'),
        btnFilterBebidas: document.getElementById('btn-filter-bebidas'),
        btnFilterTodos: document.getElementById('btn-filter-todos'),

        // Modal
        btnModalNovoAgendamento: document.getElementById('btn-modal-novo-agendamento'),
        modalAgendamento: document.getElementById('modal-agendamento'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        btnCancelModal: document.getElementById('btn-cancel-modal'),
        formNovoAgendamento: document.getElementById('form-novo-agendamento'),
        modalCliente: document.getElementById('modal-cliente'),
        modalTelefone: document.getElementById('modal-telefone'),
        modalTipoEntrega: document.getElementById('modal-tipo-entrega'),
        modalPagamento: document.getElementById('modal-pagamento'),
        modalGroupEndereco: document.getElementById('modal-group-endereco'),
        modalEndereco: document.getElementById('modal-endereco'),
        modalServico: document.getElementById('modal-servico'),

        btnRefreshAll: document.getElementById('btn-refresh-all'),
        toastContainer: document.getElementById('toast-container')
    };

    // ------------------------------------------------------------------
    // Socket.io
    // ------------------------------------------------------------------
    let socket = null;
    try {
        if (typeof io !== 'undefined') {
            socket = io({
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                timeout: 10000
            });

            socket.on('connect', () => {
                addLog('system', 'Conectado à central do Restaurante');
                fetchStatus();
            });

            socket.on('status_change', (data) => {
                updateBotStatusUI(data);
            });

            socket.on('qr', (data) => {
                updateQrUI(data);
            });

            socket.on('ready', (data) => {
                updateBotStatusUI({ status: 'READY', userInfo: data.userInfo });
                showToast('WhatsApp conectado com sucesso!', 'success');
                refreshData();
            });

            socket.on('novo_agendamento', (ped) => {
                showToast(`🚨 Novo Pedido [${ped.codigo || '#PED'}]: ${ped.cliente}`, 'success');
                addLog('saida', `Novo pedido recebido: ${ped.cliente} (${ped.servico})`);
                refreshData();
                playNotificationSound();
            });

            socket.on('pedido_atualizado', () => {
                refreshData();
            });

            socket.on('agendamento_atualizado', () => {
                refreshData();
            });

            socket.on('agendamento_cancelado', (ped) => {
                showToast(`⚠️ Pedido cancelado: ${ped.codigo || ''} ${ped.cliente}`, 'info');
                addLog('system', `Pedido cancelado: ${ped.codigo || ''} ${ped.cliente}`);
                refreshData();
            });

            socket.on('bot_log', (log) => {
                addLog(log.tipo, `${log.cliente ? `[${log.cliente}] ` : ''}${log.detalhe}`);
            });

            socket.on('stats_update', (stats) => {
                updateStatsUI(stats);
            });

            socket.on('config_atualizada', (cfg) => {
                state.config = cfg;
                applyConfigToUI(cfg, false);
            });
        }
    } catch (e) {}

    // Clock
    function updateClock() {
        const now = new Date();
        if (elements.liveClock) elements.liveClock.textContent = now.toLocaleTimeString('pt-BR');
    }
    setInterval(updateClock, 1000);
    updateClock();

    function showToast(message, type = 'info') {
        if (!elements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'error') iconName = 'alert-triangle';

        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span>${message}</span>
        `;
        elements.toastContainer.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {}
    }

    function addLog(tipo, texto) {
        if (!elements.logsConsole) return;
        const entry = document.createElement('div');
        entry.className = `log-entry ${tipo}`;
        const hora = new Date().toLocaleTimeString('pt-BR');
        entry.innerHTML = `<span class="log-time">[${hora}]</span> <span class="log-text">${escapeHtml(texto)}</span>`;
        elements.logsConsole.appendChild(entry);
        elements.logsConsole.scrollTop = elements.logsConsole.scrollHeight;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Tabs Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    function switchTab(tabId) {
        state.currentTab = tabId;
        elements.navBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
        elements.tabContents.forEach(tc => tc.classList.toggle('active', tc.id === tabId));

        if (tabId === 'tab-qrcode') {
            elements.pageTitle.textContent = 'Conexão WhatsApp & QR Code';
            elements.pageSubtitle.textContent = 'Escaneie o código para ativar o bot de pedidos automáticos';
        } else if (tabId === 'tab-calendar') {
            elements.pageTitle.textContent = 'Cozinha & Pedidos ao Vivo';
            elements.pageSubtitle.textContent = 'Painel em tempo real de pedidos de marmitex e pizzas';
            renderLiveOrders();
        } else if (tabId === 'tab-appointments') {
            elements.pageTitle.textContent = 'Histórico de Pedidos';
            elements.pageSubtitle.textContent = 'Registro de todas as vendas, delivery e retiradas';
            renderOrdersTable();
        } else if (tabId === 'tab-simulator') {
            elements.pageTitle.textContent = 'Simulador de WhatsApp & Logs';
            elements.pageSubtitle.textContent = 'Teste o cardápio e faça pedidos como se fosse um cliente no WhatsApp';
        } else if (tabId === 'tab-settings') {
            elements.pageTitle.textContent = 'Cardápio & Restaurante';
            elements.pageSubtitle.textContent = 'Personalize itens de marmitex, pizzas, taxas e horários';
            renderMenuList();
        }

        if (window.lucide) lucide.createIcons();
    }

    // ------------------------------------------------------------------
    // API REST Calls
    // ------------------------------------------------------------------
    async function fetchStatus() {
        try {
            const res = await fetch(`/api/status?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                updateBotStatusUI(data);
                if (data.stats) updateStatsUI(data.stats);
            }
        } catch (e) {}
    }

    async function fetchOrders() {
        try {
            const res = await fetch(`/api/orders?t=${Date.now()}`);
            if (res.ok) {
                state.orders = await res.json();
                renderLiveOrders();
                renderOrdersTable();
            }
        } catch (e) {}
    }

    async function fetchMenu() {
        try {
            const res = await fetch(`/api/menu?t=${Date.now()}`);
            if (res.ok) {
                state.menu = await res.json();
                renderMenuList();
                populateModalSelect();
            }
        } catch (e) {}
    }

    async function fetchConfig() {
        try {
            const res = await fetch(`/api/config?t=${Date.now()}`);
            if (res.ok) {
                state.config = await res.json();
                applyConfigToUI(state.config, true);
            }
        } catch (e) {}
    }

    async function refreshData() {
        await Promise.all([fetchStatus(), fetchOrders(), fetchMenu(), fetchConfig()]);
    }

    // ------------------------------------------------------------------
    // Bot Status & QR UI
    // ------------------------------------------------------------------
    function updateBotStatusUI(data) {
        const status = data.status || 'DISCONNECTED';
        state.botStatus = status;

        if (elements.statusPulse) {
            elements.statusPulse.classList.toggle('online', status === 'READY');
        }

        if (status === 'READY') {
            if (elements.sidebarStatusText) elements.sidebarStatusText.textContent = 'Bot Online & Ativo';
            if (elements.sidebarStatusSubtext) elements.sidebarStatusSubtext.textContent = 'Recebendo pedidos';
            if (elements.qrNavBadge) {
                elements.qrNavBadge.textContent = 'ONLINE';
                elements.qrNavBadge.style.background = 'var(--accent-emerald)';
                elements.qrNavBadge.style.color = '#FFF';
            }
            if (elements.qrStatusPill) {
                elements.qrStatusPill.className = 'connection-status-pill online';
                elements.qrStatusPill.querySelector('.pill-text').textContent = 'Conectado';
            }
            if (elements.qrContainerWaiting) elements.qrContainerWaiting.classList.add('hidden');
            if (elements.qrContainerConnected) elements.qrContainerConnected.classList.remove('hidden');

            const info = data.userInfo || {};
            if (elements.userPushname) elements.userPushname.textContent = info.pushname || 'Restaurante Bom Sabor';
            if (elements.userPhone) elements.userPhone.textContent = info.wid ? info.wid.replace('@c.us', '') : '--';
            if (elements.userPlatform) elements.userPlatform.textContent = info.platform || 'WhatsApp Web';
        } else {
            if (elements.sidebarStatusText) elements.sidebarStatusText.textContent = status === 'QR_READY' ? 'Aguardando QR Code' : 'Desconectado';
            if (elements.sidebarStatusSubtext) elements.sidebarStatusSubtext.textContent = 'Escaneie para conectar';
            if (elements.qrNavBadge) {
                elements.qrNavBadge.textContent = 'QR';
                elements.qrNavBadge.style.background = '';
                elements.qrNavBadge.style.color = '';
            }
            if (elements.qrStatusPill) {
                elements.qrStatusPill.className = 'connection-status-pill';
                elements.qrStatusPill.querySelector('.pill-text').textContent = 'Aguardando QR';
            }
            if (elements.qrContainerWaiting) elements.qrContainerWaiting.classList.remove('hidden');
            if (elements.qrContainerConnected) elements.qrContainerConnected.classList.add('hidden');

            if (data.qrImage) {
                updateQrUI({ qrImage: data.qrImage });
            }
        }
    }

    function updateQrUI(data) {
        if (data.qrImage && elements.qrImage) {
            elements.qrImage.src = data.qrImage;
            elements.qrImage.classList.remove('hidden');
            if (elements.qrLoader) elements.qrLoader.classList.add('hidden');
            if (elements.qrProgress) {
                elements.qrProgress.style.transition = 'none';
                elements.qrProgress.style.width = '100%';
                setTimeout(() => {
                    elements.qrProgress.style.transition = 'width 25s linear';
                    elements.qrProgress.style.width = '0%';
                }, 50);
            }
        }
    }

    function updateStatsUI(stats) {
        state.stats = stats;
        if (elements.statHoje) elements.statHoje.textContent = stats.pedidosHoje || 0;
        if (elements.statLivres) elements.statLivres.textContent = stats.pedidosPendentes || 0;
        if (elements.statTotal) elements.statTotal.textContent = stats.pedidosConcluidos || 0;
        if (elements.statFaturamento) elements.statFaturamento.textContent = formatarMoeda(stats.faturamentoHoje || 0);
        if (elements.todayCountBadge) elements.todayCountBadge.textContent = stats.pedidosPendentes || 0;
    }

    function applyConfigToUI(cfg, fillForm = true) {
        const nome = cfg.nomeRestaurante || 'Restaurante Bom Sabor';
        if (elements.sidebarSalonName) elements.sidebarSalonName.textContent = nome;
        if (elements.simBarberTitle) elements.simBarberTitle.textContent = nome;

        // Fechado hoje
        const fechado = Boolean(cfg.fechadoHoje);
        if (elements.badgeStatusFechado) {
            elements.badgeStatusFechado.className = `closed-status-pill ${fechado ? 'closed' : 'open'}`;
            if (elements.txtBadgeStatusFechado) {
                elements.txtBadgeStatusFechado.textContent = fechado ? '🛑 Restaurante Fechado Hoje' : '🟢 Restaurante Aberto';
            }
        }
        if (elements.btnToggleFechadoHoje && elements.txtBtnToggleFechado) {
            elements.btnToggleFechadoHoje.className = fechado ? 'btn btn-secondary' : 'btn btn-danger-solid';
            elements.txtBtnToggleFechado.textContent = fechado ? '🟢 Reabrir Restaurante Hoje' : '🛑 Ativar Modo: RESTAURANTE FECHADO HOJE';
        }
        if (elements.calendarClosedAlert) {
            elements.calendarClosedAlert.classList.toggle('hidden', !fechado);
            if (elements.calendarClosedReason) {
                elements.calendarClosedReason.textContent = cfg.motivoFechado || 'Atendimento pausado pelo administrador.';
            }
        }

        if (fillForm) {
            if (elements.cfgNome) elements.cfgNome.value = cfg.nomeRestaurante || '';
            if (elements.cfgDono) elements.cfgDono.value = cfg.numeroDono ? cfg.numeroDono.replace('@c.us', '') : '';
            if (elements.cfgEndereco) elements.cfgEndereco.value = cfg.endereco || '';
            if (elements.cfgTaxa) elements.cfgTaxa.value = cfg.taxaEntregaPadrao || 5.00;
            if (elements.cfgPix) elements.cfgPix.value = cfg.chavePix || '';
            if (elements.cfgAlmoco) elements.cfgAlmoco.value = cfg.horarioAlmoco || '11:00 às 15:00';
            if (elements.cfgJantar) elements.cfgJantar.value = cfg.horarioJantar || '18:00 às 23:30';
            if (elements.cfgMotivoFechado) elements.cfgMotivoFechado.value = cfg.motivoFechado || '';
        }
    }

    // ------------------------------------------------------------------
    // RENDER: COZINHA & PEDIDOS AO VIVO
    // ------------------------------------------------------------------
    function renderLiveOrders() {
        if (!elements.slotsGridContainer) return;

        const pedidosHoje = state.orders.filter(p => p.status !== 'cancelado' && p.status !== 'concluido');

        if (pedidosHoje.length === 0) {
            elements.slotsGridContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
                    <div style="font-size: 42px; margin-bottom: 12px;">👨‍🍳🍽️</div>
                    <h3 style="font-size: 1.2rem; margin-bottom: 6px;">Nenhum pedido pendente no momento</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Os novos pedidos de Marmitex e Pizza realizados pelo WhatsApp aparecerão aqui instantaneamente!</p>
                </div>
            `;
            return;
        }

        elements.slotsGridContainer.innerHTML = pedidosHoje.map(ped => {
            const statusClass = ped.status || 'pendente';
            const statusLabels = {
                'pendente': '🟡 Pendente (Cozinha)',
                'em_preparo': '👨‍🍳 Em Preparo',
                'saiu_entrega': '🛵 Saiu p/ Entrega'
            };

            const tipoEntregaTxt = ped.tipoEntrega === 'delivery' 
                ? `🛵 <strong>Delivery:</strong> ${escapeHtml(ped.enderecoEntrega || 'Endereço informado')}`
                : `🛍️ <strong>Retirada no Balcão</strong>`;

            return `
                <div class="order-live-card">
                    <div class="order-card-header">
                        <div>
                            <span class="order-code">${escapeHtml(ped.codigo || '#PED')}</span>
                            <span class="order-time">⏰ ${escapeHtml(ped.horario || '')}</span>
                        </div>
                        <span class="order-status-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span>
                    </div>

                    <div style="font-size: 0.95rem; font-weight: 600;">
                        👤 ${escapeHtml(ped.cliente)} &nbsp;
                        <small style="color: var(--text-muted); font-weight: normal;">(${escapeHtml((ped.telefone || '').replace('@c.us', ''))})</small>
                    </div>

                    <div class="order-items-box">
                        🍽️ <strong>Itens:</strong><br>
                        ${escapeHtml(ped.servico || 'Refeição')}
                    </div>

                    <div class="order-address-box">
                        ${tipoEntregaTxt}<br>
                        💳 <strong>Pagamento:</strong> ${escapeHtml(ped.formaPagamento || 'PIX')}
                    </div>

                    <div class="order-total-row">
                        <span>Total a Receber:</span>
                        <span style="color: var(--neon-amber);">${formatarMoeda(ped.total || ped.preco)}</span>
                    </div>

                    <div class="order-actions-row">
                        ${ped.status === 'pendente' ? `
                            <button class="btn btn-primary btn-xs btn-change-status" data-id="${ped.id}" data-status="em_preparo">
                                👨‍🍳 Iniciar Preparo
                            </button>
                        ` : ''}
                        ${ped.status === 'em_preparo' ? `
                            <button class="btn btn-secondary btn-xs btn-change-status" data-id="${ped.id}" data-status="saiu_entrega">
                                🛵 Saiu p/ Entrega
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-xs btn-change-status" data-id="${ped.id}" data-status="concluido" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald);">
                            ✅ Entregue
                        </button>
                        <button class="btn btn-danger-outline btn-xs btn-change-status" data-id="${ped.id}" data-status="cancelado">
                            ❌ Cancelar
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners para alterar status
        document.querySelectorAll('.btn-change-status').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const status = e.currentTarget.getAttribute('data-status');
                await alterarStatusPedido(id, status);
            });
        });

        if (window.lucide) lucide.createIcons();
    }

    async function alterarStatusPedido(id, status) {
        try {
            const res = await fetch(`/api/orders/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, avisarCliente: true })
            });

            if (res.ok) {
                showToast(`Status do pedido atualizado para ${status}!`, 'success');
                fetchOrders();
            } else {
                showToast('Erro ao atualizar status do pedido.', 'error');
            }
        } catch (err) {
            showToast('Erro de conexão ao atualizar pedido.', 'error');
        }
    }

    // ------------------------------------------------------------------
    // RENDER: HISTÓRICO DE PEDIDOS (TABELA)
    // ------------------------------------------------------------------
    function renderOrdersTable() {
        if (!elements.appointmentsTableBody) return;

        let lista = [...state.orders];
        const statusFiltro = elements.filterStatus ? elements.filterStatus.value : '';
        const dataFiltro = elements.filterDate ? elements.filterDate.value : '';
        const buscaFiltro = elements.searchAppointments ? elements.searchAppointments.value.toLowerCase() : '';

        if (statusFiltro) lista = lista.filter(p => p.status === statusFiltro);
        if (dataFiltro) lista = lista.filter(p => p.data === dataFiltro);
        if (buscaFiltro) {
            lista = lista.filter(p =>
                (p.cliente && p.cliente.toLowerCase().includes(buscaFiltro)) ||
                (p.codigo && p.codigo.toLowerCase().includes(buscaFiltro)) ||
                (p.servico && p.servico.toLowerCase().includes(buscaFiltro)) ||
                (p.telefone && p.telefone.includes(buscaFiltro))
            );
        }

        if (lista.length === 0) {
            elements.appointmentsTableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
                        Nenhum pedido encontrado com os filtros selecionados.
                    </td>
                </tr>
            `;
            return;
        }

        elements.appointmentsTableBody.innerHTML = lista.map(ped => {
            const statusLabels = {
                'pendente': '<span class="order-status-badge pendente">🟡 Pendente</span>',
                'em_preparo': '<span class="order-status-badge em_preparo">👨‍🍳 Preparando</span>',
                'saiu_entrega': '<span class="order-status-badge saiu_entrega">🛵 A Caminho</span>',
                'concluido': '<span class="order-status-badge concluido">✅ Entregue</span>',
                'cancelado': '<span class="order-status-badge" style="background: rgba(239, 68, 68, 0.2); color: var(--accent-rose);">❌ Cancelado</span>'
            };

            const tipoTxt = ped.tipoEntrega === 'delivery' ? `🛵 Delivery (${escapeHtml(ped.enderecoEntrega || '')})` : `🛍️ Balcão`;

            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(ped.codigo || '#PED')}</strong><br>
                        <small style="color: var(--text-muted);">${escapeHtml(ped.data || '')} ${escapeHtml(ped.horario || '')}</small>
                    </td>
                    <td><strong>${escapeHtml(ped.cliente)}</strong></td>
                    <td>${escapeHtml((ped.telefone || '').replace('@c.us', ''))}</td>
                    <td style="max-width: 250px;">${escapeHtml(ped.servico || '')}</td>
                    <td style="max-width: 200px;"><small>${tipoTxt}</small></td>
                    <td><strong style="color: var(--neon-amber);">${formatarMoeda(ped.total || ped.preco)}</strong></td>
                    <td><small>${escapeHtml(ped.formaPagamento || 'PIX')}</small></td>
                    <td>${statusLabels[ped.status] || ped.status}</td>
                    <td>
                        ${ped.status !== 'concluido' && ped.status !== 'cancelado' ? `
                            <button class="btn btn-secondary btn-xs btn-table-concluir" data-id="${ped.id}" title="Concluir">
                                <i data-lucide="check"></i>
                            </button>
                            <button class="btn btn-danger-outline btn-xs btn-table-cancelar" data-id="${ped.id}" title="Cancelar">
                                <i data-lucide="x"></i>
                            </button>
                        ` : '—'}
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-table-concluir').forEach(btn => {
            btn.addEventListener('click', () => alterarStatusPedido(btn.getAttribute('data-id'), 'concluido'));
        });
        document.querySelectorAll('.btn-table-cancelar').forEach(btn => {
            btn.addEventListener('click', () => alterarStatusPedido(btn.getAttribute('data-id'), 'cancelado'));
        });

        if (window.lucide) lucide.createIcons();
    }

    if (elements.filterStatus) elements.filterStatus.addEventListener('change', renderOrdersTable);
    if (elements.filterDate) elements.filterDate.addEventListener('change', renderOrdersTable);
    if (elements.searchAppointments) elements.searchAppointments.addEventListener('input', renderOrdersTable);

    // ------------------------------------------------------------------
    // RENDER: CARDÁPIO (MARMITEX, PIZZAS & BEBIDAS)
    // ------------------------------------------------------------------
    function renderMenuList() {
        if (!elements.servicesListContainer) return;

        let itens = [...state.menu];
        if (state.activeMenuFilter !== 'todos') {
            if (state.activeMenuFilter === 'marmitex') itens = itens.filter(i => i.categoria === 'marmitex');
            if (state.activeMenuFilter === 'pizza') itens = itens.filter(i => i.categoria === 'pizza');
            if (state.activeMenuFilter === 'bebidas') itens = itens.filter(i => i.categoria === 'bebida' || i.categoria === 'extra');
        }

        elements.servicesListContainer.innerHTML = itens.map(it => {
            return `
                <div class="service-card-item">
                    <div class="service-card-info">
                        <strong>${it.icone || '🍽️'} ${escapeHtml(it.nome)}</strong>
                        <span>${escapeHtml(it.descricao || '')}</span>
                    </div>
                    <div class="service-card-price">
                        ${formatarMoeda(it.preco)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function setupMenuFilters() {
        const btns = [
            { el: elements.btnFilterMarmitex, val: 'marmitex' },
            { el: elements.btnFilterPizza, val: 'pizza' },
            { el: elements.btnFilterBebidas, val: 'bebidas' },
            { el: elements.btnFilterTodos, val: 'todos' }
        ];

        btns.forEach(b => {
            if (b.el) {
                b.el.addEventListener('click', () => {
                    btns.forEach(x => { if (x.el) x.el.classList.remove('active'); });
                    b.el.classList.add('active');
                    state.activeMenuFilter = b.val;
                    renderMenuList();
                });
            }
        });
    }
    setupMenuFilters();

    function populateModalSelect() {
        if (!elements.modalServico) return;
        elements.modalServico.innerHTML = state.menu.map(it => {
            return `<option value="${it.id}">${it.icone || ''} ${escapeHtml(it.nome)} — ${formatarMoeda(it.preco)}</option>`;
        }).join('');
    }

    // ------------------------------------------------------------------
    // SIMULADOR DE WHATSAPP
    // ------------------------------------------------------------------
    async function enviarMensagemSimulador() {
        const input = elements.simInput;
        if (!input) return;
        const txt = input.value.trim();
        if (!txt) return;

        input.value = '';

        // Adiciona bolha do usuário
        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const userBubble = document.createElement('div');
        userBubble.className = 'chat-bubble outgoing';
        userBubble.innerHTML = `<div class="bubble-text">${escapeHtml(txt)}</div><span class="bubble-time">${hora}</span>`;
        elements.simMessagesBody.appendChild(userBubble);
        elements.simMessagesBody.scrollTop = elements.simMessagesBody.scrollHeight;

        try {
            const res = await fetch('/api/simulator/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mensagem: txt,
                    nome: 'Cliente Navegador'
                })
            });

            if (res.ok) {
                const data = await res.json();
                (data.respostas || []).forEach(resp => {
                    const botBubble = document.createElement('div');
                    botBubble.className = 'chat-bubble incoming';
                    const textoFormatado = resp.texto
                        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                        .replace(/_(.*?)_/g, '<em>$1</em>')
                        .replace(/`(.*?)`/g, '<code>$1</code>')
                        .replace(/\n/g, '<br>');
                    botBubble.innerHTML = `<div class="bubble-text">${textoFormatado}</div><span class="bubble-time">${hora}</span>`;
                    elements.simMessagesBody.appendChild(botBubble);
                });
                elements.simMessagesBody.scrollTop = elements.simMessagesBody.scrollHeight;
            }
        } catch (err) {}
    }

    if (elements.btnSimSend) elements.btnSimSend.addEventListener('click', enviarMensagemSimulador);
    if (elements.simInput) {
        elements.simInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') enviarMensagemSimulador();
        });
    }

    if (elements.btnClearLogs) {
        elements.btnClearLogs.addEventListener('click', () => {
            if (elements.logsConsole) elements.logsConsole.innerHTML = '';
        });
    }

    // ------------------------------------------------------------------
    // CONFIGURAÇÕES GERAIS E TOGGLE FECHADO
    // ------------------------------------------------------------------
    if (elements.formConfigGeral) {
        elements.formConfigGeral.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                nomeRestaurante: elements.cfgNome.value,
                numeroDono: elements.cfgDono.value ? `${elements.cfgDono.value.replace(/\D/g, '')}@c.us` : '',
                endereco: elements.cfgEndereco.value,
                taxaEntregaPadrao: Number(elements.cfgTaxa.value) || 5.00,
                chavePix: elements.cfgPix.value,
                horarioAlmoco: elements.cfgAlmoco.value,
                horarioJantar: elements.cfgJantar.value
            };

            try {
                const res = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    showToast('Configurações do restaurante salvas com sucesso!', 'success');
                }
            } catch (err) {
                showToast('Erro ao salvar configurações.', 'error');
            }
        });
    }

    if (elements.btnToggleFechadoHoje) {
        elements.btnToggleFechadoHoje.addEventListener('click', async () => {
            const novoFechado = !state.config.fechadoHoje;
            const motivo = elements.cfgMotivoFechado ? elements.cfgMotivoFechado.value : 'Folga/Manutenção';

            try {
                const res = await fetch('/api/config/fechado-hoje', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fechado: novoFechado, motivo })
                });
                if (res.ok) {
                    showToast(novoFechado ? 'Modo FECHADO ativado!' : 'Restaurante reaberto com sucesso!', 'success');
                    fetchConfig();
                }
            } catch (err) {}
        });
    }

    if (elements.btnQuickReopen) {
        elements.btnQuickReopen.addEventListener('click', async () => {
            await fetch('/api/config/fechado-hoje', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechado: false })
            });
            fetchConfig();
        });
    }

    // Modal de Novo Pedido
    if (elements.btnModalNovoAgendamento) {
        elements.btnModalNovoAgendamento.addEventListener('click', () => {
            if (elements.modalAgendamento) elements.modalAgendamento.classList.remove('hidden');
        });
    }
    if (elements.btnCloseModal) elements.btnCloseModal.addEventListener('click', () => elements.modalAgendamento.classList.add('hidden'));
    if (elements.btnCancelModal) elements.btnCancelModal.addEventListener('click', () => elements.modalAgendamento.classList.add('hidden'));

    if (elements.modalTipoEntrega) {
        elements.modalTipoEntrega.addEventListener('change', (e) => {
            if (elements.modalGroupEndereco) {
                elements.modalGroupEndereco.style.display = e.target.value === 'delivery' ? 'block' : 'none';
            }
        });
    }

    if (elements.formNovoAgendamento) {
        elements.formNovoAgendamento.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cliente = elements.modalCliente.value;
            const telefone = elements.modalTelefone.value;
            const tipoEntrega = elements.modalTipoEntrega.value;
            const endereco = elements.modalEndereco ? elements.modalEndereco.value : '';
            const formaPagamento = elements.modalPagamento.value;
            const itemId = Number(elements.modalServico.value);
            const itemObj = state.menu.find(m => m.id === itemId) || { nome: 'Pedido Balcão', preco: 22.00 };

            try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cliente,
                        telefone,
                        itens: [{ nome: itemObj.nome, preco: itemObj.preco, qtd: 1 }],
                        tipoEntrega,
                        enderecoEntrega: endereco,
                        formaPagamento
                    })
                });

                if (res.ok) {
                    showToast('Pedido lançado com sucesso na cozinha!', 'success');
                    elements.modalAgendamento.classList.add('hidden');
                    elements.formNovoAgendamento.reset();
                    fetchOrders();
                } else {
                    showToast('Erro ao lançar pedido.', 'error');
                }
            } catch (err) {
                showToast('Erro de conexão.', 'error');
            }
        });
    }

    if (elements.btnRestartBot) {
        elements.btnRestartBot.addEventListener('click', async () => {
            await fetch('/api/bot/restart', { method: 'POST' });
            showToast('Reiniciando WhatsApp Web...', 'info');
        });
    }

    if (elements.btnLogoutBot) {
        elements.btnLogoutBot.addEventListener('click', async () => {
            await fetch('/api/bot/logout', { method: 'POST' });
            showToast('Sessão desconectada.', 'info');
            fetchStatus();
        });
    }

    if (elements.btnManualRefreshQr) {
        elements.btnManualRefreshQr.addEventListener('click', () => {
            fetchStatus();
            showToast('Atualizando status do QR Code...', 'info');
        });
    }

    if (elements.btnRefreshAll) {
        elements.btnRefreshAll.addEventListener('click', () => {
            refreshData();
            showToast('Dados atualizados!', 'success');
        });
    }

    // Inicialização
    refreshData();
    setInterval(fetchOrders, 15000);
});
