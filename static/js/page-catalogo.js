/* ============================================================
   Página: Catálogo
   Duas abas:
     • Produtos     — lista, busca, filtro, novo / editar / excluir
     • Fornecedores — lista, busca, novo / renomear / excluir
   Depende de: Utils, Api, State, FornecedorModal, ConfirmModal
   ============================================================ */
const PageCatalogo = (function(){
  const $ = (id) => document.getElementById(id);
  const esc = (s) => Utils.escapeHtml(s == null ? '' : s);

  let editingId = null;      // id do produto em edição (null = novo)
  let tabAtiva = 'produtos'; // 'produtos' | 'fornecedores'

  const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
  const ICON_DEL  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

  /* ---------- helpers ---------- */
  const norm = (s) => String(s == null ? '' : s).toLowerCase();

  function plural(n, um, varios){ return n + ' ' + (n === 1 ? um : varios); }

  function parsePreco(txt){
    let s = String(txt == null ? '' : txt).trim().replace(/\s/g, '');
    if(!s) return NaN;
    if(s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
    return Number(s);
  }

  function precoParaInput(v){
    const n = Number(v);
    return isNaN(n) ? '' : n.toFixed(2).replace('.', ',');
  }

  // desabilita o botão enquanto a chamada à API roda (evita duplo clique)
  async function comBotaoOcupado(btn, fn){
    if(btn.disabled) return;
    btn.disabled = true;
    try{ await fn(); } finally { btn.disabled = false; }
  }

  function allRows(){
    const rows = [];
    State.fornecedoresList().forEach(f => {
      (State.catalogo[f] || [])
        .slice()
        .sort((a, b) => norm(a.descricao).localeCompare(norm(b.descricao), 'pt-BR'))
        .forEach(p => rows.push(p));
    });
    return rows;
  }

  function qtdProdutos(fornecedor){
    return (State.catalogo[fornecedor] || []).length;
  }

  /* ============================================================
     ABAS
     ============================================================ */
  function setTab(tab){
    tabAtiva = tab;
    document.querySelectorAll('#page-catalogo .cat-tab').forEach(b => {
      const ativa = b.dataset.tab === tab;
      b.classList.toggle('active', ativa);
      b.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
    $('catPanelProdutos').hidden = tab !== 'produtos';
    $('catPanelFornecedores').hidden = tab !== 'fornecedores';
  }

  /* ============================================================
     ABA PRODUTOS
     ============================================================ */
  function fillFiltro(){
    const sel = $('catFiltroForn');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos os fornecedores</option>';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f;
      sel.appendChild(o);
    });
    sel.value = cur; // se o fornecedor não existe mais, volta para "Todos"
  }

  function renderProdutos(){
    fillFiltro();

    const todos = allRows();
    const filtroForn = $('catFiltroForn').value;
    const termo = norm($('catBusca').value.trim());

    const rows = todos.filter(r =>
      (!filtroForn || r.fornecedor === filtroForn) &&
      (!termo ||
        norm(r.descricao).includes(termo) ||
        norm(r.codigoBarra).includes(termo) ||
        norm(r.codigoProduto).includes(termo))
    );

    const empty = $('catalogoEmpty');
    const wrap = $('catalogoTableWrap');
    const resumo = $('catResumo');
    const temFornecedor = State.fornecedoresList().length > 0;

    // catálogo vazio (sem nenhum produto)
    if(todos.length === 0){
      resumo.textContent = '';
      wrap.style.display = 'none';
      empty.style.display = 'flex';
      $('catalogoEmptyTitulo').textContent = temFornecedor ? 'Nenhum produto cadastrado' : 'Nenhum fornecedor cadastrado';
      $('catalogoEmptyHint').textContent = temFornecedor
        ? 'Clique em “Novo produto” para adicionar o primeiro.'
        : 'Cadastre um fornecedor na aba Fornecedores e depois adicione os produtos dele.';
      return;
    }

    empty.style.display = 'none';
    wrap.style.display = 'block';

    resumo.textContent = rows.length === todos.length
      ? plural(todos.length, 'produto', 'produtos')
      : 'Mostrando ' + rows.length + ' de ' + plural(todos.length, 'produto', 'produtos');

    const tbody = $('catalogoTbody');
    if(rows.length === 0){
      tbody.innerHTML = '<tr><td class="cat-empty-row" colspan="6">Nenhum produto encontrado para esse filtro.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td data-label="Fornecedor"><span class="cat-forn-tag" title="${esc(r.fornecedor)}">${esc(r.fornecedor)}</span></td>
        <td data-label="Cód. produto" class="mono">${r.codigoProduto ? esc(r.codigoProduto) : '<span class="cat-muted">—</span>'}</td>
        <td data-label="Cód. de barras" class="mono">${r.codigoBarra ? esc(r.codigoBarra) : '<span class="cat-muted">—</span>'}</td>
        <td data-label="Descrição" class="cat-desc">${esc(r.descricao)}</td>
        <td data-label="Preço" class="num cat-valor">${Utils.fmtBRL(r.valorUnit)}</td>
        <td class="cat-actions-cell">
          <div class="cat-actions">
            <button type="button" class="cat-act" data-act="edit-prod" data-id="${esc(r.id)}">${ICON_EDIT}Editar</button>
            <button type="button" class="cat-act danger" data-act="del-prod" data-id="${esc(r.id)}">${ICON_DEL}Apagar</button>
          </div>
        </td>
      </tr>`).join('');
  }

  async function excluirProduto(id){
    const p = State.produtoPorId(id);
    if(!p) return false;
    const ok = await ConfirmModal.ask({
      titulo: 'Apagar produto?',
      mensagem: 'Tem certeza que quer apagar <strong>' + esc(p.descricao) + '</strong> do catálogo? Essa ação <strong>não pode ser desfeita</strong>.',
      confirmar: 'Apagar produto',
      perigo: true
    });
    if(!ok) return false;
    try{
      await Api.excluirProduto(id);
      await State.reloadCatalogo();
      render();
      Utils.toast('Produto apagado.', 'success');
      return true;
    }catch(e){
      Utils.toast(e.message || 'Erro ao apagar o produto.', 'error');
      return false;
    }
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

  function openNewProduto(){
    if(State.fornecedoresList().length === 0){
      Utils.toast('Cadastre um fornecedor primeiro.', 'error');
      setTab('fornecedores');
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
    $('prodModalDesc').focus();
  }

  function openEditProduto(id){
    const p = State.produtoPorId(id);
    if(!p) return;
    editingId = id;
    $('prodModalTitle').textContent = 'Editar produto';
    fillProdutoFornSelect(p.fornecedor);
    $('prodModalCodProd').value = p.codigoProduto || '';
    $('prodModalCodBarra').value = p.codigoBarra || '';
    $('prodModalDesc').value = p.descricao || '';
    $('prodModalValor').value = precoParaInput(p.valorUnit);
    $('btnDeleteProd').style.display = 'inline-flex';
    $('produtoModal').classList.add('open');
  }

  function closeProdutoModal(){
    $('produtoModal').classList.remove('open');
  }

  async function salvarProduto(){
    const fornecedor = $('prodModalForn').value;
    const descricao = $('prodModalDesc').value.trim();
    const valorUnit = parsePreco($('prodModalValor').value);

    if(!fornecedor){ Utils.toast('Escolha o fornecedor.', 'error'); return; }
    if(!descricao){ Utils.toast('Descrição não pode ficar vazia.', 'error'); return; }
    if(isNaN(valorUnit) || valorUnit < 0){ Utils.toast('Informe o preço de compra.', 'error'); return; }

    const produto = {
      fornecedor,
      codigoProduto: $('prodModalCodProd').value.trim(),
      codigoBarra: $('prodModalCodBarra').value.trim(),
      descricao,
      valorUnit
    };
    const eraEdicao = editingId !== null;

    try{
      if(eraEdicao) await Api.atualizarProduto(editingId, produto);
      else await Api.upsertProduto(produto);
      await State.reloadCatalogo();
      closeProdutoModal();
      render();
      Utils.toast(eraEdicao ? 'Produto atualizado.' : 'Produto adicionado.', 'success');
    }catch(e){
      Utils.toast(e.message || 'Erro ao salvar produto.', 'error');
    }
  }

  function bindProdutos(){
    $('catFiltroForn').addEventListener('change', renderProdutos);
    $('catBusca').addEventListener('input', renderProdutos);
    $('btnNovoProduto').addEventListener('click', openNewProduto);

    // um único listener na tabela (não acumula a cada render)
    $('catalogoTbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if(!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      if(btn.dataset.act === 'edit-prod') openEditProduto(id);
      else if(btn.dataset.act === 'del-prod') excluirProduto(id);
    });

    $('btnCancelProd').addEventListener('click', closeProdutoModal);
    $('btnSaveProd').addEventListener('click', (e) => comBotaoOcupado(e.currentTarget, salvarProduto));
    $('btnDeleteProd').addEventListener('click', async () => {
      if(editingId === null) return;
      const apagou = await excluirProduto(editingId);
      if(apagou) closeProdutoModal();
    });
  }

  /* ============================================================
     ABA FORNECEDORES
     ============================================================ */
  function renderFornecedores(){
    const todos = State.fornecedoresList();
    const termo = norm($('catBuscaForn').value.trim());
    const lista = todos.filter(f => !termo || norm(f).includes(termo));

    const empty = $('fornecedoresEmpty');
    const wrap = $('fornecedoresTableWrap');

    if(todos.length === 0){
      wrap.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    wrap.style.display = 'block';

    const tbody = $('fornecedoresTbody');
    if(lista.length === 0){
      tbody.innerHTML = '<tr><td class="cat-empty-row" colspan="3">Nenhum fornecedor encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = lista.map(f => {
      const n = qtdProdutos(f);
      const bloqueado = n > 0;
      return `
      <tr>
        <td data-label="Fornecedor" class="cat-forn-nome">${esc(f)}</td>
        <td data-label="Produtos" class="num"><span class="cat-count-badge${n === 0 ? ' zero' : ''}">${n}</span></td>
        <td class="cat-actions-cell">
          <div class="cat-actions">
            <button type="button" class="cat-act" data-act="edit-forn" data-nome="${esc(f)}">${ICON_EDIT}Editar</button>
            <button type="button" class="cat-act danger${bloqueado ? ' is-blocked' : ''}" data-act="del-forn" data-nome="${esc(f)}"
              ${bloqueado ? 'title="Só dá para apagar fornecedor sem produtos"' : ''}>${ICON_DEL}Apagar</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  async function excluirFornecedor(nome){
    const n = qtdProdutos(nome);
    if(n > 0){
      Utils.toast('“' + nome + '” tem ' + plural(n, 'produto', 'produtos') + '. Apague ou mude esses produtos antes.', 'error');
      return;
    }
    const ok = await ConfirmModal.ask({
      titulo: 'Apagar fornecedor?',
      mensagem: 'Tem certeza que quer apagar <strong>' + esc(nome) + '</strong>? Essa ação <strong>não pode ser desfeita</strong>.',
      confirmar: 'Apagar fornecedor',
      perigo: true
    });
    if(!ok) return;
    try{
      await Api.excluirFornecedor(nome);
      await State.reloadCatalogo();
      render();
      Utils.toast('Fornecedor apagado.', 'success');
    }catch(e){
      Utils.toast(e.message || 'Erro ao apagar o fornecedor.', 'error');
    }
  }

  function bindFornecedores(){
    $('catBuscaForn').addEventListener('input', renderFornecedores);

    $('btnNovoFornecedor').addEventListener('click', () => {
      FornecedorModal.open(() => render());
    });

    $('fornecedoresTbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if(!btn) return;
      const nome = btn.dataset.nome;
      if(btn.dataset.act === 'edit-forn') FornecedorModal.openEdit(nome, () => render());
      else if(btn.dataset.act === 'del-forn') excluirFornecedor(nome);
    });
  }

  /* ============================================================
     RENDER GERAL
     ============================================================ */
  function render(){
    $('catCountProdutos').textContent = allRows().length;
    $('catCountForn').textContent = State.fornecedoresList().length;
    renderProdutos();
    renderFornecedores();
  }

  /* ---------- skeleton (enquanto aguarda o backend) ---------- */
  function showSkeleton(){
    $('catalogoEmpty').style.display = 'none';
    $('catalogoTableWrap').style.display = 'block';
    $('catResumo').textContent = '';
    const bar = (w, extra) => `<span class="cat-skel-bar" style="width:${w};${extra || ''}"></span>`;
    let html = '';
    for(let i = 0; i < 6; i++){
      html += `<tr>
        <td>${bar('75%')}</td>
        <td>${bar('50%')}</td>
        <td>${bar('65%')}</td>
        <td>${bar('85%')}</td>
        <td>${bar('60px', 'margin-left:auto;')}</td>
        <td></td>
      </tr>`;
    }
    $('catalogoTbody').innerHTML = html;
  }

  function bind(){
    document.querySelectorAll('#page-catalogo .cat-tab').forEach(b => {
      b.addEventListener('click', () => setTab(b.dataset.tab));
    });
    bindProdutos();
    bindFornecedores();
  }

  bind();
  return { refresh: render, showSkeleton };
})();