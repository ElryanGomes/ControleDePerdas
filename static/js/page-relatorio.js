/* ============================================================
   Página: Relatório
   - Agrupado por fornecedor em cards (quando "todos" está selecionado)
   - Dentro de cada card: avariados primeiro, vencidos depois
   - Filtro de fornecedor pesquisável (mesmo padrão do Registrar)
   - Menu de 3 pontos por linha: Editar / Apagar
   ============================================================ */
const PageRelatorio = (function(){
  const $ = (id) => document.getElementById(id);
  let editingPerdaId = null;
  let kebabTargetId = null;

  /* ---------- filtro / dados ---------- */
  function fillFiltroDatalist(){
    const dl = $('filtroFornDatalist');
    dl.innerHTML = '';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f;
      dl.appendChild(o);
    });
  }

  function filtered(){
    const termo = $('filtroForn').value.trim().toLowerCase();
    const tipo = $('filtroTipo').value;
    return State.perdas.filter(p =>
      (!termo || p.fornecedor.toLowerCase().includes(termo)) &&
      (!tipo || p.tipo === tipo)
    );
  }

  function ordemTipo(t){ return t === 'AVARIADO' ? 0 : 1; } // avariados primeiro

  function agruparPorFornecedor(list){
    const map = {};
    list.forEach(p => {
      if(!map[p.fornecedor]) map[p.fornecedor] = [];
      map[p.fornecedor].push(p);
    });
    return Object.keys(map).sort((a, b) => a.localeCompare(b)).map(f => ({
      fornecedor: f,
      itens: [...map[f]].sort((a, b) => ordemTipo(a.tipo) - ordemTipo(b.tipo)),
      subtotal: map[f].reduce((s, p) => s + p.valorTotal, 0)
    }));
  }

  /* ---------- render ---------- */
  function render(){
    fillFiltroDatalist();
    const list = filtered();
    const empty = $('relatorioEmpty');
    const content = $('relatorioContent');

    if(State.perdas.length === 0){
      empty.style.display = 'block';
      content.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    content.style.display = 'block';

    $('relTotValor').textContent = Utils.fmtBRL(list.reduce((s, p) => s + p.valorTotal, 0));

    const grupos = agruparPorFornecedor(list);
    const wrap = $('relatorioGroups');
    wrap.innerHTML = '';

    if(grupos.length === 0){
      wrap.innerHTML = '<div class="empty-state" style="padding:36px 20px;">Nenhum registro para esse filtro.</div>';
      return;
    }

    grupos.forEach(g => {
      const card = document.createElement('div');
      card.className = 'panel report-card';
      card.innerHTML = `
        <div class="report-card-header">
          <h3>${Utils.escapeHtml(g.fornecedor)}</h3>
          <span class="subtotal">${Utils.fmtBRL(g.subtotal)}</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th class="center">Motivo</th>
                <th class="num center">Qtd.</th>
                <th class="center">Código</th>
                <th class="center">Validade</th>
                <th class="num center">Val. Unit.</th>
                <th class="num center">Val. Total</th>
                <th class="center"></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>`;

      const tbody = card.querySelector('tbody');
      g.itens.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${Utils.escapeHtml(p.descricao)}</td>
          <td class="center"><span class="badge ${p.tipo}">${p.tipo}</span></td>
          <td class="num center">${p.quantidade}</td>
          <td class="mono center">${p.codigo || '—'}</td>
          <td class="mono center">${Utils.formatValidade(p.validade)}</td>
          <td class="num center">${Utils.fmtBRL(p.valorUnit)}</td>
          <td class="num center">${Utils.fmtBRL(p.valorTotal)}</td>
          <td class="center"><button class="kebab-btn" data-id="${p.id}">⋮</button></td>`;
        tbody.appendChild(tr);
      });

      wrap.appendChild(card);
    });

    bindKebabButtons();
  }

  /* ---------- menu de 3 pontos (compartilhado, posicionado no clique) ---------- */
  function closeKebab(){
    $('kebabMenu').classList.remove('open');
    kebabTargetId = null;
  }

  function openKebab(btn, id){
    kebabTargetId = id;
    const menu = $('kebabMenu');
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.style.left = 'auto';
    menu.classList.add('open');
  }

  function bindKebabButtons(){
    document.querySelectorAll('#relatorioGroups .kebab-btn').forEach(btn => {
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        if(kebabTargetId === id && $('kebabMenu').classList.contains('open')){ closeKebab(); return; }
        openKebab(this, id);
      });
    });
  }

  /* ---------- editar registro ---------- */
  function fillPerdaModalDatalist(){
    const dl = $('perdaModalFornDatalist');
    dl.innerHTML = '';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f;
      dl.appendChild(o);
    });
  }

  function openEditPerda(id){
    const p = State.perdas.find(x => x.id === id);
    if(!p) return;
    editingPerdaId = id;
    fillPerdaModalDatalist();
    $('perdaModalForn').value = p.fornecedor;
    $('perdaModalDesc').value = p.descricao;
    $('perdaModalCodigo').value = p.codigo;
    $('perdaModalQtd').value = p.quantidade;
    $('perdaModalValidade').value = p.validade;
    $('perdaModalValor').value = p.valorUnit;
    document.querySelectorAll('#perdaModal .toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tipo === p.tipo);
    });
    $('perdaModal').classList.add('open');
  }

  async function salvarEdicaoPerda(){
    const fornecedor = $('perdaModalForn').value.trim();
    const descricao = $('perdaModalDesc').value.trim();
    const codigo = $('perdaModalCodigo').value.trim();
    const tipoBtn = document.querySelector('#perdaModal .toggle-btn.active');
    const tipo = tipoBtn ? tipoBtn.dataset.tipo : '';
    const quantidade = parseInt($('perdaModalQtd').value);
    const validade = $('perdaModalValidade').value.trim();
    const valorUnit = parseFloat($('perdaModalValor').value);

    if(!fornecedor){ Utils.toast('Informe o fornecedor.', 'error'); return; }
    if(!descricao){ Utils.toast('Informe a descrição.', 'error'); return; }
    if(!tipo){ Utils.toast('Selecione Vencido ou Avariado.', 'error'); return; }
    if(!quantidade || quantidade < 1){ Utils.toast('Informe a quantidade.', 'error'); return; }
    if(!validade){ Utils.toast('Informe a validade.', 'error'); return; }
    if(isNaN(valorUnit) || valorUnit < 0){ Utils.toast('Informe o valor unitário.', 'error'); return; }

    try{
      await Api.atualizarPerda(editingPerdaId, { fornecedor, descricao, codigo, tipo, quantidade, validade, valorUnit });
      await State.reloadAll();
      $('perdaModal').classList.remove('open');
      render();
      Utils.toast('Registro atualizado.', 'success');
    }catch(e){
      Utils.toast(e.message || 'Erro ao salvar.', 'error');
    }
  }

  /* ---------- apagar registro ---------- */
  async function apagarPerda(id){
    try{
      await Api.excluirPerda(id);
      await State.reloadPerdas();
      render();
      Utils.toast('Registro excluído.', 'success');
    }catch(e){
      Utils.toast(e.message || 'Erro ao excluir.', 'error');
    }
  }

  /* ---------- exportar CSV ---------- */
  function exportCSV(){
    const list = filtered();
    if(list.length === 0){ Utils.toast('Não há registros para exportar.', 'error'); return; }

    const headers = ['Distribuidora','Descrição','Vencido ou Avariado','Quantidade','Código','Validade','Valor Unitário','Valor Total'];
    const rows = list.map(p => [
      p.fornecedor, p.descricao, p.tipo, p.quantidade, p.codigo,
      p.validade, String(p.valorUnit).replace('.', ','), String(p.valorTotal).replace('.', ',')
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planilha_perdas_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Utils.toast('CSV exportado com sucesso!', 'success');
  }

  async function exportXLSX(){
    const list = filtered();
    if(list.length === 0){ Utils.toast('Não há registros para exportar.', 'error'); return; }

    const btn = $('btnExportXLSX');
    btn.disabled = true;
    try{
      const blob = await Api.exportarXLSX(list);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio_perdas_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Utils.toast('Excel exportado com sucesso!', 'success');
    }catch(e){
      Utils.toast(e.message || 'Erro ao gerar o Excel.', 'error');
    }finally{
      btn.disabled = false;
    }
  }

  /* ---------- binds ---------- */
  function bind(){
    $('filtroForn').addEventListener('input', render);
    $('filtroTipo').addEventListener('change', render);
    $('btnExportCSV').addEventListener('click', exportCSV);
    $('btnExportXLSX').addEventListener('click', exportXLSX);

    $('kebabEdit').addEventListener('click', () => {
      const id = kebabTargetId;
      closeKebab();
      if(id) openEditPerda(id);
    });
    $('kebabDelete').addEventListener('click', () => {
      const id = kebabTargetId;
      closeKebab();
      if(id) apagarPerda(id);
    });

    document.addEventListener('click', (e) => {
      const menu = $('kebabMenu');
      if(menu && menu.classList.contains('open') && !menu.contains(e.target)) closeKebab();
    });

    document.querySelectorAll('#perdaModal .toggle-btn').forEach(btn => {
      btn.addEventListener('click', function(){
        document.querySelectorAll('#perdaModal .toggle-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
    });
    $('btnCancelPerda').addEventListener('click', () => $('perdaModal').classList.remove('open'));
    $('btnSavePerda').addEventListener('click', salvarEdicaoPerda);
  }

  /* ---------- skeleton (enquanto aguarda o backend) ---------- */
  function showSkeleton(){
    $('relatorioEmpty').style.display = 'none';
    $('relatorioContent').style.display = 'block';

    $('relTotValor').innerHTML = '<span class="skeleton skeleton-bar" style="width:100px;"></span>';

    const wrap = $('relatorioGroups');
    wrap.innerHTML = '';
    for(let i = 0; i < 2; i++){
      const card = document.createElement('div');
      card.className = 'panel report-card';
      const linhas = Array.from({ length: 3 }).map(() => `
        <div class="skeleton-row-line">
          <span class="skeleton skeleton-bar" style="width:34%;"></span>
          <span class="skeleton skeleton-bar" style="width:60px;"></span>
          <span class="skeleton skeleton-bar" style="width:30px;"></span>
          <span class="skeleton skeleton-bar" style="width:70px;"></span>
          <span class="skeleton skeleton-bar" style="width:70px;"></span>
        </div>`).join('');
      card.innerHTML = `
        <div class="report-card-header">
          <span class="skeleton skeleton-bar" style="width:150px;"></span>
          <span class="skeleton skeleton-bar" style="width:70px;"></span>
        </div>
        ${linhas}`;
      wrap.appendChild(card);
    }
  }

  bind();
  return { refresh: render, showSkeleton };
})();
