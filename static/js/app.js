/* ============================================================
   App — inicialização e navegação entre páginas
   Cada troca de página busca os dados mais recentes do servidor.
   ============================================================ */
(function(){

  const PAGE_META = {
    registrar: { title: 'Registrar perda', sub: 'Lance um item vencido ou avariado no controle.' },
    relatorio: { title: 'Relatório', sub: 'Todos os registros, prontos para exportar para o RH.' },
    rankings:  { title: 'Rankings', sub: 'Panorama das perdas por período, fornecedor e produto.' },
    catalogo:  { title: 'Catálogo', sub: 'Fornecedores e produtos salvos para preencher mais rápido.' }
  };

  async function goTo(pageId){
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + pageId));
    document.getElementById('pageTitle').textContent = PAGE_META[pageId].title;
    document.getElementById('pageSubtitle').textContent = PAGE_META[pageId].sub;

    await State.reloadAll();

    if(pageId === 'registrar') PageRegistrar.refresh();
    if(pageId === 'relatorio') PageRelatorio.refresh();
    if(pageId === 'rankings')  PageRankings.refresh();
    if(pageId === 'catalogo')  PageCatalogo.refresh();
  }

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => goTo(btn.dataset.page));
  });

  goTo('registrar');

})();
