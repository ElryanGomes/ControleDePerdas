/* ============================================================
   Página: Gráficos
   Um único gráfico de colunas que muda conforme o filtro
   escolhido: quantidade/valor de vencidos ou avariados,
   fornecedores com mais perdas, e comparações entre eles.
   ============================================================ */
const PageGraficos = (function(){
  const $ = (id) => document.getElementById(id);
  let chartInstance = null;

  const METRICS = {
    vencidos_qtd:            { type: 'mensal_single',       tipo: 'VENCIDO',  campo: 'quantidade', label: 'Vencidos (quantidade)' },
    avariados_qtd:           { type: 'mensal_single',       tipo: 'AVARIADO', campo: 'quantidade', label: 'Avariados (quantidade)' },
    fornecedores_perdas:     { type: 'fornecedor_single',   campo: 'quantidade', label: 'Fornecedores com mais perdas' },
    vencidos_valor:          { type: 'mensal_single',       tipo: 'VENCIDO',  campo: 'valorTotal', label: 'Vencidos (R$)' },
    avariados_valor:         { type: 'mensal_single',       tipo: 'AVARIADO', campo: 'valorTotal', label: 'Avariados (R$)' },
    comparacao_qtd:          { type: 'mensal_comparacao',   campo: 'quantidade' },
    comparacao_fornecedores: { type: 'fornecedor_comparacao', campo: 'valorTotal' },
    comparacao_valor:        { type: 'mensal_comparacao',   campo: 'valorTotal' }
  };

  function cssVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // janela de N meses terminando no mês aberto (o mais recente com lançamentos)
  function janelaMeses(n){
    return Meses.janela(State.mesAberto || Meses.refAtual(), n);
  }

  // usa o mês de referência gravado no banco (sem new Date → sem erro de fuso)
  function perdasNoPeriodo(nMeses){
    const keys = new Set(janelaMeses(nMeses).map(m => m.key));
    return State.perdasTodas.filter(p => keys.has(p.mesRef));
  }

  /* ---------- construtores de dataset ---------- */
  function dadosMensalSingle(cfg, meses){
    const valores = meses.map(() => 0);
    perdasNoPeriodo(meses.length).forEach(p => {
      if(p.tipo !== cfg.tipo) return;
      const idx = meses.findIndex(m => m.key === p.mesRef);
      if(idx >= 0) valores[idx] += p[cfg.campo];
    });
    const cor = cfg.tipo === 'VENCIDO' ? cssVar('--vencido') : cssVar('--avariado');
    return {
      labels: meses.map(m => m.label),
      datasets: [{ label: cfg.label, data: valores, backgroundColor: cor, borderRadius: 4, maxBarThickness: 42 }]
    };
  }

  function dadosMensalComparacao(cfg, meses){
    const vencido = meses.map(() => 0), avariado = meses.map(() => 0);
    perdasNoPeriodo(meses.length).forEach(p => {
      const idx = meses.findIndex(m => m.key === p.mesRef);
      if(idx < 0) return;
      (p.tipo === 'VENCIDO' ? vencido : avariado)[idx] += p[cfg.campo];
    });
    return {
      labels: meses.map(m => m.label),
      datasets: [
        { label: 'Vencido', data: vencido, backgroundColor: cssVar('--vencido'), borderRadius: 4, maxBarThickness: 30 },
        { label: 'Avariado', data: avariado, backgroundColor: cssVar('--avariado'), borderRadius: 4, maxBarThickness: 30 }
      ]
    };
  }

  function dadosFornecedorSingle(cfg, nMeses){
    const map = {};
    perdasNoPeriodo(nMeses).forEach(p => { map[p.fornecedor] = (map[p.fornecedor] || 0) + p[cfg.campo]; });
    const arr = Object.keys(map)
      .map(f => ({ f, v: map[f] }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 8);
    return {
      labels: arr.map(x => x.f),
      datasets: [{ label: cfg.label, data: arr.map(x => x.v), backgroundColor: cssVar('--steel'), borderRadius: 4, maxBarThickness: 42 }]
    };
  }

  function dadosFornecedorComparacao(cfg, nMeses){
    const map = {};
    perdasNoPeriodo(nMeses).forEach(p => {
      if(!map[p.fornecedor]) map[p.fornecedor] = { vencido: 0, avariado: 0 };
      map[p.fornecedor][p.tipo === 'VENCIDO' ? 'vencido' : 'avariado'] += p[cfg.campo];
    });
    const arr = Object.keys(map)
      .map(f => ({ f, ...map[f], total: map[f].vencido + map[f].avariado }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    return {
      labels: arr.map(x => x.f),
      datasets: [
        { label: 'Vencido', data: arr.map(x => x.vencido), backgroundColor: cssVar('--vencido'), borderRadius: 4, maxBarThickness: 26 },
        { label: 'Avariado', data: arr.map(x => x.avariado), backgroundColor: cssVar('--avariado'), borderRadius: 4, maxBarThickness: 26 }
      ]
    };
  }

  function construirGrafico(metricKey, nMeses){
    const cfg = METRICS[metricKey];
    const meses = janelaMeses(nMeses);
    const isMoney = cfg.campo === 'valorTotal';

    let data;
    switch(cfg.type){
      case 'mensal_single':          data = dadosMensalSingle(cfg, meses); break;
      case 'mensal_comparacao':      data = dadosMensalComparacao(cfg, meses); break;
      case 'fornecedor_single':      data = dadosFornecedorSingle(cfg, nMeses); break;
      case 'fornecedor_comparacao':  data = dadosFornecedorComparacao(cfg, nMeses); break;
    }
    return { data, isMoney };
  }

  /* ---------- render ---------- */
  function render(){
    if(State.perdasTodas.length === 0){
      $('graficoEmpty').style.display = 'block';
      $('graficoWrap').style.display = 'none';
      return;
    }
    $('graficoEmpty').style.display = 'none';
    $('graficoWrap').style.display = 'block';

    const metricKey = $('graficoMetric').value;
    const nMeses = parseInt($('graficoPeriodo').value);
    const { data, isMoney } = construirGrafico(metricKey, nMeses);

    const ctx = document.getElementById('chartPrincipal').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    if(typeof Chart === 'undefined') return;

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: data.datasets.length > 1,
            position: 'bottom',
            labels: { color: cssVar('--text-muted'), font: { family: "'Oswald',sans-serif", size: 11.5 }, boxWidth: 12 }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: cssVar('--text-muted'), font: { family: "'IBM Plex Mono',monospace", size: 10.5 }, maxRotation: 40, minRotation: 0 }
          },
          y: {
            grid: { color: cssVar('--border') },
            ticks: {
              color: cssVar('--text-muted'),
              font: { family: "'IBM Plex Mono',monospace", size: 10.5 },
              callback: (v) => isMoney ? 'R$' + v : v
            }
          }
        }
      }
    });
  }

  function bind(){
    $('graficoMetric').addEventListener('change', render);
    $('graficoPeriodo').addEventListener('change', render);
  }

  bind();

  window.addEventListener('themechange', () => {
    if(document.getElementById('page-graficos')?.classList.contains('active')) render();
  });

  // o Gráficos é global: sempre carrega todos os meses
  async function refresh(){
    await State.reloadPerdasTodas();
    render();
  }

  return { refresh };
})();