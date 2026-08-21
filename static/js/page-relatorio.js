/* ============================================================
   Página: Relatório
   ============================================================ */
const PageRelatorio = (function(){
  const $ = (id) => document.getElementById(id);

  function fillFilterFornecedor(){
    const sel = $('filtroForn');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos os fornecedores</option>';
    State.fornecedoresList().forEach(f => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f;
      sel.appendChild(o);
    });
    sel.value = cur;
  }

  function filtered(){
    const f = $('filtroForn').value;
    const t = $('filtroTipo').value;
    return State.perdas.filter(p => (!f || p.fornecedor === f) && (!t || p.tipo === t));
  }

  function render(){
    fillFilterFornecedor();
    const list = filtered();
    const tbody = $('relatorioTbody');
    const empty = $('relatorioEmpty');
    const tableWrap = $('relatorioTableWrap');

    if(State.perdas.length === 0){
      empty.style.display = 'block';
      tableWrap.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    tableWrap.style.display = 'block';

    tbody.innerHTML = '';
    let totQtd = 0, totValor = 0;

    list.forEach(p => {
      totQtd += p.quantidade;
      totValor += p.valorTotal;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${Utils.escapeHtml(p.fornecedor)}</td>
        <td>${Utils.escapeHtml(p.descricao)}</td>
        <td><span class="badge ${p.tipo}">${p.tipo}</span></td>
        <td class="num">${p.quantidade}</td>
        <td class="mono">${p.codigo || '—'}</td>
        <td class="mono">${p.validade}</td>
        <td class="num">${Utils.fmtBRL(p.valorUnit)}</td>
        <td class="num">${Utils.fmtBRL(p.valorTotal)}</td>
        <td>
          <div class="row-actions">
            <span class="act-del" data-id="${p.id}">excluir</span>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    $('relTotQtd').textContent = totQtd;
    $('relTotCount').textContent = list.length + ' registros';
    $('relTotValor').textContent = Utils.fmtBRL(totValor);

    tbody.querySelectorAll('.act-del').forEach(el => {
      el.addEventListener('click', async function(){
        try{
          await Api.excluirPerda(parseInt(this.dataset.id));
          await State.reloadPerdas();
          render();
          Utils.toast('Registro excluído.');
        }catch(e){
          Utils.toast(e.message || 'Erro ao excluir.');
        }
      });
    });
  }

  function exportCSV(){
    const list = filtered();
    if(list.length === 0){ Utils.toast('Não há registros para exportar.'); return; }

    const headers = ['Distribuidora','Descrição','Vencido ou Avariado','Quantidade','Código','Validade','Valor Unitário','Valor Total'];
    const rows = list.map(p => [
      p.fornecedor, p.descricao, p.tipo, p.quantidade, p.codigo,
      p.validade, String(p.valorUnit).replace('.', ','), String(p.valorTotal).replace('.', ',')
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planilha_perdas_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Utils.toast('CSV exportado.');
  }

  function bind(){
    $('filtroForn').addEventListener('change', render);
    $('filtroTipo').addEventListener('change', render);
    $('btnExportCSV').addEventListener('click', exportCSV);
  }

  bind();
  return { refresh: render };
})();
