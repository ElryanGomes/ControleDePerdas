/* ============================================================
   Api — camada única de comunicação com o backend Flask
   Todas as outras páginas falam com o servidor só através daqui.
   ============================================================ */
const Api = (function(){
  const BASE = '/api';

  async function doFetch(path, options = {}){
    let res;
    try{
      res = await fetch(BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
    }catch(e){
      throw new Error('Não foi possível conectar ao servidor.');
    }
    if(!res.ok){
      let msg = 'Erro na requisição (' + res.status + ').';
      try{ const j = await res.json(); if(j.erro) msg = j.erro; }catch(e){}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res;
  }

  async function request(path, options = {}){
    const res = await doFetch(path, options);
    return res.status === 204 ? null : res.json();
  }

  async function requestBlob(path, options = {}){
    const res = await doFetch(path, options);
    return res.blob();
  }

  // 'TODOS' (front) -> 'todos' (back); vazio -> mês aberto
  function qsMes(mes){
    if(!mes) return '';
    return '?mes=' + encodeURIComponent(mes === 'TODOS' ? 'todos' : mes);
  }

  return {
    getCatalogo: () => request('/catalogo'),

    criarFornecedor: (nome) => request('/fornecedores', { method: 'POST', body: JSON.stringify({ nome }) }),
    atualizarFornecedor: (nome, novoNome) => request('/fornecedores/' + encodeURIComponent(nome), { method: 'PUT', body: JSON.stringify({ nome: novoNome }) }),
    excluirFornecedor: (nome) => request('/fornecedores/' + encodeURIComponent(nome), { method: 'DELETE' }),
    getUsoFornecedores: () => request('/fornecedores/uso'),

    upsertProduto: (produto) => request('/produtos', { method: 'POST', body: JSON.stringify(produto) }),
    atualizarProduto: (id, produto) => request(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(produto) }),
    excluirProduto: (id) => request(`/produtos/${id}`, { method: 'DELETE' }),

    getPerdas: (mes) => request('/perdas' + qsMes(mes)),
    criarPerda: (perda) => request('/perdas', { method: 'POST', body: JSON.stringify(perda) }),
    atualizarPerda: (id, perda) => request(`/perdas/${id}`, { method: 'PUT', body: JSON.stringify(perda) }),
    excluirPerda: (id) => request(`/perdas/${id}`, { method: 'DELETE' }),

    getMeses: () => request('/meses'),
    fecharMes: (mes) => request('/meses/fechar', { method: 'POST', body: JSON.stringify({ mes }) }),

    exportarXLSX: (perdas, mes) => requestBlob('/export/xlsx', {
      method: 'POST',
      body: JSON.stringify({ perdas, mes: (mes && mes !== 'TODOS') ? mes : null })
    })
  };
})();