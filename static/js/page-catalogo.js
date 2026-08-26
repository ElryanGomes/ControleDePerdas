/* ============================================================
   Página: Catálogo (fornecedores + produtos)
   ============================================================ */
const PageCatalogo = (function(){
  const $ = (id) => document.getElementById(id);
  let editingId = null; // id do produto sendo editado, ou null para "novo"

  function fillFiltro(){
    const sel = $('catFiltroForn');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos os fornecedores</option>';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f;
      sel.appendChild(o);
    });
    sel.value = cur;
  }

  function allRows(){
    const rows = [];
    State.fornecedoresList().forEach(f => {
      (State.catalogo[f] || []).forEach(p => rows.push(p));
    });
    return rows;
  }

  function render(){
    fillFiltro();
    const filtroForn = $('catFiltroForn').value;
    const termo = $('catBusca').value.trim().toLowerCase();
    const rows = allRows().filter(r =>
      (!filtroForn || r.fornecedor === filtroForn) &&
      (!termo ||
        (r.descricao || '').toLowerCase().includes(termo) ||
        (r.codigoBarra || '').toLowerCase().includes(termo))
    );
    const tbody = $('catalogoTbody');
    const empty = $('catalogoEmpty');
    const tableWrap = $('catalogoTableWrap');

    if(allRows().length === 0){
      empty.style.display = 'block';
      tableWrap.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    tableWrap.style.display = 'block';

    tbody.innerHTML = '';
    if(rows.length === 0){
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:24px;">Nenhum produto encontrado.</td></tr>';
      return;
    }
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${Utils.escapeHtml(r.fornecedor)}</td>
        <td class="mono">${r.codigoProduto || '—'}</td>
        <td class="mono">${r.codigoBarra || '—'}</td>
        <td>${Utils.escapeHtml(r.descricao)}</td>
        <td class="num">${Utils.fmtBRL(r.valorUnit)}</td>
        <td>
          <div class="row-actions">
            <span class="act-edit" data-id="${r.id}">editar</span>
            <span class="act-del" data-id="${r.id}">excluir</span>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.act-edit').forEach(el => {
      el.addEventListener('click', function(){ openEdit(parseInt(this.dataset.id)); });
    });
    tbody.querySelectorAll('.act-del').forEach(el => {
      el.addEventListener('click', async function(){
        try{
          await Api.excluirProduto(parseInt(this.dataset.id));
          await State.reloadCatalogo();
          render();
          Utils.toast('Produto excluído.', 'success');
        }catch(e){
          Utils.toast(e.message || 'Erro ao excluir.', 'error');
        }
      });
    });
  }

  /* ---------- novo fornecedor (modal compartilhado) ---------- */
  function bindFornModal(){
    $('btnNovoFornecedor').addEventListener('click', () => {
      FornecedorModal.open(() => render());
    });
  }

  /* ---------- modal: produto (novo / editar) ---------- */
  function fillProdutoFornSelect(selected){
    const sel = $('prodModalForn');
    sel.innerHTML = '';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f;
      if(f === selected) o.selected = true;
      sel.appendChild(o);
    });
  }

  function openNew(){
    if(State.fornecedoresList().length === 0){
      Utils.toast('Cadastre um fornecedor primeiro.', 'error');
      return;
    }
    editingId = null;
    $('prodModalTitle').textContent = 'Novo produto';
    fillProdutoFornSelect($('catFiltroForn').value || State.fornecedoresList()[0]);
    $('prodModalCodProd').value = '';
    $('prodModalCodBarra').value = '';
    $('prodModalDesc').value = '';
    $('prodModalValor').value = '';
    $('btnDeleteProd').style.display = 'none';
    $('produtoModal').classList.add('open');
  }

  function openEdit(id){
    const p = State.produtoPorId(id);
    if(!p) return;
    editingId = id;
    $('prodModalTitle').textContent = 'Editar produto';
    fillProdutoFornSelect(p.fornecedor);
    $('prodModalCodProd').value = p.codigoProduto || '';
    $('prodModalCodBarra').value = p.codigoBarra || '';
    $('prodModalDesc').value = p.descricao || '';
    $('prodModalValor').value = p.valorUnit;
    $('btnDeleteProd').style.display = 'inline-flex';
    $('produtoModal').classList.add('open');
  }

  function bindProdutoModal(){
    $('btnNovoProduto').addEventListener('click', openNew);
    $('btnCancelProd').addEventListener('click', () => $('produtoModal').classList.remove('open'));

    $('btnSaveProd').addEventListener('click', async () => {
      const fornecedor = $('prodModalForn').value;
      const descricao = $('prodModalDesc').value.trim();
      const valorUnit = parseFloat($('prodModalValor').value);
      if(!descricao){ Utils.toast('Descrição não pode ficar vazia.', 'error'); return; }
      if(isNaN(valorUnit) || valorUnit < 0){ Utils.toast('Informe o preço de compra.', 'error'); return; }

      const produto = {
        fornecedor,
        codigoProduto: $('prodModalCodProd').value.trim(),
        codigoBarra: $('prodModalCodBarra').value.trim(),
        descricao, valorUnit
      };

      try{
        if(editingId){
          await Api.atualizarProduto(editingId, produto);
        } else {
          await Api.upsertProduto(produto);
        }
        await State.reloadCatalogo();
        $('produtoModal').classList.remove('open');
        render();
        Utils.toast(editingId ? 'Produto atualizado.' : 'Produto adicionado.', 'success');
      }catch(e){
        Utils.toast(e.message || 'Erro ao salvar produto.', 'error');
      }
    });

    $('btnDeleteProd').addEventListener('click', async () => {
      if(!editingId) return;
      try{
        await Api.excluirProduto(editingId);
        await State.reloadCatalogo();
        $('produtoModal').classList.remove('open');
        render();
        Utils.toast('Produto excluído.', 'success');
      }catch(e){
        Utils.toast(e.message || 'Erro ao excluir.', 'error');
      }
    });
  }

  function bind(){
    $('catFiltroForn').addEventListener('change', render);
    $('catBusca').addEventListener('input', render);
    bindFornModal();
    bindProdutoModal();
  }

  /* ---------- skeleton (enquanto aguarda o backend) ---------- */
  function showSkeleton(){
    $('catalogoEmpty').style.display = 'none';
    $('catalogoTableWrap').style.display = 'block';
    const tbody = $('catalogoTbody');
    tbody.innerHTML = '';
    for(let i = 0; i < 6; i++){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="skeleton skeleton-bar" style="width:75%;"></span></td>
        <td><span class="skeleton skeleton-bar" style="width:50%;"></span></td>
        <td><span class="skeleton skeleton-bar" style="width:65%;"></span></td>
        <td><span class="skeleton skeleton-bar" style="width:85%;"></span></td>
        <td class="num"><span class="skeleton skeleton-bar" style="width:60px; margin-left:auto;"></span></td>
        <td></td>`;
      tbody.appendChild(tr);
    }
  }

  bind();
  return { refresh: render, showSkeleton };
})();
