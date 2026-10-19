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

  /* ---------- fornecedores mais usados (para os balões de acesso rápido) ---------- */
  function fornecedoresMaisUsados(limit = 6){
    const perdaCount = State.usoFornecedores || {}; // nº de perdas por fornecedor (todos os meses)
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

  function showFornecedorCard(show){
    $('fornecedorCard').style.display = show ? 'block' : 'none';
    if(show){ renderFornChipsFrequentes(); renderFornDatalist(); }
  }

  /* ---------- seleção de fornecedor (via balão, datalist ou modal) ---------- */
  function escolherFornecedor(nome){
    State.fornecedorAtual = nome;
    $('fornecedorInput').value = nome;
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
      checkProdutoReady();
    } else {
      State.fornecedorAtual = '';
      updateFornecedorLine();
      $('fornecedorInput').value = '';
      $('codigoProdutoInput').value = '';
      $('descInput').value = '';
      $('valorUnitInput').value = '';
      $('salvarCatalogo').checked = true;

      hint.textContent = 'Código novo — selecione o fornecedor e preencha os dados do produto';
      hint.className = 'lookup-hint new';

      setProdutoCardEnabled(false);
      showFornecedorCard(true);
      checkProdutoReady();
    }
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

    $('scanStatusHint').textContent = 'Aponte a câmera ou digite o código de barras do produto.';
    $('scanStatusHint').className = 'lookup-hint';
    showFornecedorCard(false);
    setProdutoCardEnabled(false);
    updateFornecedorLine();
    updatePreview();
    $('barcodeInput').focus();
  }

  function resetFornecedor(){
    // reseta só o fornecedor, mantém produto e perda
    State.fornecedorAtual = '';
    $('fornecedorInput').value = '';
    updateFornecedorLine();
    showFornecedorCard(true);
    $('fornecedorInput').focus();
  }

  async function salvarPerda(){
    if(!State.fornecedorAtual){ Utils.toast('Selecione um fornecedor.', 'error'); return; }
    const barcode = $('barcodeInput').value.trim();
    const codigoProduto = $('codigoProdutoInput').value.trim();
    const descricao = $('descInput').value.trim();
    const valorUnitRaw = $('valorUnitInput').value.trim().replace(',', '.'); // aceita vírgula ou ponto
    const valorUnit = parseFloat(valorUnitRaw);
    const qtd = parseInt($('qtdInput').value);
    const ilegivel = $('ilegivelCheck').checked;
    const validadeInput = $('validadeInput').value;
    const validade = ilegivel ? 'ILEGÍVEL' : (validadeInput ? Utils.formatValidade(validadeInput) : '');

    if(!barcode){ Utils.toast('Escaneie ou digite o código de barras.', 'error'); return; }
    if(!descricao){ Utils.toast('Informe a descrição do produto.', 'error'); return; }
    if(!tipoAtual){ Utils.toast('Selecione Vencido ou Avariado.', 'error'); return; }
    if(!qtd || qtd < 1){ Utils.toast('Informe a quantidade (mínimo 1).', 'error'); return; }
    if(isNaN(valorUnit) || valorUnit <= 0){ Utils.toast('Informe o preço de compra (maior que zero).', 'error'); return; }
    if(!validade){ Utils.toast("Informe a validade ou marque 'ilegível'.", 'error'); return; }

    const btn = $('btnSalvarPerda');
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');
    btn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-flex';
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
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
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

    // desabilitar scroll wheel em inputs number
    [$('qtdInput'), $('valorUnitInput')].forEach(input => {
      input.addEventListener('wheel', (e) => {
        e.preventDefault();
      }, { passive: false });
    });

    // fornecedor
    $('fornecedorInput').addEventListener('change', function(){
      const nome = this.value.trim();
      if(nome) escolherFornecedor(nome);
    });
    $('btnAddFornRegistrar').addEventListener('click', () => {
      FornecedorModal.open((nome) => escolherFornecedor(nome));
    });
    $('btnTrocarForn').addEventListener('click', () => {
      resetFornecedor();
    });

    // produto
    $('codigoProdutoInput').addEventListener('input', updatePreview);
    $('descInput').addEventListener('input', checkProdutoReady);
    $('valorUnitInput').addEventListener('input', checkProdutoReady);

    // detalhes da perda
    $('qtdInput').addEventListener('input', function(){
      // garante que quantidade nunca seja negativa ou zero na digitação
      const val = parseInt(this.value);
      if(val <= 0 || this.value === '') this.value = '1';
      updatePreview();
    });
    $('qtdInput').addEventListener('change', updatePreview);
    
    $('validadeInput').addEventListener('input', updatePreview);

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

  // faixa "Registrando em Out/2026" no topo da página
  function renderMesRegistro(){
    const sec = $('page-registrar');
    if(!sec) return;
    let el = $('mesRegistrando');
    if(!el){
      el = document.createElement('div');
      el.id = 'mesRegistrando';
      el.className = 'mes-banner';
      sec.insertBefore(el, sec.firstChild);
    }
    el.hidden = !State.mesAberto;
    if(State.mesAberto) el.innerHTML = 'Registrando em <strong>' + Meses.label(State.mesAberto) + '</strong>';
  }

  function refresh(){
    renderMesRegistro();
    resetForm();
  }

  bind();
  return { refresh };
})();