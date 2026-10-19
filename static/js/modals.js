/* ============================================================
   Modals — componentes de modal reutilizados por mais de uma
   página.
     • FornecedorModal — cadastrar OU renomear fornecedor
                         (Registrar e Catálogo)
     • ConfirmModal    — confirmação genérica (Promise<boolean>)
   ============================================================ */
const FornecedorModal = (function(){
  const $ = (id) => document.getElementById(id);
  let onSaved = null;
  let editingName = null; // nome atual do fornecedor em edição (null = novo)

  function show(titulo, valor){
    $('fornModalTitle').textContent = titulo;
    $('fornModalInput').value = valor;
    $('fornModalHint').style.display = editingName ? 'block' : 'none';
    $('fornecedorModal').classList.add('open');
    $('fornModalInput').focus();
    $('fornModalInput').select();
  }

  // novo fornecedor — mantém a assinatura antiga: open(callback)
  function open(callback){
    onSaved = typeof callback === 'function' ? callback : null;
    editingName = null;
    show('Novo fornecedor', '');
  }

  // renomear fornecedor existente
  function openEdit(nome, callback){
    onSaved = typeof callback === 'function' ? callback : null;
    editingName = nome;
    show('Editar fornecedor', nome);
  }

  function close(){
    $('fornecedorModal').classList.remove('open');
  }

  async function save(){
    const btn = $('btnSaveForn');
    if(btn.disabled) return;

    const nome = $('fornModalInput').value.trim();
    if(!nome){ Utils.toast('Digite o nome do fornecedor.', 'error'); return; }

    // renomear para o mesmo nome = nada a fazer
    if(editingName && nome === editingName){ close(); return; }

    btn.disabled = true;
    try{
      if(editingName) await Api.atualizarFornecedor(editingName, nome);
      else await Api.criarFornecedor(nome);

      const eraEdicao = !!editingName;
      await State.reloadCatalogo();
      close();
      Utils.toast(eraEdicao ? 'Fornecedor atualizado.' : 'Fornecedor adicionado.', 'success');
      if(onSaved) onSaved(nome);
    }catch(e){
      Utils.toast(e.message || 'Erro ao salvar fornecedor.', 'error');
    }finally{
      btn.disabled = false;
    }
  }

  function bind(){
    $('btnCancelForn').addEventListener('click', close);
    $('btnSaveForn').addEventListener('click', save);

    $('fornModalInput').addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); save(); }
    });

    // Esc fecha o modal
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape' && $('fornecedorModal').classList.contains('open')) close();
    });
  }

  bind();
  return { open, openEdit, close };
})();


/* ------------------------------------------------------------
   ConfirmModal — substitui confirm() do navegador.
   Uso:
     const ok = await ConfirmModal.ask({
       titulo: 'Apagar produto?',
       mensagem: 'Texto em HTML (escape o que vier do usuário!)',
       confirmar: 'Apagar',
       perigo: true            // botão vermelho
     });
   ------------------------------------------------------------ */
const ConfirmModal = (function(){
  const $ = (id) => document.getElementById(id);
  let resolver = null;

  function finish(valor){
    $('confirmModal').classList.remove('open');
    if(resolver){
      const r = resolver;
      resolver = null;
      r(valor);
    }
  }

  function ask(opts){
    opts = opts || {};
    if(resolver) finish(false); // fecha uma pergunta pendente, se houver

    $('confirmModalTitle').textContent = opts.titulo || 'Confirmar';
    $('confirmModalMsg').innerHTML = opts.mensagem || '';

    const ok = $('btnConfirmModalOk');
    ok.textContent = opts.confirmar || 'Confirmar';
    ok.classList.toggle('btn-danger', !!opts.perigo);
    ok.classList.toggle('btn-primary', !opts.perigo);

    $('confirmModal').classList.add('open');
    ok.focus();

    return new Promise(resolve => { resolver = resolve; });
  }

  function bind(){
    $('btnConfirmModalCancel').addEventListener('click', () => finish(false));
    $('btnConfirmModalOk').addEventListener('click', () => finish(true));

    // clicar fora da caixa cancela
    $('confirmModal').addEventListener('click', (e) => {
      if(e.target === $('confirmModal')) finish(false);
    });

    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape' && $('confirmModal').classList.contains('open')) finish(false);
    });
  }

  bind();
  return { ask };
})();