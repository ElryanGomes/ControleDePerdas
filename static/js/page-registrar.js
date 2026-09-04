/* ============================================================
   Página: Registrar perda
   Fluxo principal: ler o código de barras primeiro. A partir
   dele o sistema já traz fornecedor, código do produto,
   descrição e preço — o usuário só confere e ajusta o que
   mudou. Se o código não estiver cadastrado, abre o card de
   fornecedor para escolher/cadastrar e preencher os dados manualmente.
   ============================================================ */
const PageRegistrar = (function(){
  const $ = (id) => document.getElementById(id);
  let tipoAtual = null;
  const tocados = new Set(); // campos que o usuário já "visitou" (blur) — evita mostrar erro antes da hora

  /* ---------- fornecedores mais usados (para os balões de acesso rápido) ---------- */
  function fornecedoresMaisUsados(limit = 6){
    const perdaCount = {};
    State.perdas.forEach(p => { perdaCount[p.fornecedor] = (perdaCount[p.fornecedor] || 0) + 1; });
    return State.fornecedoresList()
      .map(f => ({ nome: f, score: (perdaCount[f] || 0) * 10 + (State.catalogo[f] || []).length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.nome);
  }

  function renderFornChipsFrequentes(){
    const wrap = $('fornChipsFrequentes');
    wrap.innerHTML = '';
    const freq = fornecedoresMaisUsados();
    if(freq.length === 0){
      wrap.innerHTML = '<span style="font-size:12px;color:var(--text-faint);">Nenhum fornecedor cadastrado ainda — use o botão abaixo.</span>';
      return;
    }
    freq.forEach(f => {
      const c = document.createElement('div');
      c.className = 'chip' + (f === State.fornecedorAtual ? ' active' : '');
      c.textContent = f;
      c.addEventListener('click', () => escolherFornecedor(f));
      wrap.appendChild(c);
    });
  }

  function renderFornDatalist(){
    const dl = $('fornecedoresDatalist');
    dl.innerHTML = '';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f;
      dl.appendChild(o);
    });
  }

  /* ---------- busca fuzzy (tolerante a erro de digitação/acento) ---------- */
  function renderSugestoesFuzzy(){
    const query = $('fornecedorInput').value;
    const wrap = $('fornecedorSugestoes');
    const nomes = FuzzySearch.buscar(query, State.fornecedoresList(), 6);

    if(nomes.length === 0){
      wrap.classList.remove('open');
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = nomes.map(nome =>
      `<div class="fuzzy-suggestion-item" data-nome="${Utils.escapeHtml(nome)}">${Utils.escapeHtml(nome)}</div>`
    ).join('');
    wrap.classList.add('open');

    wrap.querySelectorAll('.fuzzy-suggestion-item').forEach(el => {
      // mousedown (não click) + preventDefault: garante que o item seja escolhido
      // antes do input perder o foco e a lista fechar
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        escolherFornecedor(el.dataset.nome);
        wrap.classList.remove('open');
        wrap.innerHTML = '';
      });
    });
  }

  function esconderSugestoesFuzzy(){
    $('fornecedorSugestoes').classList.remove('open');
  }

  function showFornecedorCard(show){
    $('fornecedorCard').style.display = show ? 'block' : 'none';
    if(show){ renderFornChipsFrequentes(); renderFornDatalist(); }
  }

  /* ---------- seleção de fornecedor (via balão, datalist ou modal) ---------- */
  function escolherFornecedor(nome){
    State.fornecedorAtual = nome;
    $('fornecedorInput').value = nome;
    esconderSugestoesFuzzy();
    showFornecedorCard(false);
    setProdutoCardEnabled(true);
    updateFornecedorLine();
    checkProdutoReady();
  }

  function updateFornecedorLine(){
    const line = $('produtoFornLine');
    if(State.fornecedorAtual){
      line.style.display = 'flex';
      $('produtoFornNome').textContent = State.fornecedorAtual;
    } else {
      line.style.display = 'none';
    }
  }

  function setProdutoCardEnabled(on){
    $('produtoCard').classList.toggle('disabled-block', !on);
    if(!on) $('perdaCard').classList.add('disabled-block');
  }

  function checkProdutoReady(){
    const desc = $('descInput').value.trim();
    const vu = $('valorUnitInput').value;
    const ready = !!desc && vu !== '' && !!State.fornecedorAtual;
    $('perdaCard').classList.toggle('disabled-block', !ready);
    updatePreview();
  }

  /* ---------- leitura do código de barras — ação principal ---------- */
  function lookupBarcode(){
    const barcode = $('barcodeInput').value.trim();
    const hint = $('scanStatusHint');

    if(!barcode){
      hint.textContent = 'Aponte a câmera ou digite o código de barras do produto.';
      hint.className = 'lookup-hint';
      return;
    }

    // procura o código de barras em TODOS os fornecedores do catálogo
    let achado = null, fornecedorAchado = '';
    for(const f of State.fornecedoresList()){
      const p = (State.catalogo[f] || []).find(x => x.codigoBarra && x.codigoBarra === barcode);
      if(p){ achado = p; fornecedorAchado = f; break; }
    }

    if(achado){
      Scanner.feedbackSucesso();

      State.fornecedorAtual = fornecedorAchado;
      $('fornecedorInput').value = fornecedorAchado;
      $('codigoProdutoInput').value = achado.codigoProduto || '';
      $('descInput').value = achado.descricao;
      $('valorUnitInput').value = achado.valorUnit;
      $('salvarCatalogo').checked = false;

      hint.textContent = '✓ Produto encontrado — confira os dados abaixo antes de registrar';
      hint.className = 'lookup-hint found';

      showFornecedorCard(false);
      setProdutoCardEnabled(true);
      updateFornecedorLine();
    } else {
      State.fornecedorAtual = '';
      $('fornecedorInput').value = '';
      $('codigoProdutoInput').value = '';
      $('descInput').value = '';
      $('valorUnitInput').value = '';
      $('salvarCatalogo').checked = true;

      hint.textContent = 'Código novo — selecione o fornecedor e preencha os dados do produto';
      hint.className = 'lookup-hint new';

      showFornecedorCard(true);
      setProdutoCardEnabled(false);
      updateFornecedorLine();
    }
    checkProdutoReady();
  }

  function updatePreview(){
    const qtd = parseFloat($('qtdInput').value) || 0;
    const vu = parseFloat($('valorUnitInput').value) || 0;
    $('totalPreview').textContent = Utils.fmtBRL(qtd * vu);

    $('prevFornecedor').textContent = State.fornecedorAtual || '—';
    $('prevDescricao').textContent = $('descInput').value.trim() || '—';
    $('prevCodigo').textContent = $('codigoProdutoInput').value.trim() || '—';
    $('prevTipo').textContent = tipoAtual || '—';
    $('prevQtd').textContent = qtd || '—';
    $('prevValidade').textContent = $('ilegivelCheck').checked ? 'ILEGÍVEL' : Utils.formatValidade($('validadeInput').value);

    revalidarForm();
  }

  /* ---------- validação preditiva (espelha as regras do backend) ---------- */
  function marcarInvalido(el, invalido){
    if(!el) return;
    el.classList.toggle('input-invalid', !!invalido);
  }

  function revalidarForm(){
    const desc = $('descInput').value.trim();
    const valorUnitStr = $('valorUnitInput').value;
    const valorUnit = parseFloat(valorUnitStr);
    const qtdStr = $('qtdInput').value;
    const qtd = parseInt(qtdStr, 10);
    const ilegivel = $('ilegivelCheck').checked;
    const validadeStr = $('validadeInput').value;

    const erroFornecedor = !State.fornecedorAtual;
    const erroDesc = !desc;
    const erroValorUnit = valorUnitStr === '' || isNaN(valorUnit) || valorUnit < 0;
    const erroQtd = qtdStr === '' || isNaN(qtd) || qtd < 1;
    const erroValidade = !ilegivel && !validadeStr;
    const erroTipo = !tipoAtual;

    // borda vermelha: só depois que o usuário "visitou" o campo (blur),
    // ou imediatamente se ele já digitou algo e ficou inválido (ex: valor negativo)
    marcarInvalido($('descInput'), erroDesc && tocados.has('desc'));
    marcarInvalido($('valorUnitInput'), erroValorUnit && (tocados.has('valorUnit') || valorUnitStr !== ''));
    marcarInvalido($('qtdInput'), erroQtd && (tocados.has('qtd') || qtdStr !== ''));
    marcarInvalido($('validadeInput'), erroValidade && tocados.has('validade'));

    const hintTipo = $('tipoErrorHint');
    if(hintTipo) hintTipo.style.display = (erroTipo && tocados.has('tipo')) ? 'block' : 'none';

    const valido = !(erroFornecedor || erroDesc || erroValorUnit || erroQtd || erroValidade || erroTipo);
    $('btnSalvarPerda').disabled = !valido;
    return valido;
  }

  function resetForm(){
    $('barcodeInput').value = '';
    $('codigoProdutoInput').value = '';
    $('descInput').value = '';
    $('valorUnitInput').value = '';
    $('qtdInput').value = '1';
    $('validadeInput').value = '';
    $('validadeInput').disabled = false;
    $('ilegivelCheck').checked = false;
    $('salvarCatalogo').checked = true;
    $('fornecedorInput').value = '';

    document.querySelectorAll('#page-registrar .toggle-btn').forEach(b => b.classList.remove('active'));
    tipoAtual = null;
    State.fornecedorAtual = '';

    tocados.clear();
    ['descInput', 'valorUnitInput', 'qtdInput', 'validadeInput'].forEach(id => marcarInvalido($(id), false));
    const hintTipo = $('tipoErrorHint');
    if(hintTipo) hintTipo.style.display = 'none';
    $('btnSalvarPerda').disabled = true;

    $('scanStatusHint').textContent = 'Aponte a câmera ou digite o código de barras do produto.';
    $('scanStatusHint').className = 'lookup-hint';
    showFornecedorCard(false);
    setProdutoCardEnabled(false);
    updateFornecedorLine();
    updatePreview();
    $('barcodeInput').focus();
  }

  async function salvarPerda(){
    if(!State.fornecedorAtual){ Utils.toast('Selecione um fornecedor.', 'error'); return; }
    const barcode = $('barcodeInput').value.trim();
    const codigoProduto = $('codigoProdutoInput').value.trim();
    const descricao = $('descInput').value.trim();
    const valorUnit = parseFloat($('valorUnitInput').value);
    const qtd = parseInt($('qtdInput').value);
    const ilegivel = $('ilegivelCheck').checked;
    const validadeInput = $('validadeInput').value;
    const validade = ilegivel ? 'ILEGÍVEL' : (validadeInput ? Utils.formatValidade(validadeInput) : '');

    if(!descricao){ Utils.toast('Informe a descrição do produto.', 'error'); return; }
    if(!tipoAtual){ Utils.toast('Selecione Vencido ou Avariado.', 'error'); return; }
    if(!qtd || qtd < 1){ Utils.toast('Informe a quantidade.', 'error'); return; }
    if(isNaN(valorUnit) || valorUnit < 0){ Utils.toast('Informe o preço de compra.', 'error'); return; }
    if(!validade){ Utils.toast("Informe a validade ou marque 'ilegível'.", 'error'); return; }

    const btn = $('btnSalvarPerda');
    btn.disabled = true;
    try{
      if($('salvarCatalogo').checked){
        await Api.upsertProduto({
          fornecedor: State.fornecedorAtual, codigoBarra: barcode,
          codigoProduto, descricao, valorUnit
        });
      }
      await Api.criarPerda({
        fornecedor: State.fornecedorAtual, descricao, codigo: codigoProduto,
        tipo: tipoAtual, quantidade: qtd, validade, valorUnit
      });
      await State.reloadAll();

      Utils.toast('Perda registrada com sucesso!', 'success');
      resetForm();
    }catch(e){
      Utils.toast(e.message || 'Erro ao registrar a perda.', 'error');
    }finally{
      btn.disabled = false;
    }
  }

  function bind(){
    // leitura do código de barras
    $('barcodeInput').addEventListener('input', lookupBarcode);
    $('btnScan').addEventListener('click', () => {
      Scanner.open((text) => {
        $('barcodeInput').value = text;
        lookupBarcode();
      });
    });
    $('linkManualForn').addEventListener('click', (e) => {
      e.preventDefault();
      showFornecedorCard(true);
      $('fornecedorInput').focus();
    });

    // fornecedor
    $('fornecedorInput').addEventListener('input', renderSugestoesFuzzy);
    $('fornecedorInput').addEventListener('focus', renderSugestoesFuzzy);
    $('fornecedorInput').addEventListener('blur', () => setTimeout(esconderSugestoesFuzzy, 120));
    $('fornecedorInput').addEventListener('change', function(){
      const nome = this.value.trim();
      if(nome) escolherFornecedor(nome);
    });
    $('btnAddFornRegistrar').addEventListener('click', () => {
      FornecedorModal.open((nome) => escolherFornecedor(nome));
    });
    $('btnTrocarForn').addEventListener('click', () => {
      showFornecedorCard(true);
      $('fornecedorInput').value = State.fornecedorAtual;
      $('fornecedorInput').focus();
    });

    // produto
    $('codigoProdutoInput').addEventListener('input', updatePreview);
    $('descInput').addEventListener('input', checkProdutoReady);
    $('descInput').addEventListener('blur', () => { tocados.add('desc'); revalidarForm(); });
    $('valorUnitInput').addEventListener('input', checkProdutoReady);
    $('valorUnitInput').addEventListener('blur', () => { tocados.add('valorUnit'); revalidarForm(); });

    // detalhes da perda
    $('qtdInput').addEventListener('input', updatePreview);
    $('qtdInput').addEventListener('blur', () => { tocados.add('qtd'); tocados.add('tipo'); revalidarForm(); });
    $('validadeInput').addEventListener('input', updatePreview);
    $('validadeInput').addEventListener('blur', () => { tocados.add('validade'); tocados.add('tipo'); revalidarForm(); });

    document.querySelectorAll('#page-registrar .toggle-btn').forEach(btn => {
      btn.addEventListener('click', function(){
        document.querySelectorAll('#page-registrar .toggle-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        tipoAtual = this.dataset.tipo;
        updatePreview();
      });
    });

    $('ilegivelCheck').addEventListener('change', function(){
      $('validadeInput').disabled = this.checked;
      if(this.checked) $('validadeInput').value = '';
      updatePreview();
    });

    $('btnSalvarPerda').addEventListener('click', salvarPerda);
  }

  function refresh(){
    resetForm();
  }

  bind();
  return { refresh };
})();
