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
    document.body.style.overflow = 'hidden'; // previne scroll quando menu aberto
  }

  function closeMenu(){
    if(!sidebar) return;
    sidebar.classList.remove('open');
    hamburger?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = ''; // restaura scroll
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
    hamburger?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // overlay click fecha o menu
    overlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
    });

    // nav item click fecha o menu
    navItems.forEach(item => {
      item.addEventListener('click', function(e){
        closeMenu();
      });
    });

    // click fora do menu também fecha (mas dentro da sidebar fica aberto)
    sidebar?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // fechar menu ao redimensionar para desktop
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if(window.innerWidth > 768){
          closeMenu();
        }
      }, 100);
    });

    // fechar menu ao apertar ESC
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape' && sidebar?.classList.contains('open')){
        closeMenu();
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
