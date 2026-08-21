/* ============================================================
   Página: Rankings
   ============================================================ */
const PageRankings = (function(){
  const $ = (id) => document.getElementById(id);
  let rankMetric = 'valor'; // 'valor' | 'quantidade'
  let chartMensal = null;

  function metricVal(p){ return rankMetric === 'valor' ? p.valorTotal : p.quantidade; }
  function fmtMetric(n){ return rankMetric === 'valor' ? Utils.fmtBRL(n) : (n + ' un'); }

  function render(){
    const empty = $('rankEmpty');
    const content = $('rankContent');
    if(State.perdas.length === 0){
      empty.style.display = 'block';
      content.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    content.style.display = 'block';

    let vVal = 0, vQtd = 0, aVal = 0, aQtd = 0;
    State.perdas.forEach(p => {
      if(p.tipo === 'VENCIDO'){ vVal += p.valorTotal; vQtd += p.quantidade; }
      else { aVal += p.valorTotal; aQtd += p.quantidade; }
    });
    $('sumVencidoValor').textContent = Utils.fmtBRL(vVal);
    $('sumVencidoQtd').textContent = vQtd + ' itens';
    $('sumAvariadoValor').textContent = Utils.fmtBRL(aVal);
    $('sumAvariadoQtd').textContent = aQtd + ' itens';
    $('sumGeralValor').textContent = Utils.fmtBRL(vVal + aVal);
    $('sumGeralQtd').textContent = (vQtd + aQtd) + ' itens';

    renderChartMensal();
    renderRankFornecedores();
    renderRankProdutos('VENCIDO', 'rankProdutosVencido');
    renderRankProdutos('AVARIADO', 'rankProdutosAvariado');
  }

  function renderChartMensal(){
    const meses = Utils.ultimosMeses(6);
    const vencidoData = meses.map(() => 0);
    const avariadoData = meses.map(() => 0);

    State.perdas.forEach(p => {
      const d = new Date(p.data);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const idx = meses.findIndex(m => m.key === key);
      if(idx < 0) return;
      const val = rankMetric === 'valor' ? p.valorTotal : p.quantidade;
      if(p.tipo === 'VENCIDO') vencidoData[idx] += val; else avariadoData[idx] += val;
    });

    const ctx = document.getElementById('chartMensal').getContext('2d');
    if(chartMensal) chartMensal.destroy();
    if(typeof Chart === 'undefined') return;

    chartMensal = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: meses.map(m => m.label),
        datasets: [
          { label: 'Vencido', data: vencidoData, backgroundColor: '#B23A2E', borderRadius: 4, maxBarThickness: 34 },
          { label: 'Avariado', data: avariadoData, backgroundColor: '#C98A1B', borderRadius: 4, maxBarThickness: 34 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { font: { family: "'Oswald',sans-serif", size: 11.5 }, boxWidth: 12 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'IBM Plex Mono',monospace", size: 11 } } },
          y: {
            grid: { color: '#EEF1F4' },
            ticks: {
              font: { family: "'IBM Plex Mono',monospace", size: 10.5 },
              callback: (v) => rankMetric === 'valor' ? 'R$' + v : v
            }
          }
        }
      }
    });
  }

  function renderRankFornecedores(){
    const map = {};
    State.perdas.forEach(p => {
      if(!map[p.fornecedor]) map[p.fornecedor] = { vencido: 0, avariado: 0 };
      map[p.fornecedor][p.tipo === 'VENCIDO' ? 'vencido' : 'avariado'] += metricVal(p);
    });
    const list = Object.keys(map).map(f => ({
      fornecedor: f, vencido: map[f].vencido, avariado: map[f].avariado, total: map[f].vencido + map[f].avariado
    })).sort((a, b) => b.total - a.total);

    const maxTotal = list.length ? list[0].total : 1;
    const wrap = $('rankFornecedores');
    wrap.innerHTML = '';
    if(list.length === 0){ wrap.innerHTML = '<div style="padding:14px 0;color:var(--text-muted);font-size:13px;">Sem dados.</div>'; return; }

    list.forEach((item, i) => {
      const totalPct = Math.max(4, (item.total / maxTotal) * 100);
      const vPct = item.total ? (item.vencido / item.total) * 100 : 0;
      const aPct = item.total ? (item.avariado / item.total) * 100 : 0;
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML = `
        <div class="rank-row-top">
          <div class="rank-badge">${i + 1}</div>
          <div class="rank-info">
            <div class="rname">${Utils.escapeHtml(item.fornecedor)}</div>
            <div class="rsub">Venc. ${fmtMetric(item.vencido)} · Avar. ${fmtMetric(item.avariado)}</div>
          </div>
          <div class="rank-val">${fmtMetric(item.total)}</div>
        </div>
        <div class="rank-bar-track" style="width:${totalPct}%;">
          <div class="rank-bar-seg VENCIDO" style="width:${vPct}%;"></div>
          <div class="rank-bar-seg AVARIADO" style="width:${aPct}%;"></div>
        </div>`;
      wrap.appendChild(row);
    });
  }

  function renderRankProdutos(tipo, elId){
    const map = {};
    State.perdas.filter(p => p.tipo === tipo).forEach(p => {
      const key = p.fornecedor + '|' + p.descricao;
      if(!map[key]) map[key] = { descricao: p.descricao, fornecedor: p.fornecedor, val: 0 };
      map[key].val += metricVal(p);
    });
    const list = Object.values(map).sort((a, b) => b.val - a.val).slice(0, 5);
    const maxVal = list.length ? list[0].val : 1;
    const wrap = $(elId);
    wrap.innerHTML = '';
    if(list.length === 0){ wrap.innerHTML = '<div style="padding:14px 0;color:var(--text-muted);font-size:13px;">Sem dados.</div>'; return; }

    list.forEach((item, i) => {
      const pct = Math.max(4, (item.val / maxVal) * 100);
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML = `
        <div class="rank-row-top">
          <div class="rank-badge">${i + 1}</div>
          <div class="rank-info">
            <div class="rname">${Utils.escapeHtml(item.descricao)}</div>
            <div class="rsub">${Utils.escapeHtml(item.fornecedor)}</div>
          </div>
          <div class="rank-val">${fmtMetric(item.val)}</div>
        </div>
        <div class="rank-bar-track" style="width:${pct}%;">
          <div class="rank-bar-seg ${tipo}" style="width:100%;"></div>
        </div>`;
      wrap.appendChild(row);
    });
  }

  function bind(){
    document.querySelectorAll('#page-rankings .metric-toggle .toggle-btn').forEach(btn => {
      btn.addEventListener('click', function(){
        document.querySelectorAll('#page-rankings .metric-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        rankMetric = this.dataset.metric;
        render();
      });
    });
  }

  bind();
  return { refresh: render };
})();
