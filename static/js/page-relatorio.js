/* ============================================================
   Página: Relatório - CÓDIGO COMPLETO SEM CONFLITOS
   - Sem duplicações
   - Kebab menu corrigido
   - Todos os filtros funcionando
   ============================================================ */

const PageRelatorio = (function () {
  const $ = (id) => document.getElementById(id);
  
  let editingPerdaId = null;
  let kebabTargetId = null;
  let pendingDeleteId = null;

  /* ========== FUNÇÕES AUXILIARES ========== */

  function truncarDescricao(desc, maxChars = 50) {
    if (!desc) return '—';
    if (desc.length > maxChars) return desc.substring(0, maxChars) + '…';
    return desc;
  }

  function ordemTipo(t) {
    return t === 'AVARIADO' ? 0 : 1; // avariados primeiro
  }

  function agruparPorFornecedor(list) {
    const map = {};
    list.forEach(p => {
      if (!map[p.fornecedor]) map[p.fornecedor] = [];
      map[p.fornecedor].push(p);
    });
    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map(f => ({
        fornecedor: f,
        itens: [...map[f]].sort((a, b) => ordemTipo(a.tipo) - ordemTipo(b.tipo)),
        subtotal: map[f].reduce((s, p) => s + p.valorTotal, 0)
      }));
  }

  /* ========== FILTROS ========== */

  function fillFiltroDatalist() {
    const dl = $('filtroFornDatalist');
    if (!dl) return;
    dl.innerHTML = '';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f;
      dl.appendChild(o);
    });
  }

  function filtered() {
    const termo = $('filtroForn')?.value.trim().toLowerCase() || '';
    const termoProduto = $('filtroProduto')?.value.trim().toLowerCase() || '';
    const tipo = $('filtroTipo')?.value || '';
    const dataDe = $('filtroDataDe')?.value || '';
    const dataAte = $('filtroDataAte')?.value || '';

    return State.perdas.filter(p => {
      // filtro fornecedor
      if (termo && !p.fornecedor.toLowerCase().includes(termo)) return false;

      // filtro produto (descrição ou código)
      if (termoProduto) {
        const descMatch = p.descricao.toLowerCase().includes(termoProduto);
        const codigoMatch = (p.codigo || '').toLowerCase().includes(termoProduto);
        if (!descMatch && !codigoMatch) return false;
      }

      // filtro tipo
      if (tipo && p.tipo !== tipo) return false;

      // filtro data range
      if (dataDe && p.data < dataDe) return false;
      if (dataAte && p.data > dataAte) return false;

      return true;
    });
  }

  function temFiltroAtivo() {
    const forn = $('filtroForn')?.value.trim() || '';
    const produto = $('filtroProduto')?.value.trim() || '';
    const tipo = $('filtroTipo')?.value || '';
    const dataDe = $('filtroDataDe')?.value || '';
    const dataAte = $('filtroDataAte')?.value || '';
    return forn !== '' || produto !== '' || tipo !== '' || dataDe !== '' || dataAte !== '';
  }

  function updateBtnLimpar(mostrar) {
    const btn = $('btnLimparFiltros');
    if (btn) btn.style.display = mostrar ? 'block' : 'none';
  }

  function limparFiltros() {
    if ($('filtroForn')) $('filtroForn').value = '';
    if ($('filtroProduto')) $('filtroProduto').value = '';
    if ($('filtroTipo')) $('filtroTipo').value = '';
    if ($('filtroDataDe')) $('filtroDataDe').value = '';
    if ($('filtroDataAte')) $('filtroDataAte').value = '';
    render();
  }

  /* ========== KEBAB MENU (3 PONTOS) - CORRIGIDO ========== */

  function closeKebab() {
    const menu = $('kebabMenu');
    if (menu) menu.classList.remove('open');
    kebabTargetId = null;
  }

  function openKebab(btn, id) {
    kebabTargetId = id;
    const menu = $('kebabMenu');
    if (!menu) return;

    const rect = btn.getBoundingClientRect();
    
    // Position: relative ao viewport
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.style.left = 'auto';
    menu.style.position = 'fixed';
    
    menu.classList.add('open');
  }

  function handleKebabClick(e) {
    e.stopPropagation();
    const btn = e.target.closest('.kebab-btn');
    if (!btn) return;
    
    const id = parseInt(btn.dataset.id);
    const menu = $('kebabMenu');
    
    // Se já está aberto e é o mesmo item, fecha
    if (kebabTargetId === id && menu && menu.classList.contains('open')) {
      closeKebab();
      return;
    }
    
    // Abre o menu deste item
    openKebab(btn, id);
  }

  function bindKebabButtons() {
    const wrap = $('relatorioGroups');
    if (!wrap) return;

    // Remove old listeners
    wrap.removeEventListener('click', handleKebabClick);
    
    // Add new listener (delegado)
    wrap.addEventListener('click', handleKebabClick);
  }

  /* ========== RENDER ========== */

  function render() {
    fillFiltroDatalist();
    const list = filtered();
    const empty = $('relatorioEmpty');
    const emptyFiltered = $('relatorioEmptyFiltered');
    const content = $('relatorioContent');

    if (!empty || !emptyFiltered || !content) return;

    // Sem nenhum registro no banco
    if (State.perdas.length === 0) {
      empty.style.display = 'block';
      emptyFiltered.style.display = 'none';
      content.style.display = 'none';
      updateBtnLimpar(false);
      return;
    }

    // Tem registros mas filtro retornou zero
    if (list.length === 0 && temFiltroAtivo()) {
      empty.style.display = 'none';
      emptyFiltered.style.display = 'block';
      content.style.display = 'none';
      updateBtnLimpar(true);
      return;
    }

    // Tem registros para mostrar
    empty.style.display = 'none';
    emptyFiltered.style.display = 'none';
    content.style.display = 'block';
    updateBtnLimpar(temFiltroAtivo());

    // Atualizar total
    const totalVal = $('relTotValor');
    if (totalVal) {
      totalVal.textContent = Utils.fmtBRL(list.reduce((s, p) => s + p.valorTotal, 0));
    }

    // Renderizar grupos
    const grupos = agruparPorFornecedor(list);
    const wrap = $('relatorioGroups');
    wrap.innerHTML = '';

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
        const descTruncada = truncarDescricao(p.descricao);
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td title="${Utils.escapeHtml(p.descricao)}">${Utils.escapeHtml(descTruncada)}</td>
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

    // Bind kebab buttons após render
    bindKebabButtons();
  }

  /* ========== MODAL EDIÇÃO ========== */

  function fillPerdaModalDatalist() {
    const dl = $('perdaModalFornDatalist');
    if (!dl) return;
    dl.innerHTML = '';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f;
      dl.appendChild(o);
    });
  }

  function openEditPerda(id) {
    const p = State.perdas.find(x => x.id === id);
    if (!p) return;

    editingPerdaId = id;
    fillPerdaModalDatalist();

    if ($('perdaModalForn')) $('perdaModalForn').value = p.fornecedor;
    if ($('perdaModalDesc')) $('perdaModalDesc').value = p.descricao;
    if ($('perdaModalCodigo')) $('perdaModalCodigo').value = p.codigo;
    if ($('perdaModalQtd')) $('perdaModalQtd').value = p.quantidade;
    if ($('perdaModalValidade')) $('perdaModalValidade').value = p.validade;
    if ($('perdaModalValor')) $('perdaModalValor').value = p.valorUnit;

    document.querySelectorAll('#perdaModal .toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tipo === p.tipo);
    });

    const modal = $('perdaModal');
    if (modal) modal.classList.add('open');
  }

  async function salvarEdicaoPerda() {
    const fornecedor = $('perdaModalForn')?.value.trim() || '';
    const descricao = $('perdaModalDesc')?.value.trim() || '';
    const codigo = $('perdaModalCodigo')?.value.trim() || '';
    const tipoBtn = document.querySelector('#perdaModal .toggle-btn.active');
    const tipo = tipoBtn ? tipoBtn.dataset.tipo : '';
    const quantidade = parseInt($('perdaModalQtd')?.value || 0);
    const validade = $('perdaModalValidade')?.value.trim() || '';
    const valorUnit = parseFloat($('perdaModalValor')?.value || 0);

    if (!fornecedor) { Utils.toast('Informe o fornecedor.', 'error'); return; }
    if (!descricao) { Utils.toast('Informe a descrição.', 'error'); return; }
    if (!tipo) { Utils.toast('Selecione Vencido ou Avariado.', 'error'); return; }
    if (!quantidade || quantidade < 1) { Utils.toast('Informe a quantidade.', 'error'); return; }
    if (!validade) { Utils.toast('Informe a validade.', 'error'); return; }
    if (isNaN(valorUnit) || valorUnit < 0) { Utils.toast('Informe o valor unitário.', 'error'); return; }

    try {
      await Api.atualizarPerda(editingPerdaId, {
        fornecedor,
        descricao,
        codigo,
        tipo,
        quantidade,
        validade,
        valorUnit
      });
      await State.reloadAll();
      const modal = $('perdaModal');
      if (modal) modal.classList.remove('open');
      render();
      Utils.toast('Registro atualizado.', 'success');
    } catch (e) {
      Utils.toast(e.message || 'Erro ao salvar.', 'error');
    }
  }

  /* ========== DELETE ========== */

  function apagarPerda(id) {
    pendingDeleteId = id;
    const modal = $('confirmDeleteModal');
    if (modal) modal.classList.add('open');
  }

  async function confirmarDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    pendingDeleteId = null;

    const modal = $('confirmDeleteModal');
    if (modal) modal.classList.remove('open');

    try {
      await Api.excluirPerda(id);
      await State.reloadPerdas();
      render();
      Utils.toast('Registro excluído.', 'success');
    } catch (e) {
      Utils.toast(e.message || 'Erro ao excluir.', 'error');
    }
  }

  function cancelarDelete() {
    pendingDeleteId = null;
    const modal = $('confirmDeleteModal');
    if (modal) modal.classList.remove('open');
  }

  /* ========== EXPORT ========== */

  async function exportXLSX() {
    const list = filtered();
    if (list.length === 0) {
      Utils.toast('Não há registros para exportar.', 'error');
      return;
    }

    const btn = $('btnExportXLSX');
    if (btn) btn.disabled = true;

    try {
      const blob = await Api.exportarXLSX(list);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio_perdas_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Utils.toast('Excel exportado com sucesso!', 'success');
    } catch (e) {
      Utils.toast(e.message || 'Erro ao gerar o Excel.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ========== BINDS (SEM DUPLICAÇÕES) ========== */

  function bind() {
    // Filtro fornecedor
    const filtroForn = $('filtroForn');
    if (filtroForn) {
      filtroForn.addEventListener('input', render);
    }

    // Filtro produto
    const filtroProduto = $('filtroProduto');
    if (filtroProduto) {
      filtroProduto.addEventListener('input', render);
    }

    // Filtro tipo
    const filtroTipo = $('filtroTipo');
    if (filtroTipo) {
      filtroTipo.addEventListener('change', render);
    }

    // Filtro data de
    const filtroDataDe = $('filtroDataDe');
    if (filtroDataDe) {
      filtroDataDe.addEventListener('change', render);
    }

    // Filtro data até
    const filtroDataAte = $('filtroDataAte');
    if (filtroDataAte) {
      filtroDataAte.addEventListener('change', render);
    }

    // Botão limpar filtros
    const btnLimparFiltros = $('btnLimparFiltros');
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', limparFiltros);
    }

    // Botão limpar filtros (empty state)
    const btnLimparFiltrosEmpty = $('btnLimparFiltrosEmpty');
    if (btnLimparFiltrosEmpty) {
      btnLimparFiltrosEmpty.addEventListener('click', limparFiltros);
    }

    // Botão export
    const btnExportXLSX = $('btnExportXLSX');
    if (btnExportXLSX) {
      btnExportXLSX.addEventListener('click', exportXLSX);
    }

    // ===== KEBAB MENU =====
    const kebabEdit = $('kebabEdit');
    if (kebabEdit) {
      kebabEdit.addEventListener('click', () => {
        const id = kebabTargetId;
        closeKebab();
        if (id) openEditPerda(id);
      });
    }

    const kebabDelete = $('kebabDelete');
    if (kebabDelete) {
      kebabDelete.addEventListener('click', () => {
        const id = kebabTargetId;
        closeKebab();
        if (id) apagarPerda(id);
      });
    }

    // Fechar kebab ao clicar fora
    document.addEventListener('click', (e) => {
      const menu = $('kebabMenu');
      if (menu && menu.classList.contains('open')) {
        if (!menu.contains(e.target)) {
          closeKebab();
        }
      }
    });

    // ===== MODAL EDIÇÃO =====
    const toggleBtns = document.querySelectorAll('#perdaModal .toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#perdaModal .toggle-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      });
    });

    const btnCancelPerda = $('btnCancelPerda');
    if (btnCancelPerda) {
      btnCancelPerda.addEventListener('click', () => {
        const modal = $('perdaModal');
        if (modal) modal.classList.remove('open');
      });
    }

    const btnSavePerda = $('btnSavePerda');
    if (btnSavePerda) {
      btnSavePerda.addEventListener('click', salvarEdicaoPerda);
    }

    // ===== MODAL CONFIRMAÇÃO DELETE =====
    const btnCancelDelete = $('btnCancelDelete');
    if (btnCancelDelete) {
      btnCancelDelete.addEventListener('click', cancelarDelete);
    }

    const btnConfirmDelete = $('btnConfirmDelete');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', confirmarDelete);
    }

    // Fechar modal ao clicar fora
    const confirmDeleteModal = $('confirmDeleteModal');
    if (confirmDeleteModal) {
      confirmDeleteModal.addEventListener('click', function (e) {
        if (e.target === this) cancelarDelete();
      });
    }
  }

  /* ========== SKELETON ========== */

  function showSkeleton() {
    const empty = $('relatorioEmpty');
    const content = $('relatorioContent');
    const totalVal = $('relTotValor');
    const wrap = $('relatorioGroups');

    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'block';

    if (totalVal) {
      totalVal.innerHTML = '<span class="skeleton skeleton-bar" style="width:100px;"></span>';
    }

    if (!wrap) return;

    wrap.innerHTML = '';
    for (let i = 0; i < 2; i++) {
      const card = document.createElement('div');
      card.className = 'panel report-card';
      const linhas = Array.from({ length: 3 })
        .map(
          () => `
        <div class="skeleton-row-line">
          <span class="skeleton skeleton-bar" style="width:34%;"></span>
          <span class="skeleton skeleton-bar" style="width:60px;"></span>
          <span class="skeleton skeleton-bar" style="width:30px;"></span>
          <span class="skeleton skeleton-bar" style="width:70px;"></span>
          <span class="skeleton skeleton-bar" style="width:70px;"></span>
        </div>`
        )
        .join('');
      card.innerHTML = `
        <div class="report-card-header">
          <span class="skeleton skeleton-bar" style="width:150px;"></span>
          <span class="skeleton skeleton-bar" style="width:70px;"></span>
        </div>
        ${linhas}`;
      wrap.appendChild(card);
    }
  }

  /* ========== INIT ========== */

  bind();

  return {
    refresh: render,
    showSkeleton: showSkeleton
  };
})();