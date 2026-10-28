/* ============================================================
   App — inicialização e navegação entre páginas
   Cada troca de página busca os dados mais recentes do servidor.
   ============================================================ */
(function(){

  const PAGE_META = {
    registrar: { title: 'Registrar perda', sub: 'Lance um item vencido ou avariado no controle.' },
    relatorio: { title: 'Relatório', sub: 'Todos os registros, prontos para exportar para o RH.' },
    rankings:  { title: 'Rankings', sub: 'Panorama das perdas por mês, fornecedor e produto.' },
    graficos:  { title: 'Gráficos', sub: 'Visualize as perdas em colunas, por período, tipo ou fornecedor.' },
    trocas:    { title: 'Trocas', sub: 'Peça troca de vencidos e avariados ao fornecedor e controle as rebaixas de preço.' },
    catalogo:  { title: 'Catálogo', sub: 'Fornecedores e produtos salvos para preencher mais rápido.' }
  };

  let currentPage = 'registrar';
  let navToken = 0; // evita que uma carga lenta sobrescreva uma navegação mais nova

  async function goTo(pageId){
    const token = ++navToken;
    currentPage = pageId;

    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + pageId));
    document.getElementById('pageTitle').textContent = PAGE_META[pageId].title;
    document.getElementById('pageSubtitle').textContent = PAGE_META[pageId].sub;

    // esqueleto de carregamento imediato, enquanto aguarda o backend responder
    if(pageId === 'relatorio') PageRelatorio.showSkeleton();
    if(pageId === 'rankings')  PageRankings.showSkeleton();
    if(pageId === 'catalogo')  PageCatalogo.showSkeleton();
    if(pageId === 'trocas')    PageTrocas.showSkeleton();

    await State.reloadAll();
    if(token !== navToken) return;

    Meses.renderChip();

    if(pageId === 'registrar') PageRegistrar.refresh();
    if(pageId === 'relatorio') PageRelatorio.refresh();
    if(pageId === 'rankings')  PageRankings.refresh();
    if(pageId === 'graficos')  PageGraficos.refresh();
    if(pageId === 'catalogo')  PageCatalogo.refresh();
    if(pageId === 'trocas')    PageTrocas.refresh();
  }

  window.App = { goTo, current: () => currentPage };

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => goTo(btn.dataset.page));
  });

  function setTopbarDate(){
    const el = document.getElementById('topbarDate');
    if(!el) return;
    const hoje = new Date();
    el.textContent = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  setTopbarDate();
  goTo('registrar');

})();