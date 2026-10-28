/* ============================================================
   Página: Trocas
   - Cards (vencido, avaria, trocado, perda real, em análise, rebaixa)
   - Aba 1: Pendentes por fornecedor (pedir troca)
   - Aba 2: Pedidos de troca (em análise / trocada / recusada)
   - Aba 3: Rebaixas de preço (bonificação)
   Os valores contam no mês em que a PERDA foi lançada.
   ============================================================ */
const PageTrocas = (function () {
  const $ = (id) => document.getElementById(id);
  const esc = Utils.escapeHtml;
  const brl = Utils.fmtBRL;

  const S = {
    resumo: null,
    pendentes: [],
    pedidos: [],
    reb: { rebaixas: [], porFornecedor: [], totais: {} },
    perdasTodas: [],
    aba: 'pendentes',
    sel: new Set(),          // perdaId marcados na aba de pendentes
    fechados: new Set(),     // fornecedores recolhidos na aba de pendentes
    fornDaPerda: {}          // perdaId -> fornecedor
  };

  const ROT_STATUS = {
    DISPONIVEL: 'Disponível', PARCIAL: 'Parcial', EM_ANALISE: 'Em análise',
    TROCADO: 'Trocado', TROCADA: 'Trocada', RECUSADA: 'Recusada'
  };
  const ROT_BONIF = { PENDENTE: 'Pendente', SOLICITADA: 'Solicitada', RECEBIDA: 'Recebida' };

  /* ========== helpers ========== */
  function norm(s) { return String(s || '').toLowerCase(); }
  function fmtData(iso) { return iso ? Utils.formatValidade(iso) : '—'; }
  function hojeISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // aceita "4,50", "4.50" e "1.234,56"
  function parseNum(v) {
    let t = String(v == null ? '' : v).trim().replace(/\s/g, '');
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    return t === '' ? NaN : Number(t);
  }
  function truncar(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function badge(status) {
    return '<span class="tr-badge ' + status + '">' + (ROT_STATUS[status] || status) + '</span>';
  }

  /* ========== carga de dados ========== */
  async function carregar() {
    const mes = State.mesSelecionado || undefined;
    const [resumo, pendentes, pedidos, reb] = await Promise.all([
      Api.getTrocasResumo(mes),
      Api.getTrocasPendentes(mes),
      Api.getTrocas(mes),
      Api.getRebaixas(mes)
    ]);
    S.resumo = resumo;
    S.pendentes = pendentes;
    S.pedidos = pedidos;
    S.reb = reb;

    S.fornDaPerda = {};
    const validos = new Set();
    pendentes.forEach(g => g.itens.forEach(i => {
      S.fornDaPerda[i.perdaId] = g.fornecedor;
      if (i.disponivel > 0) validos.add(i.perdaId);
    }));
    S.sel.forEach(id => { if (!validos.has(id)) S.sel.delete(id); });
  }

  function mostrarErro(msg) {
    const box = $('trError');
    if (!box) return;
    box.hidden = !msg;
    if (msg) $('trErroMsg').textContent = msg;
  }

  async function recarregar() {
    try {
      await carregar();
      mostrarErro('');
      renderTudo();
    } catch (e) {
      mostrarErro(e.message || 'Não foi possível carregar os dados.');
    }
  }

  async function refresh() {
    renderMesControls();
    await recarregar();
  }

  /* ========== mês ========== */
  function renderMesControls() {
    Meses.fillSelect($('trMesSelect'));
    const b = $('trMesBanner');
    if (!b) return;
    const fechado = State.mesSelecionado !== 'TODOS' && Meses.ehFechado(State.mesSelecionado);
    b.hidden = !fechado;
    if (fechado) {
      b.textContent = Meses.label(State.mesSelecionado) + ' está fechado: os registros de perda ficam somente leitura, ' +
        'mas você ainda pode pedir e atualizar trocas e rebaixas.';
    }
  }

  /* ========== render geral ========== */
  function renderTudo() {
    renderCards();
    renderPendentes();
    renderPedidos();
    renderRebaixas();
    renderContadores();
  }

  function renderCards() {
    const r = S.resumo;
    if (!r) return;
    $('trCardVencidoVal').textContent = brl(r.vencido.valor);
    $('trCardVencidoQtd').textContent = r.vencido.quantidade + ' un';
    $('trCardAvariadoVal').textContent = brl(r.avariado.valor);
    $('trCardAvariadoQtd').textContent = r.avariado.quantidade + ' un';
    $('trCardTrocadoVal').textContent = brl(r.trocado.valor);
    $('trCardTrocadoQtd').textContent = r.trocado.quantidade + ' un trocadas';
    $('trCardLiquidaVal').textContent = brl(r.perdaLiquida.valor);
    $('trCardLiquidaSub').textContent = 'Total ' + brl(r.totalPerdas.valor) + ' − trocado ' + brl(r.trocado.valor);
    $('trCardAnaliseVal').textContent = brl(r.emAnalise.valor);
    $('trCardAnaliseQtd').textContent = r.emAnalise.quantidade + ' un aguardando o fornecedor';
    $('trCardRebaixaVal').textContent = brl(r.rebaixa.aCobrar);
    $('trCardRebaixaSub').textContent = 'Perda de lucro total ' + brl(r.rebaixa.perdaTotal);
  }

  function setContador(id, n) {
    const el = $(id);
    if (!el) return;
    el.hidden = !n;
    el.textContent = n || '';
  }

  function renderContadores() {
    let disp = 0;
    S.pendentes.forEach(g => g.itens.forEach(i => { if (i.disponivel > 0) disp++; }));
    setContador('trCountPend', disp);
    setContador('trCountPed', S.pedidos.filter(p => p.status === 'EM_ANALISE').length);
    setContador('trCountReb', S.reb.rebaixas.filter(r => r.bonificacao !== 'RECEBIDA').length);
  }

  function setAba(aba) {
    S.aba = aba;
    document.querySelectorAll('#page-trocas .tr-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === aba));
    document.querySelectorAll('#page-trocas .tr-panel').forEach(p => p.classList.toggle('active', p.id === 'trTab-' + aba));
  }

  function showSkeleton() {
    ['trCardVencidoVal', 'trCardAvariadoVal', 'trCardTrocadoVal', 'trCardLiquidaVal', 'trCardAnaliseVal', 'trCardRebaixaVal']
      .forEach(id => { if ($(id)) $(id).textContent = '…'; });
  }

  /* ============================================================
     ABA 1 — PENDENTES POR FORNECEDOR
     ============================================================ */
  function filtrarPendentes() {
    const termo = norm($('trFiltroPend').value.trim());
    const st = $('trFiltroPendStatus').value;
    const saida = [];
    S.pendentes.forEach(g => {
      const fornOk = !termo || norm(g.fornecedor).includes(termo);
      const itens = g.itens.filter(i => {
        if (st === 'DISP' && i.disponivel <= 0) return false;
        if (st === 'ANALISE' && i.emAnalise <= 0) return false;
        if (st === 'TROCADO' && i.trocado <= 0) return false;
        if (termo && !fornOk && !norm(i.descricao).includes(termo) && !norm(i.codigo).includes(termo)) return false;
        return true;
      });
      if (itens.length) saida.push(Object.assign({}, g, { itens: itens }));
    });
    return saida;
  }

  function stat(cls, rotulo, qtd, valor) {
    if (!qtd) return '';
    return '<span class="tr-stat ' + cls + '" title="' + rotulo + ': ' + brl(valor) + '">' +
      rotulo + ' <b>' + qtd + '</b></span>';
  }

  function htmlLinhaPend(i) {
    const podePedir = i.disponivel > 0;
    return '<tr>' +
      '<td class="center tr-chk">' + (podePedir
        ? '<input type="checkbox" data-sel="' + i.perdaId + '"' + (S.sel.has(i.perdaId) ? ' checked' : '') + ' aria-label="Selecionar">'
        : '') + '</td>' +
      '<td title="' + esc(i.descricao) + '">' + esc(truncar(i.descricao, 50)) +
        '<div class="tr-sub mono">' + esc(i.codigo || '—') + ' · val. ' + esc(Utils.formatValidade(i.validade)) +
        ' · ' + esc(Meses.label(i.mesRef)) + '</div></td>' +
      '<td class="center"><span class="badge ' + i.tipo + '">' + i.tipo + '</span></td>' +
      '<td class="num center">' + i.quantidade + '</td>' +
      '<td class="num center tr-disp">' + i.disponivel + '</td>' +
      '<td class="num center">' + (i.emAnalise || '—') + '</td>' +
      '<td class="num center">' + (i.trocado || '—') + '</td>' +
      '<td class="num center">' + brl(i.valorUnit) + '</td>' +
      '<td class="num center">' + brl(i.valorTotal) + '</td>' +
      '<td class="center">' + badge(i.status) + '</td>' +
      '<td class="center">' + (podePedir
        ? '<button type="button" class="btn btn-outline btn-sm tr-mini" data-act="pedir" data-id="' + i.perdaId + '">Pedir troca</button>'
        : '') + '</td>' +
      '</tr>';
  }

  function htmlGrupoPend(g) {
    const aberto = !S.fechados.has(g.fornecedor);
    const temDisp = g.itens.some(i => i.disponivel > 0);
    return '<div class="panel report-card tr-group' + (aberto ? ' open' : '') + '" data-forn="' + esc(g.fornecedor) + '">' +
      '<div class="report-card-header tr-group-head" data-toggle="1">' +
        '<span class="tr-chevron" aria-hidden="true">▸</span>' +
        '<h3>' + esc(g.fornecedor) + '</h3>' +
        '<div class="tr-stats">' +
          stat('disp', 'Disponível', g.disponivelQtd, g.disponivelValor) +
          stat('analise', 'Em análise', g.emAnaliseQtd, g.emAnaliseValor) +
          stat('trocado', 'Trocado', g.trocadoQtd, g.trocadoValor) +
        '</div>' +
        '<span class="subtotal">' + brl(g.totalValor) + '</span>' +
      '</div>' +
      '<div class="tr-group-body">' +
        '<div class="table-wrap tr-scroll"><table class="data-table tr-table">' +
          '<thead><tr>' +
            '<th class="center"></th><th>Produto</th><th class="center">Motivo</th>' +
            '<th class="num center">Qtd.</th><th class="num center">Disp.</th>' +
            '<th class="num center">Em análise</th><th class="num center">Trocado</th>' +
            '<th class="num center">Val. unit.</th><th class="num center">Val. total</th>' +
            '<th class="center">Status</th><th class="center"></th>' +
          '</tr></thead>' +
          '<tbody>' + g.itens.map(htmlLinhaPend).join('') + '</tbody>' +
        '</table></div>' +
        (temDisp
          ? '<div class="tr-group-foot">' +
              '<button type="button" class="btn btn-ghost" data-act="sel-todos">Selecionar todos</button>' +
              '<span class="tr-foot-info"></span>' +
              '<button type="button" class="btn btn-primary btn-sm" data-act="pedir-sel" disabled>Pedir troca dos selecionados</button>' +
            '</div>'
          : '') +
      '</div>' +
    '</div>';
  }

  function renderPendentes() {
    const lista = $('trPendentesList');
    const vazio = $('trPendentesEmpty');
    if (!lista) return;
    const grupos = filtrarPendentes();

    if (!grupos.length) {
      lista.innerHTML = '';
      vazio.hidden = false;
      vazio.innerHTML = S.pendentes.length
        ? '<strong>Nada encontrado</strong><span>Tente ajustar a pesquisa ou o filtro.</span>'
        : '<strong>Nenhuma perda neste mês</strong><span>Os produtos vencidos e avariados registrados aparecem aqui para você pedir a troca.</span>';
      return;
    }
    vazio.hidden = true;
    lista.innerHTML = grupos.map(htmlGrupoPend).join('');
    lista.querySelectorAll('.tr-group').forEach(atualizarRodape);
  }

  function idsSelecionados(forn) {
    return Array.from(S.sel).filter(id => S.fornDaPerda[id] === forn);
  }

  function atualizarRodape(card) {
    const btn = card.querySelector('[data-act="pedir-sel"]');
    if (!btn) return;
    const ids = idsSelecionados(card.dataset.forn);
    let valor = 0;
    const g = S.pendentes.find(x => x.fornecedor === card.dataset.forn);
    if (g) g.itens.forEach(i => { if (ids.includes(i.perdaId)) valor += i.disponivel * i.valorUnit; });
    btn.disabled = ids.length === 0;
    btn.textContent = ids.length ? 'Pedir troca dos selecionados (' + ids.length + ')' : 'Pedir troca dos selecionados';
    const info = card.querySelector('.tr-foot-info');
    if (info) info.textContent = ids.length ? 'até ' + brl(valor) : '';
  }

  function onPendClick(e) {
    const card = e.target.closest('.tr-group');
    if (!card) return;
    const forn = card.dataset.forn;
    const acao = e.target.closest('[data-act]');

    if (acao) {
      const act = acao.dataset.act;
      if (act === 'pedir') abrirModalTroca(forn, [parseInt(acao.dataset.id, 10)]);
      if (act === 'pedir-sel') abrirModalTroca(forn, idsSelecionados(forn));
      if (act === 'sel-todos') {
        const boxes = card.querySelectorAll('input[data-sel]');
        const todos = Array.from(boxes).every(b => b.checked);
        boxes.forEach(b => {
          b.checked = !todos;
          const id = parseInt(b.dataset.sel, 10);
          if (b.checked) S.sel.add(id); else S.sel.delete(id);
        });
        atualizarRodape(card);
      }
      return;
    }

    // clicar no cabeçalho recolhe/expande o fornecedor
    if (e.target.closest('[data-toggle]')) {
      card.classList.toggle('open');
      if (card.classList.contains('open')) S.fechados.delete(forn); else S.fechados.add(forn);
    }
  }

  function onPendChange(e) {
    const box = e.target.closest('input[data-sel]');
    if (!box) return;
    const id = parseInt(box.dataset.sel, 10);
    if (box.checked) S.sel.add(id); else S.sel.delete(id);
    atualizarRodape(box.closest('.tr-group'));
  }

  /* ---------- modal: pedir troca ---------- */
  let modalTroca = null; // { fornecedor, itens: [...] }

  function abrirModalTroca(forn, ids) {
    const g = S.pendentes.find(x => x.fornecedor === forn);
    if (!g) return;
    const itens = g.itens.filter(i => ids.includes(i.perdaId) && i.disponivel > 0);
    if (!itens.length) { Utils.toast('Escolha pelo menos um produto com unidades disponíveis.', 'error'); return; }

    modalTroca = { fornecedor: forn, itens: itens };
    $('trocaModalForn').textContent = forn;
    $('trocaModalItens').innerHTML = itens.map(i =>
      '<div class="tr-mi">' +
        '<div class="tr-mi-info"><b>' + esc(truncar(i.descricao, 60)) + '</b>' +
        '<span>' + i.tipo + ' · disponível ' + i.disponivel + ' · ' + brl(i.valorUnit) + ' cada</span></div>' +
        '<input type="number" min="1" max="' + i.disponivel + '" step="1" value="' + i.disponivel + '" data-id="' + i.perdaId + '" aria-label="Quantidade a trocar">' +
      '</div>'
    ).join('');
    $('trocaModalObs').value = '';
    recalcularModalTroca();
    $('trocaModal').classList.add('open');
  }

  function lerItensModalTroca() {
    return modalTroca.itens.map(i => {
      const inp = document.querySelector('#trocaModalItens input[data-id="' + i.perdaId + '"]');
      return { perdaId: i.perdaId, descricao: i.descricao, max: i.disponivel, valorUnit: i.valorUnit,
               quantidade: parseInt(inp ? inp.value : '', 10) };
    });
  }

  function recalcularModalTroca() {
    if (!modalTroca) return;
    let total = 0;
    lerItensModalTroca().forEach(i => {
      if (i.quantidade >= 1 && i.quantidade <= i.max) total += i.quantidade * i.valorUnit;
    });
    $('trocaModalTotal').textContent = brl(total);
  }

  function fecharModalTroca() {
    $('trocaModal').classList.remove('open');
    modalTroca = null;
  }

  async function confirmarTroca() {
    if (!modalTroca) return;
    const itens = lerItensModalTroca();
    for (const i of itens) {
      if (!(i.quantidade >= 1) || i.quantidade > i.max) {
        Utils.toast('"' + truncar(i.descricao, 30) + '": informe de 1 a ' + i.max + ' unidade(s).', 'error');
        return;
      }
    }
    const btn = $('btnSaveTroca');
    btn.disabled = true;
    try {
      await Api.criarTroca({
        fornecedor: modalTroca.fornecedor,
        observacao: $('trocaModalObs').value.trim(),
        itens: itens.map(i => ({ perdaId: i.perdaId, quantidade: i.quantidade }))
      });
      itens.forEach(i => S.sel.delete(i.perdaId));
      fecharModalTroca();
      Utils.toast('Pedido de troca criado. Os produtos ficaram em análise.', 'success');
      await recarregar();
    } catch (e) {
      Utils.toast(e.message || 'Erro ao pedir a troca.', 'error');
      if (e.status === 409) await recarregar();
    } finally {
      btn.disabled = false;
    }
  }

  /* ============================================================
     ABA 2 — PEDIDOS DE TROCA
     ============================================================ */
  function filtrarPedidos() {
    const termo = norm($('trFiltroPed').value.trim());
    const st = $('trFiltroPedStatus').value;
    return S.pedidos.filter(p => {
      if (st && p.status !== st) return false;
      if (termo) {
        const achou = norm(p.fornecedor).includes(termo) ||
          p.itens.some(i => norm(i.descricao).includes(termo) || norm(i.codigo).includes(termo));
        if (!achou) return false;
      }
      return true;
    });
  }

  function htmlPedido(p) {
    const linhas = p.itens.map(i =>
      '<tr>' +
        '<td title="' + esc(i.descricao) + '">' + esc(truncar(i.descricao, 50)) + '</td>' +
        '<td class="center"><span class="badge ' + i.tipo + '">' + i.tipo + '</span></td>' +
        '<td class="num center">' + i.quantidade + '</td>' +
        '<td class="mono center">' + esc(i.codigo || '—') + '</td>' +
        '<td class="mono center">' + esc(Meses.label(i.mesRef)) + '</td>' +
        '<td class="num center">' + brl(i.valorUnit) + '</td>' +
        '<td class="num center">' + brl(i.valorTotal) + '</td>' +
      '</tr>'
    ).join('');

    let acoes = '';
    if (p.status === 'EM_ANALISE') {
      acoes =
        '<button type="button" class="btn btn-primary btn-sm" data-act="trocada" data-id="' + p.id + '">Marcar como trocada</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-act="recusada" data-id="' + p.id + '">Marcar como recusada</button>' +
        '<button type="button" class="btn btn-ghost tr-del" data-act="excluir" data-id="' + p.id + '">Excluir pedido</button>';
    } else if (p.status === 'TROCADA') {
      acoes = '<button type="button" class="btn btn-outline btn-sm" data-act="reabrir" data-id="' + p.id + '">Voltar para em análise</button>';
    } else {
      acoes =
        '<button type="button" class="btn btn-outline btn-sm" data-act="reabrir" data-id="' + p.id + '">Voltar para em análise</button>' +
        '<button type="button" class="btn btn-ghost tr-del" data-act="excluir" data-id="' + p.id + '">Excluir pedido</button>';
    }

    let meta = 'Pedido em ' + fmtData(p.criadoLocal) + ' · ' + p.quantidade + ' un';
    if (p.resolvidoLocal) meta += ' · resolvido em ' + fmtData(p.resolvidoLocal);

    return '<div class="panel report-card tr-pedido" data-id="' + p.id + '">' +
      '<div class="report-card-header">' +
        '<h3>' + esc(p.fornecedor) + ' <small class="tr-id">#' + p.id + '</small></h3>' +
        badge(p.status) +
        '<span class="subtotal">' + brl(p.valorTotal) + '</span>' +
      '</div>' +
      '<div class="tr-pedido-meta">' + esc(meta) +
        (p.observacao ? '<br><i>' + esc(p.observacao) + '</i>' : '') +
        (p.itensOcultos ? '<br><span class="tr-aviso">Este pedido tem mais ' + p.itensOcultos + ' item(ns) de perdas de outros meses.</span>' : '') +
      '</div>' +
      '<div class="table-wrap tr-scroll"><table class="data-table tr-table">' +
        '<thead><tr><th>Produto</th><th class="center">Motivo</th><th class="num center">Qtd.</th>' +
        '<th class="center">Código</th><th class="center">Mês da perda</th>' +
        '<th class="num center">Val. unit.</th><th class="num center">Val. total</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody></table></div>' +
      '<div class="tr-acoes">' + acoes + '</div>' +
    '</div>';
  }

  function renderPedidos() {
    const lista = $('trPedidosList');
    const vazio = $('trPedidosEmpty');
    if (!lista) return;
    const itens = filtrarPedidos();
    if (!itens.length) {
      lista.innerHTML = '';
      vazio.hidden = false;
      vazio.innerHTML = S.pedidos.length
        ? '<strong>Nada encontrado</strong><span>Tente ajustar a pesquisa ou o filtro.</span>'
        : '<strong>Nenhum pedido de troca neste mês</strong><span>Peça a troca na aba "Pendentes por fornecedor".</span>';
      return;
    }
    vazio.hidden = true;
    lista.innerHTML = itens.map(htmlPedido).join('');
  }

  const TEXTO_STATUS = {
    trocada: {
      status: 'TROCADA', titulo: 'Marcar como trocada?', confirmar: 'Sim, foi trocada', ok: 'Pedido marcado como trocado.',
      msg: (p) => 'O fornecedor <b>' + esc(p.fornecedor) + '</b> trocou <b>' + p.quantidade + ' un</b> (' + brl(p.valorTotal) +
        '). Esse valor sai da perda real.'
    },
    recusada: {
      status: 'RECUSADA', titulo: 'Marcar como recusada?', confirmar: 'Sim, foi recusada', ok: 'Pedido marcado como recusado.',
      msg: (p) => 'O fornecedor <b>' + esc(p.fornecedor) + '</b> recusou a troca. As unidades voltam a ficar disponíveis ' +
        'e você pode pedir de novo.'
    },
    reabrir: {
      status: 'EM_ANALISE', titulo: 'Voltar para em análise?', confirmar: 'Voltar para em análise', ok: 'Pedido voltou para em análise.',
      msg: (p) => 'O pedido #' + p.id + ' volta a ficar <b>em análise</b>.'
    }
  };

  async function mudarStatus(id, chave) {
    const p = S.pedidos.find(x => x.id === id);
    const t = TEXTO_STATUS[chave];
    if (!p || !t) return;
    const ok = await ConfirmModal.ask({ titulo: t.titulo, mensagem: t.msg(p), confirmar: t.confirmar });
    if (!ok) return;
    try {
      await Api.atualizarStatusTroca(id, t.status);
      Utils.toast(t.ok, 'success');
    } catch (e) {
      Utils.toast(e.message || 'Erro ao atualizar o pedido.', 'error');
    }
    await recarregar();
  }

  async function excluirPedido(id) {
    const p = S.pedidos.find(x => x.id === id);
    if (!p) return;
    const ok = await ConfirmModal.ask({
      titulo: 'Excluir pedido?',
      mensagem: 'O pedido #' + p.id + ' de <b>' + esc(p.fornecedor) + '</b> será apagado e as unidades voltam a ficar disponíveis. ' +
        'Essa ação <b>não pode ser desfeita</b>.',
      confirmar: 'Excluir pedido', perigo: true
    });
    if (!ok) return;
    try {
      await Api.excluirTroca(id);
      Utils.toast('Pedido excluído.', 'success');
    } catch (e) {
      Utils.toast(e.message || 'Erro ao excluir o pedido.', 'error');
    }
    await recarregar();
  }

  function onPedidosClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.act === 'excluir') excluirPedido(id);
    else mudarStatus(id, btn.dataset.act);
  }

  /* ============================================================
     ABA 3 — REBAIXAS
     ============================================================ */
  function filtrarRebaixas() {
    const termo = norm($('trFiltroReb').value.trim());
    const st = $('trFiltroRebStatus').value;
    return S.reb.rebaixas.filter(r => {
      if (st && r.bonificacao !== st) return false;
      if (termo && !norm(r.fornecedor).includes(termo) && !norm(r.descricao).includes(termo) && !norm(r.codigo).includes(termo)) return false;
      return true;
    });
  }

  function htmlResumoReb() {
    const lista = S.reb.porFornecedor || [];
    if (!lista.length) return '';
    const t = S.reb.totais;
    const linhas = lista.map(g =>
      '<tr><td>' + esc(g.fornecedor) + '</td>' +
      '<td class="num">' + g.vendidas + '</td>' +
      '<td class="num">' + brl(g.perdaTotal) + '</td>' +
      '<td class="num tr-cobrar">' + brl(g.aCobrar) + '</td>' +
      '<td class="num">' + brl(g.recebido) + '</td></tr>'
    ).join('');
    return '<div class="panel tr-resumo">' +
      '<h3 class="panel-title">Bonificação a cobrar por fornecedor</h3>' +
      '<div class="table-wrap tr-scroll"><table class="data-table tr-table">' +
        '<thead><tr><th>Fornecedor</th><th class="num">Vendidas</th><th class="num">Perda de lucro</th>' +
        '<th class="num">A cobrar</th><th class="num">Recebido</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody>' +
        '<tfoot><tr><td>Total</td><td class="num">' + t.vendidas + '</td><td class="num">' + brl(t.perdaTotal) +
        '</td><td class="num tr-cobrar">' + brl(t.aCobrar) + '</td><td class="num">' + brl(t.recebido) + '</td></tr></tfoot>' +
      '</table></div></div>';
  }

  function htmlSobra(r) {
    if (!r.qtdPromocao) return '<span class="tr-sub">—</span>';
    let h = '<b>' + r.sobra + ' un</b>';
    if (r.sobra > 0) {
      h += r.perda
        ? '<div class="tr-sub">vencido ligado · ' + esc(Meses.label(r.perda.mesRef)) + '</div>'
        : '<div class="tr-sub">sem vencido ligado</div>';
    }
    return h;
  }

  function htmlLinhaReb(r) {
    const periodo = fmtData(r.dataInicio) + ' → ' + (r.dataFim ? fmtData(r.dataFim) : 'em vigor');
    const opcoes = Object.keys(ROT_BONIF).map(k =>
      '<option value="' + k + '"' + (k === r.bonificacao ? ' selected' : '') + '>' + ROT_BONIF[k] + '</option>').join('');
    return '<tr>' +
      '<td title="' + esc(r.descricao) + '">' + esc(truncar(r.descricao, 50)) +
        '<div class="tr-sub mono">' + esc(r.codigo || '—') + (r.observacao ? ' · ' + esc(truncar(r.observacao, 40)) : '') + '</div></td>' +
      '<td class="mono center">' + periodo + '</td>' +
      '<td class="num center">' + brl(r.precoAntigo) + ' → ' + brl(r.precoNovo) + '</td>' +
      '<td class="num center">' + r.qtdVendida + (r.qtdPromocao ? ' / ' + r.qtdPromocao : '') + '</td>' +
      '<td class="num center">' + brl(r.perdaUnit) + '</td>' +
      '<td class="num center tr-cobrar">' + brl(r.perdaTotal) + '</td>' +
      '<td class="center">' + htmlSobra(r) + '</td>' +
      '<td class="center"><select class="tr-bonif ' + r.bonificacao + '" data-bonif="' + r.id + '" aria-label="Bonificação">' + opcoes + '</select></td>' +
      '<td class="center tr-row-acoes">' +
        '<button type="button" class="btn btn-outline btn-sm tr-mini" data-act="editar" data-id="' + r.id + '">Editar</button>' +
        '<button type="button" class="btn btn-ghost tr-del" data-act="excluir" data-id="' + r.id + '">Apagar</button>' +
      '</td></tr>';
  }

  function renderRebaixas() {
    const lista = $('trRebList');
    const vazio = $('trRebEmpty');
    if (!lista) return;
    $('trRebResumo').innerHTML = htmlResumoReb();

    const itens = filtrarRebaixas();
    if (!itens.length) {
      lista.innerHTML = '';
      vazio.hidden = false;
      vazio.innerHTML = S.reb.rebaixas.length
        ? '<strong>Nada encontrado</strong><span>Tente ajustar a pesquisa ou o filtro.</span>'
        : '<strong>Nenhuma rebaixa neste mês</strong><span>Use "+ Nova rebaixa" para registrar quando baixar o preço de um produto.</span>';
      return;
    }
    vazio.hidden = true;

    const mapa = {};
    itens.forEach(r => { (mapa[r.fornecedor] = mapa[r.fornecedor] || []).push(r); });
    lista.innerHTML = Object.keys(mapa).sort((a, b) => a.localeCompare(b)).map(forn => {
      const rs = mapa[forn];
      const sub = rs.reduce((s, r) => s + r.perdaTotal, 0);
      return '<div class="panel report-card">' +
        '<div class="report-card-header"><h3>' + esc(forn) + '</h3>' +
        '<span class="subtotal" title="Perda de lucro total">' + brl(sub) + '</span></div>' +
        '<div class="table-wrap tr-scroll"><table class="data-table tr-table">' +
          '<thead><tr><th>Produto</th><th class="center">Período</th><th class="num center">Preço de venda</th>' +
          '<th class="num center">Vendidas</th><th class="num center">Perda/un</th><th class="num center">Perda total</th>' +
          '<th class="center">Sobra</th><th class="center">Bonificação</th><th class="center"></th></tr></thead>' +
          '<tbody>' + rs.map(htmlLinhaReb).join('') + '</tbody></table></div></div>';
    }).join('');
  }

  async function mudarBonificacao(id, status) {
    try {
      await Api.atualizarBonificacao(id, status);
      Utils.toast('Bonificação: ' + ROT_BONIF[status].toLowerCase() + '.', 'success');
    } catch (e) {
      Utils.toast(e.message || 'Erro ao atualizar a bonificação.', 'error');
    }
    await recarregar();
  }

  async function excluirRebaixa(id) {
    const r = S.reb.rebaixas.find(x => x.id === id);
    if (!r) return;
    const ok = await ConfirmModal.ask({
      titulo: 'Apagar rebaixa?',
      mensagem: 'A rebaixa de <b>' + esc(r.descricao) + '</b> (' + fmtData(r.dataInicio) + ') será apagada. ' +
        'Essa ação <b>não pode ser desfeita</b>.',
      confirmar: 'Apagar', perigo: true
    });
    if (!ok) return;
    try {
      await Api.excluirRebaixa(id);
      Utils.toast('Rebaixa apagada.', 'success');
    } catch (e) {
      Utils.toast(e.message || 'Erro ao apagar.', 'error');
    }
    await recarregar();
  }

  function onRebClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.act === 'editar') abrirModalRebaixa(S.reb.rebaixas.find(x => x.id === id));
    if (btn.dataset.act === 'excluir') excluirRebaixa(id);
  }

  function onRebChange(e) {
    const sel = e.target.closest('select[data-bonif]');
    if (sel) mudarBonificacao(parseInt(sel.dataset.bonif, 10), sel.value);
  }

  /* ---------- modal: rebaixa ---------- */
  let editandoRebId = null;

  function preencherProdutosDatalist() {
    const dl = $('rbProdutosDatalist');
    const forn = $('rbForn').value;
    dl.innerHTML = '';
    (State.catalogo[forn] || []).forEach(p => {
      const o = document.createElement('option');
      o.value = p.descricao;
      dl.appendChild(o);
    });
  }

  function atualizarPerdaSelect(selecionado) {
    const sel = $('rbPerda');
    const atual = selecionado !== undefined ? selecionado : sel.value;
    const forn = $('rbForn').value;
    const desc = norm($('rbDesc').value.trim());
    const cod = norm($('rbCodigo').value.trim());

    const cands = S.perdasTodas.filter(p =>
      p.tipo === 'VENCIDO' && p.fornecedor === forn && (
        String(p.id) === String(atual) || (!desc && !cod) ||
        norm(p.descricao) === desc || (cod && norm(p.codigo) === cod))
    ).sort((a, b) => String(b.mesRef).localeCompare(String(a.mesRef)));

    sel.innerHTML = '<option value="">Não ligar a nenhum vencido</option>' + cands.map(p =>
      '<option value="' + p.id + '">' + esc(Meses.label(p.mesRef)) + ' · ' + esc(truncar(p.descricao, 30)) +
      ' · ' + p.quantidade + ' un · val. ' + esc(Utils.formatValidade(p.validade)) + '</option>').join('');
    sel.value = cands.some(p => String(p.id) === String(atual)) ? String(atual) : '';
  }

  function atualizarPreviewRebaixa() {
    const a = parseNum($('rbPrecoAntigo').value);
    const n = parseNum($('rbPrecoNovo').value);
    const q = parseInt($('rbQtdVendida').value, 10) || 0;
    const box = $('rbPreview');
    if (isNaN(a) || isNaN(n)) { box.textContent = 'Preencha os preços e a quantidade vendida para ver a perda de lucro.'; return; }
    if (n >= a) { box.textContent = 'O preço rebaixado precisa ser menor que o preço antigo.'; return; }
    const un = Math.round((a - n) * 100) / 100;
    box.innerHTML = 'Perda por unidade: <b>' + brl(un) + '</b> · ' + q + ' vendida(s) = <b>' + brl(un * q) + '</b> a cobrar do fornecedor';
  }

  async function abrirModalRebaixa(reb) {
    editandoRebId = reb ? reb.id : null;
    $('rbTitulo').textContent = reb ? 'Editar rebaixa' : 'Nova rebaixa';

    try { S.perdasTodas = await Api.getPerdas('TODOS'); } catch (e) { S.perdasTodas = []; }

    const fornecedores = State.fornecedoresList();
    if (reb && fornecedores.indexOf(reb.fornecedor) < 0) fornecedores.push(reb.fornecedor);
    $('rbForn').innerHTML = '<option value="">Selecione…</option>' +
      fornecedores.map(f => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join('');

    $('rbForn').value = reb ? reb.fornecedor : '';
    preencherProdutosDatalist();
    $('rbDesc').value = reb ? reb.descricao : '';
    $('rbCodigo').value = reb ? reb.codigo : '';
    $('rbPrecoAntigo').value = reb ? String(reb.precoAntigo).replace('.', ',') : '';
    $('rbPrecoNovo').value = reb ? String(reb.precoNovo).replace('.', ',') : '';
    $('rbInicio').value = reb ? reb.dataInicio : hojeISO();
    $('rbFim').value = reb && reb.dataFim ? reb.dataFim : '';
    $('rbQtdPromo').value = reb && reb.qtdPromocao ? reb.qtdPromocao : '';
    $('rbQtdVendida').value = reb ? reb.qtdVendida : '';
    $('rbObs').value = reb ? reb.observacao : '';

    atualizarPerdaSelect(reb && reb.perdaId ? reb.perdaId : '');
    atualizarPreviewRebaixa();
    $('rebaixaModal').classList.add('open');
  }

  function fecharModalRebaixa() {
    $('rebaixaModal').classList.remove('open');
    editandoRebId = null;
  }

  async function salvarRebaixa() {
    const fornecedor = $('rbForn').value;
    const descricao = $('rbDesc').value.trim();
    const precoAntigo = parseNum($('rbPrecoAntigo').value);
    const precoNovo = parseNum($('rbPrecoNovo').value);
    const dataInicio = $('rbInicio').value;

    if (!fornecedor) { Utils.toast('Escolha o fornecedor.', 'error'); return; }
    if (!descricao) { Utils.toast('Informe o produto.', 'error'); return; }
    if (isNaN(precoAntigo) || precoAntigo <= 0) { Utils.toast('Informe o preço de venda antigo.', 'error'); return; }
    if (isNaN(precoNovo) || precoNovo < 0 || precoNovo >= precoAntigo) { Utils.toast('O preço rebaixado deve ser menor que o antigo.', 'error'); return; }
    if (!dataInicio) { Utils.toast('Informe a data de início.', 'error'); return; }

    const corpo = {
      fornecedor: fornecedor,
      descricao: descricao,
      codigo: $('rbCodigo').value.trim(),
      precoAntigo: precoAntigo,
      precoNovo: precoNovo,
      dataInicio: dataInicio,
      dataFim: $('rbFim').value || null,
      qtdPromocao: parseInt($('rbQtdPromo').value, 10) || 0,
      qtdVendida: parseInt($('rbQtdVendida').value, 10) || 0,
      perdaId: $('rbPerda').value ? parseInt($('rbPerda').value, 10) : null,
      observacao: $('rbObs').value.trim()
    };

    const btn = $('btnSaveRebaixa');
    btn.disabled = true;
    try {
      if (editandoRebId) await Api.atualizarRebaixa(editandoRebId, corpo);
      else await Api.criarRebaixa(corpo);
      const editou = !!editandoRebId;
      fecharModalRebaixa();
      Utils.toast(editou ? 'Rebaixa atualizada.' : 'Rebaixa registrada.', 'success');
      await recarregar();
    } catch (e) {
      Utils.toast(e.message || 'Erro ao salvar a rebaixa.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ========== binds ========== */
  function bind() {
    Meses.bindSelect($('trMesSelect'), async () => {
      showSkeleton();
      renderMesControls();
      await recarregar();
    });
    $('btnTrRetry')?.addEventListener('click', () => { showSkeleton(); recarregar(); });

    document.querySelectorAll('#page-trocas .tr-tab').forEach(b => b.addEventListener('click', () => setAba(b.dataset.tab)));

    // pendentes
    $('trFiltroPend')?.addEventListener('input', renderPendentes);
    $('trFiltroPendStatus')?.addEventListener('change', renderPendentes);
    $('trPendentesList')?.addEventListener('click', onPendClick);
    $('trPendentesList')?.addEventListener('change', onPendChange);

    // pedidos
    $('trFiltroPed')?.addEventListener('input', renderPedidos);
    $('trFiltroPedStatus')?.addEventListener('change', renderPedidos);
    $('trPedidosList')?.addEventListener('click', onPedidosClick);

    // rebaixas
    $('trFiltroReb')?.addEventListener('input', renderRebaixas);
    $('trFiltroRebStatus')?.addEventListener('change', renderRebaixas);
    $('btnNovaRebaixa')?.addEventListener('click', () => abrirModalRebaixa(null));
    $('trRebList')?.addEventListener('click', onRebClick);
    $('trRebList')?.addEventListener('change', onRebChange);

    // modal de troca
    $('btnCancelTroca')?.addEventListener('click', fecharModalTroca);
    $('btnSaveTroca')?.addEventListener('click', confirmarTroca);
    $('trocaModalItens')?.addEventListener('input', recalcularModalTroca);
    $('trocaModal')?.addEventListener('click', function (e) { if (e.target === this) fecharModalTroca(); });

    // modal de rebaixa
    $('btnCancelRebaixa')?.addEventListener('click', fecharModalRebaixa);
    $('btnSaveRebaixa')?.addEventListener('click', salvarRebaixa);
    $('rebaixaModal')?.addEventListener('click', function (e) { if (e.target === this) fecharModalRebaixa(); });
    $('rbForn')?.addEventListener('change', () => { preencherProdutosDatalist(); atualizarPerdaSelect(''); });
    $('rbDesc')?.addEventListener('input', () => {
      const p = (State.catalogo[$('rbForn').value] || []).find(x => norm(x.descricao) === norm($('rbDesc').value.trim()));
      if (p && !$('rbCodigo').value.trim()) $('rbCodigo').value = p.codigoProduto || '';
      atualizarPerdaSelect();
    });
    $('rbCodigo')?.addEventListener('input', () => atualizarPerdaSelect());
    ['rbPrecoAntigo', 'rbPrecoNovo', 'rbQtdVendida'].forEach(id => $(id)?.addEventListener('input', atualizarPreviewRebaixa));

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('trocaModal')?.classList.contains('open')) fecharModalTroca();
      if ($('rebaixaModal')?.classList.contains('open')) fecharModalRebaixa();
    });
  }

  bind();

  return { refresh: refresh, showSkeleton: showSkeleton };
})();
