/* ============================================================
   Meses — sistema mensal
   - helpers de mês ('AAAA-MM')
   - seletor de mês reutilizável (Relatório e Rankings)
   - chip do mês aberto na barra superior + modal "Fechar mês"
   ============================================================ */
const Meses = (function(){
  const $ = (id) => document.getElementById(id);
  const NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  /* ---------- helpers ---------- */
  function parse(ref){
    const p = String(ref).split('-');
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10) };
  }
  function keyDe(y, m0){ // m0 = mês 0-11, aceita estouro (ex: -1 volta para dez do ano anterior)
    const d = new Date(y, m0, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function label(ref){
    if(ref === 'TODOS') return 'Acumulado';
    const { y, m } = parse(ref);
    return NOMES[m - 1] + '/' + y;
  }
  function labelCurto(ref){
    const { y, m } = parse(ref);
    return Utils.MESES_ABBR[m - 1] + '/' + String(y).slice(2);
  }
  function anterior(ref){
    const { y, m } = parse(ref);
    return keyDe(y, m - 2);
  }
  // n meses terminando em refFim (inclusive): [{key, label}]
  function janela(refFim, n){
    const { y, m } = parse(refFim);
    const arr = [];
    for(let i = n - 1; i >= 0; i--){
      const key = keyDe(y, m - 1 - i);
      arr.push({ key, label: labelCurto(key) });
    }
    return arr;
  }
  function refAtual(){
    if(State.mesCalendario) return State.mesCalendario;
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function info(ref){ return State.meses.find(m => m.ref === ref) || null; }
  function ehFechado(ref){ const i = info(ref); return !!i && i.status === 'FECHADO'; }

  /* ---------- seletor de mês ---------- */
  function fillSelect(sel){
    if(!sel) return;
    sel.innerHTML = '';
    State.meses.forEach(m => {
      const o = document.createElement('option');
      o.value = m.ref;
      o.textContent = label(m.ref) + ' · ' + (m.status === 'ABERTO' ? 'Aberto' : 'Fechado');
      sel.appendChild(o);
    });
    const todos = document.createElement('option');
    todos.value = 'TODOS';
    todos.textContent = 'Acumulado (todos os meses)';
    sel.appendChild(todos);
    sel.value = State.mesSelecionado;
  }

  function bindSelect(sel, onChange){
    if(!sel) return;
    sel.addEventListener('change', () => {
      State.mesSelecionado = sel.value;
      onChange();
    });
  }

  /* ---------- chip na barra superior ---------- */
  function renderChip(){
    const chip = $('mesChip');
    if(!chip) return;
    if(!State.mesAberto){ chip.hidden = true; return; }
    const atrasado = !!State.mesCalendario && State.mesAberto < State.mesCalendario;
    chip.hidden = false;
    chip.classList.toggle('alerta', atrasado);
    chip.innerHTML =
      '<span class="mes-dot"></span>' +
      '<span class="mes-chip-label">' + labelCurto(State.mesAberto) + '</span>' +
      '<span class="mes-extra">· Aberto' + (atrasado ? ' · fechar?' : '') + '</span>';
    chip.title = atrasado
      ? 'O mês aberto é anterior ao mês atual — clique para fechá-lo'
      : 'Mês de registro aberto — clique para fechar o mês';
  }

  /* ---------- modal: fechar mês ---------- */
  function baixarBlob(blob, nome){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function abrirFechar(){
    await State.reloadMeses(); // totais atualizados
    renderChip();
    const ref = State.mesAberto;
    if(!ref){ Utils.toast('Nenhum mês aberto.', 'error'); return; }
    const m = info(ref) || { registros: 0, vencido: { valor: 0, quantidade: 0 }, avariado: { valor: 0, quantidade: 0 } };
    $('fmTitulo').textContent = 'Fechar ' + label(ref);
    $('fmResumo').innerHTML =
      '<div class="fm-linha"><span>Vencido</span><b>' + Utils.fmtBRL(m.vencido.valor) + '</b><small>' + m.vencido.quantidade + ' un</small></div>' +
      '<div class="fm-linha"><span>Avariado</span><b>' + Utils.fmtBRL(m.avariado.valor) + '</b><small>' + m.avariado.quantidade + ' un</small></div>' +
      '<div class="fm-linha fm-total"><span>Registros no mês</span><b>' + m.registros + '</b><small></small></div>';
    $('btnFmConfirm').textContent = 'Fechar ' + label(ref);
    $('btnFmConfirm').disabled = false;
    $('fecharMesModal').classList.add('open');
  }

  function fecharModal(){
    const modal = $('fecharMesModal');
    if(modal) modal.classList.remove('open');
  }

  async function confirmarFechar(){
    const ref = State.mesAberto;
    const btn = $('btnFmConfirm');
    btn.disabled = true;
    btn.textContent = 'Fechando…';
    try{
      const r = await Api.fecharMes(ref);
      fecharModal();
      State.mesSelecionado = r.aberto; // passa a olhar o novo mês aberto
      Utils.toast(label(r.fechado) + ' fechado. ' + label(r.aberto) + ' está aberto.', 'success');
      await App.goTo(App.current());
    }catch(e){
      Utils.toast(e.message || 'Erro ao fechar o mês.', 'error');
      if(e.status === 409){ fecharModal(); await App.goTo(App.current()); }
      else { btn.disabled = false; btn.textContent = 'Fechar ' + label(ref); }
    }
  }

  async function exportarMesAberto(){
    const ref = State.mesAberto;
    const btn = $('btnFmExport');
    btn.disabled = true;
    try{
      const lista = await Api.getPerdas(ref);
      if(lista.length === 0){ Utils.toast('Não há registros neste mês para exportar.', 'error'); return; }
      const blob = await Api.exportarXLSX(lista, ref);
      baixarBlob(blob, 'relatorio_perdas_' + ref + '.xlsx');
      Utils.toast('Excel exportado com sucesso!', 'success');
    }catch(e){
      Utils.toast(e.message || 'Erro ao gerar o Excel.', 'error');
    }finally{
      btn.disabled = false;
    }
  }

  function bind(){
    $('mesChip')?.addEventListener('click', abrirFechar);
    $('btnFmCancel')?.addEventListener('click', fecharModal);
    $('btnFmConfirm')?.addEventListener('click', confirmarFechar);
    $('btnFmExport')?.addEventListener('click', exportarMesAberto);
    $('fecharMesModal')?.addEventListener('click', function(e){ if(e.target === this) fecharModal(); });
    document.addEventListener('keydown', (e) => { if(e.key === 'Escape') fecharModal(); });
  }

  bind();

  return {
    label, labelCurto, anterior, janela, refAtual, info, ehFechado,
    fillSelect, bindSelect, renderChip
  };
})();
