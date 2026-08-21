/* ============================================================
   Utils — funções auxiliares compartilhadas entre páginas
   ============================================================ */
const Utils = (function(){

  function fmtBRL(n){
    return (n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  function toast(msg){
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const MESES_ABBR = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  function ultimosMeses(n){
    const arr = [];
    const now = new Date();
    for(let i = n - 1; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({
        key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
        label: MESES_ABBR[d.getMonth()] + '/' + String(d.getFullYear()).slice(2)
      });
    }
    return arr;
  }

  return { fmtBRL, escapeHtml, toast, ultimosMeses, MESES_ABBR };
})();
