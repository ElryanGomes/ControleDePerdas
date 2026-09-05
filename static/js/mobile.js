/* ============================================================
   Mobile — menu hambúrguer e sidebar toggle para mobile
   ============================================================ */
const Mobile = (function(){
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.querySelector('.hamburger-btn');
  const overlay = document.querySelector('.sidebar-overlay');
  const navItems = document.querySelectorAll('.nav-item');

  function openMenu(){
    if(!sidebar) return;
    sidebar.classList.add('open');
    hamburger?.classList.add('open');
    overlay?.classList.add('open');
  }

  function closeMenu(){
    if(!sidebar) return;
    sidebar.classList.remove('open');
    hamburger?.classList.remove('open');
    overlay?.classList.remove('open');
  }

  function toggleMenu(){
    if(sidebar?.classList.contains('open')){
      closeMenu();
    } else {
      openMenu();
    }
  }

  function init(){
    // hamburger button click
    hamburger?.addEventListener('click', toggleMenu);

    // overlay click fecha o menu
    overlay?.addEventListener('click', closeMenu);

    // nav item click fecha o menu e navega para página
    navItems.forEach(item => {
      item.addEventListener('click', function(){
        const page = this.dataset.page;
        closeMenu();
        
        // dispara o evento de navegação de página
        // (presumindo que haja um sistema de navegação de páginas no app.js)
        if(window.navigateToPage){
          window.navigateToPage(page);
        }
      });
    });

    // fechar menu ao redimensionar para desktop
    window.addEventListener('resize', () => {
      if(window.innerWidth > 768){
        closeMenu();
        sidebar?.classList.remove('closed');
      }
    });
  }

  // expo public functions
  return { init, openMenu, closeMenu, toggleMenu };
})();

// inicializa quando DOM está pronto
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => Mobile.init());
} else {
  Mobile.init();
}
