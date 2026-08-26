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

  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="11" x2="12" y2="16"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };

  function toast(msg, type){
    type = TOAST_ICONS[type] ? type : 'info';
    const t = document.getElementById('toast');
    if(!t) return;
    t.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type]}</span><span class="toast-msg"></span>`;
    t.querySelector('.toast-msg').textContent = msg;
    t.className = 'toast-' + type;
    // força reflow antes de adicionar 'show' para reiniciar a transição em toasts consecutivos
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3200);
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
