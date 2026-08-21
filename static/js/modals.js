/* ============================================================
   Modals — componentes de modal reutilizados por mais de uma
   página (ex: cadastrar fornecedor a partir do Registrar OU do
   Catálogo).
   ============================================================ */
const FornecedorModal = (function(){
  const $ = (id) => document.getElementById(id);
  let onSaved = null;

  function open(callback){
    onSaved = typeof callback === 'function' ? callback : null;
    $('fornModalInput').value = '';
    $('fornecedorModal').classList.add('open');
    $('fornModalInput').focus();
  }

  function close(){
    $('fornecedorModal').classList.remove('open');
  }

  function bind(){
    $('btnCancelForn').addEventListener('click', close);

    $('btnSaveForn').addEventListener('click', async () => {
      const nome = $('fornModalInput').value.trim();
      if(!nome){ Utils.toast('Digite o nome do fornecedor.'); return; }
      try{
        await Api.criarFornecedor(nome);
        await State.reloadCatalogo();
        close();
        Utils.toast('Fornecedor adicionado.');
        if(onSaved) onSaved(nome);
      }catch(e){
        Utils.toast(e.message || 'Erro ao adicionar fornecedor.');
      }
    });
  }

  bind();
  return { open, close };
})();
