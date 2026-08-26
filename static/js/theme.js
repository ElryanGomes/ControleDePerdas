/* ============================================================
   Theme — alterna entre tema claro e escuro.
   Como todo o CSS do projeto usa variáveis (variables.css),
   a troca de tema só precisa alternar o atributo data-theme
   no <html>; nenhum outro CSS precisa ser tocado.
   A preferência é salva no navegador (localStorage) — é apenas
   uma preferência de exibição, não dado do negócio.
   ============================================================ */
const Theme = (function(){
  const KEY = 'controlePerdas_theme';

  const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"></line><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"></line><line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"></line><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"></line></svg>';
  const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function current(){
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function renderIcon(){
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    btn.innerHTML = current() === 'dark' ? SUN_SVG : MOON_SVG;
    btn.title = current() === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
  }

  function apply(theme){
    document.documentElement.setAttribute('data-theme', theme);
    try{ localStorage.setItem(KEY, theme); }catch(e){}
    renderIcon();
    // avisa páginas com gráficos (Chart.js) para redesenhar com as novas cores
    window.dispatchEvent(new CustomEvent('themechange'));
  }

  function toggle(){
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  function init(){
    renderIcon();
    document.getElementById('themeToggle')?.addEventListener('click', toggle);
  }

  return { init, toggle, current };
})();

Theme.init();
