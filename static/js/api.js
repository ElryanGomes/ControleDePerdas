/* ============================================================
   Api — camada única de comunicação com o backend Flask
   Todas as outras páginas falam com o servidor só através daqui.
   ============================================================ */
const Api = (function(){
  const BASE = '/api';

  async function request(path, options = {}){
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
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    getCatalogo: () => request('/catalogo'),
    criarFornecedor: (nome) => request('/fornecedores', { method: 'POST', body: JSON.stringify({ nome }) }),

    upsertProduto: (produto) => request('/produtos', { method: 'POST', body: JSON.stringify(produto) }),
    atualizarProduto: (id, produto) => request(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(produto) }),
    excluirProduto: (id) => request(`/produtos/${id}`, { method: 'DELETE' }),

    getPerdas: () => request('/perdas'),
    criarPerda: (perda) => request('/perdas', { method: 'POST', body: JSON.stringify(perda) }),
    atualizarPerda: (id, perda) => request(`/perdas/${id}`, { method: 'PUT', body: JSON.stringify(perda) }),
    excluirPerda: (id) => request(`/perdas/${id}`, { method: 'DELETE' })
  };
})();
