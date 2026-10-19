/* ============================================================
   Página: Rankings
   Trabalha sobre State.perdas (mês selecionado, ou todos se
   "Acumulado"). A evolução e a variação vs. mês anterior usam
   os totais de State.meses (vindos de /api/meses).
   ============================================================ */
const PageRankings = (function(){
  const $ = (id) => document.getElementById(id);

  const TOP_INICIAL = 5;
  const TOP_MAX = 10;

  let rankMetric = 'valor';   // 'valor' | 'quantidade'
  let fornTipo = '';          // '' | 'VENCIDO' | 'AVARIADO'
  let fornExpandido = false;
  let chartMensal = null;

  /* ---------- helpers ---------- */
  function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function pick(o){ return rankMetric === 'valor' ? o.val : o.qtd; }
  function fmtMetric(n){ return rankMetric === 'valor' ? Utils.fmtBRL(n) : (n + ' un'); }
  function fmtOutra(o){ return rankMetric === 'valor' ? (o.qtd + ' un') : Utils.fmtBRL(o.val); }
  function plural(n, s, p){ return n + ' ' + (n === 1 ? s : p); }
  function esc(s){ return Utils.escapeHtml(s); }
  function comAlpha(hex, a){
    if(!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    return hex + Math.round(a * 255).toString(16).padStart(2, '0');
  }
  function setLoading(on){
    const c = $('rankContent');
    if(c) c.classList.toggle('rk-loading', !!on);
  }
  function chaveProduto(p){ return (p.fornecedor || '') + '|' + (p.codigo || p.descricao || ''); }

  /* ---------- render principal ---------- */
  function render(){
    const content = $('rankContent');
    if(!content) return;
    setLoading(false);
    renderControles();

    const empty = $('rankEmpty');
    const erro = $('rankError');

    if(State.erro){
      $('rankErroMsg').textContent = State.erro;
      erro.hidden = false; empty.hidden = true; content.hidden = true;
      return;
    }
    erro.hidden = true;

    if(State.perdas.length === 0){
      $('rankEmptyMsg').innerHTML = State.mesSelecionado === 'TODOS'
        ? 'Ainda não há dados suficientes.<br>Registre algumas perdas para ver os rankings.'
        : 'Nenhuma perda em <b>' + Meses.label(State.mesSelecionado) + '</b>.';
      empty.hidden = false; content.hidden = true;
      return;
    }
    empty.hidden = true; content.hidden = false;

    renderResumo();
    renderChartMensal();
    renderRankFornecedores();
    renderRankProdutos('VENCIDO', 'rankProdutosVencido');
    renderRankProdutos('AVARIADO', 'rankProdutosAvariado');
  }

  function renderControles(){
    Meses.fillSelect($('rankMesSelect'));
    const b = $('rankBanner');
    const fechado = State.mesSelecionado !== 'TODOS' && Meses.ehFechado(State.mesSelecionado);
    b.hidden = !fechado;
    if(fechado) b.textContent = 'Visualizando ' + Meses.label(State.mesSelecionado) + ' — mês fechado, somente leitura.';
  }

  /* ---------- cards, variação, contexto, proporção ---------- */
  function setDelta(id, atual, anterior, labelAnt){
    const el = $(id);
    if(anterior == null || anterior <= 0){ el.hidden = true; return; }
    const r = Math.round(((atual - anterior) / anterior) * 100);
    let cls = 'igual', seta = '=';
    if(r > 0){ cls = 'up'; seta = '▲'; }
    else if(r < 0){ cls = 'down'; seta = '▼'; }
    el.className = 'delta ' + cls;
    el.textContent = seta + ' ' + Math.abs(r) + '% vs ' + labelAnt;
    el.hidden = false;
  }

  function renderResumo(){
    let vVal = 0, vQtd = 0, aVal = 0, aQtd = 0;
    const forns = new Set(), prods = new Set();
    State.perdas.forEach(p => {
      const val = p.valorTotal || 0, qtd = p.quantidade || 0;
      if(p.tipo === 'VENCIDO'){ vVal += val; vQtd += qtd; } else { aVal += val; aQtd += qtd; }
      forns.add(p.fornecedor);
      prods.add(chaveProduto(p));
    });

    $('sumVencidoValor').textContent  = Utils.fmtBRL(vVal);
    $('sumVencidoQtd').textContent    = plural(vQtd, 'item', 'itens');
    $('sumAvariadoValor').textContent = Utils.fmtBRL(aVal);
    $('sumAvariadoQtd').textContent   = plural(aQtd, 'item', 'itens');
    $('sumGeralValor').textContent    = Utils.fmtBRL(vVal + aVal);
    $('sumGeralQtd').textContent      = plural(vQtd + aQtd, 'item', 'itens');

    // variação contra o mês anterior (em R$) — não existe no Acumulado nem sem mês anterior
    const sel = State.mesSelecionado;
    const ant = sel === 'TODOS' ? null : Meses.info(Meses.anterior(sel));
    if(ant){
      const lbl = Meses.label(ant.ref);
      setDelta('deltaVencido',  vVal, ant.vencido.valor, lbl);
      setDelta('deltaAvariado', aVal, ant.avariado.valor, lbl);
      setDelta('deltaGeral',    vVal + aVal, ant.vencido.valor + ant.avariado.valor, lbl);
    } else {
      ['deltaVencido', 'deltaAvariado', 'deltaGeral'].forEach(id => { $(id).hidden = true; });
    }

    $('rankContexto').textContent =
      plural(State.perdas.length, 'registro', 'registros') + ' · ' +
      plural(forns.size, 'fornecedor', 'fornecedores') + ' · ' +
      plural(prods.size, 'produto distinto', 'produtos distintos');

    const total = vVal + aVal;
    const pv = total ? (vVal / total) * 100 : 0;
    const pa = total ? 100 - pv : 0;
    $('rankProp').hidden = total <= 0;
    $('propV').style.width = pv + '%';
    $('propA').style.width = pa + '%';
    $('propVTxt').textContent = Math.round(pv) + '%';
    $('propATxt').textContent = Math.round(pa) + '%';
  }

  /* ---------- evolução: 6 meses terminando no mês selecionado ---------- */
  function renderChartMensal(){
    if(typeof Chart === 'undefined') return;
    const canvas = $('chartMensal');
    if(!canvas) return;

    const sel = State.mesSelecionado;
    const refFim = (sel && sel !== 'TODOS') ? sel : (State.mesAberto || Meses.refAtual());
    const meses = Meses.janela(refFim, 6);

    const vencido = [], avariado = [];
    meses.forEach(m => {
      const info = Meses.info(m.key);
      vencido.push(info ? (rankMetric === 'valor' ? info.vencido.valor : info.vencido.quantidade) : 0);
      avariado.push(info ? (rankMetric === 'valor' ? info.avariado.valor : info.avariado.quantidade) : 0);
    });

    const cV = cssVar('--vencido'), cA = cssVar('--avariado');
    // mês selecionado em cor cheia, os demais mais claros (no Acumulado, todos cheios)
    const corV = meses.map(m => (sel === 'TODOS' || m.key === sel) ? cV : comAlpha(cV, 0.5));
    const corA = meses.map(m => (sel === 'TODOS' || m.key === sel) ? cA : comAlpha(cA, 0.5));

    if(chartMensal){ chartMensal.destroy(); chartMensal = null; }
    const textMuted = cssVar('--text-muted');
    const mono = "'IBM Plex Mono',monospace";

    chartMensal = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: meses.map(m => m.label),
        datasets: [
          { label: 'Vencido',  data: vencido,  backgroundColor: corV, borderRadius: 4, maxBarThickness: 34 },
          { label: 'Avariado', data: avariado, backgroundColor: corA, borderRadius: 4, maxBarThickness: 34 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onHover: (evt, els) => { if(evt.native) evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        onClick: (evt, els) => {
          if(!els.length) return;
          const key = meses[els[0].index].key;
          if(Meses.info(key) && key !== State.mesSelecionado) selecionarMes(key);
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: textMuted, font: { family: "'Oswald',sans-serif", size: 12 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + fmtMetric(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textMuted, font: { family: mono, size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: cssVar('--border') },
            ticks: {
              color: textMuted,
              font: { family: mono, size: 10.5 },
              callback: (v) => rankMetric === 'valor' ? 'R$ ' + v : v
            }
          }
        }
      }
    });
  }

  /* ---------- ranking de fornecedores ---------- */
  function rowClass(i){ return i < 3 ? 'rank-row top-' + (i + 1) : 'rank-row'; }

  function renderRankFornecedores(){
    const map = {};
    State.perdas.forEach(p => {
      if(fornTipo && p.tipo !== fornTipo) return;
      const f = p.fornecedor || '—';
      const o = map[f] || (map[f] = { V: { val: 0, qtd: 0 }, A: { val: 0, qtd: 0 } });
      const t = p.tipo === 'VENCIDO' ? o.V : o.A;
      t.val += p.valorTotal || 0;
      t.qtd += p.quantidade || 0;
    });

    const todos = Object.keys(map).map(f => {
      const o = map[f];
      const tot = { val: o.V.val + o.A.val, qtd: o.V.qtd + o.A.qtd };
      return { fornecedor: f, V: o.V, A: o.A, tot, venc: pick(o.V), avar: pick(o.A), total: pick(tot) };
    }).sort((a, b) => b.total - a.total);

    const wrap = $('rankFornecedores');
    const btnMais = $('btnFornMais');
    wrap.innerHTML = '';
    if(todos.length === 0){
      wrap.innerHTML = '<div class="rank-empty">Sem dados.</div>';
      btnMais.hidden = true;
      return;
    }

    const grand = todos.reduce((s, x) => s + x.total, 0);
    const limite = fornExpandido ? TOP_MAX : TOP_INICIAL;
    const lista = todos.slice(0, limite);
    const maxTotal = lista[0].total || 1;

    btnMais.hidden = todos.length <= TOP_INICIAL;
    btnMais.textContent = fornExpandido ? 'Ver menos' : 'Ver mais';

    lista.forEach((item, i) => {
      const totalPct = item.total ? Math.max(4, (item.total / maxTotal) * 100) : 0;
      const vPct = item.total ? (item.venc / item.total) * 100 : 0;
      const aPct = item.total ? (item.avar / item.total) * 100 : 0;
      const pct = grand ? (item.total / grand) * 100 : 0;
      const pctTxt = pct > 0 && pct < 1 ? '<1%' : Math.round(pct) + '%';
      const detalhe = 'Vencido: ' + fmtMetric(item.venc) + ' · Avariado: ' + fmtMetric(item.avar);

      const row = document.createElement('div');
      row.className = rowClass(i);
      row.dataset.forn = item.fornecedor;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', 'Abrir relatório de ' + item.fornecedor);
      row.innerHTML = `
        <div class="rank-row-top">
          <div class="rank-badge">${i + 1}</div>
          <div class="rank-info">
            <div class="rname" title="${esc(item.fornecedor)}">${esc(item.fornecedor)}</div>
            <div class="rsub">${fmtOutra(item.tot)} · ${pctTxt} do total</div>
          </div>
          <div class="rank-val">${fmtMetric(item.total)}</div>
        </div>
        <div class="rank-bar" title="${esc(detalhe)}">
          <div class="rank-bar-track" style="width:${totalPct}%;">
            <div class="rank-bar-seg VENCIDO" style="width:${vPct}%;"></div>
            <div class="rank-bar-seg AVARIADO" style="width:${aPct}%;"></div>
          </div>
        </div>`;
      wrap.appendChild(row);
    });
  }

  /* ---------- ranking de produtos ---------- */
  function renderRankProdutos(tipo, elId){
    const map = {};
    State.perdas.filter(p => p.tipo === tipo).forEach(p => {
      const key = chaveProduto(p);
      const o = map[key] || (map[key] = { descricao: p.descricao, fornecedor: p.fornecedor, codigo: p.codigo, val: 0, qtd: 0 });
      o.val += p.valorTotal || 0;
      o.qtd += p.quantidade || 0;
    });
    const list = Object.values(map).sort((a, b) => pick(b) - pick(a)).slice(0, TOP_INICIAL);

    const wrap = $(elId);
    wrap.innerHTML = '';
    if(list.length === 0){ wrap.innerHTML = '<div class="rank-empty">Sem dados.</div>'; return; }

    const maxVal = pick(list[0]) || 1;
    list.forEach((item, i) => {
      const v = pick(item);
      const pct = v ? Math.max(4, (v / maxVal) * 100) : 0;
      const sub = (item.fornecedor || '—') + (item.codigo ? ' · cód. ' + item.codigo : '') + ' · ' + fmtOutra(item);
      const row = document.createElement('div');
      row.className = rowClass(i);
      row.innerHTML = `
        <div class="rank-row-top">
          <div class="rank-badge">${i + 1}</div>
          <div class="rank-info">
            <div class="rname" title="${esc(item.descricao)}">${esc(item.descricao)}</div>
            <div class="rsub" title="${esc(sub)}">${esc(sub)}</div>
          </div>
          <div class="rank-val">${fmtMetric(v)}</div>
        </div>
        <div class="rank-bar">
          <div class="rank-bar-track" style="width:${pct}%;">
            <div class="rank-bar-seg ${tipo}" style="width:100%;"></div>
          </div>
        </div>`;
      wrap.appendChild(row);
    });
  }

  /* ---------- ações ---------- */
  async function selecionarMes(ref){
    State.mesSelecionado = ref;
    State.erro = '';
    setLoading(true);
    await State.reloadPerdas();
    render();
  }

  function abrirRelatorioDoFornecedor(nome){
    PageRelatorio.filtrarPorFornecedor(nome);
    App.goTo('relatorio');
  }

  function bind(){
    // métrica: valor x quantidade
    const toggles = document.querySelectorAll('#page-rankings .metric-toggle .toggle-btn');
    toggles.forEach(btn => {
      btn.addEventListener('click', function(){
        toggles.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        rankMetric = this.dataset.metric;
        render();
      });
    });

    // filtro de tipo nos fornecedores
    const segs = document.querySelectorAll('#rankFornTipo button');
    segs.forEach(btn => {
      btn.addEventListener('click', function(){
        segs.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        fornTipo = this.dataset.tipo;
        fornExpandido = false;
        renderRankFornecedores();
      });
    });

    $('btnFornMais')?.addEventListener('click', () => {
      fornExpandido = !fornExpandido;
      renderRankFornecedores();
    });

    // clique / teclado numa linha de fornecedor -> relatório filtrado
    const listaForn = $('rankFornecedores');
    listaForn?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-forn]');
      if(row) abrirRelatorioDoFornecedor(row.dataset.forn);
    });
    listaForn?.addEventListener('keydown', (e) => {
      if(e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('[data-forn]');
      if(!row) return;
      e.preventDefault();
      abrirRelatorioDoFornecedor(row.dataset.forn);
    });

    // seletor de mês
    Meses.bindSelect($('rankMesSelect'), async () => {
      State.erro = '';
      setLoading(true);
      await State.reloadPerdas();
      render();
    });

    $('btnRankRetry')?.addEventListener('click', () => App.goTo('rankings'));
  }

  bind();

  window.addEventListener('themechange', () => {
    if($('page-rankings')?.classList.contains('active')) render();
  });

  return { refresh: render, showSkeleton: () => setLoading(true) };
})();