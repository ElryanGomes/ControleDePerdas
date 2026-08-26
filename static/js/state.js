/* ============================================================
   State — estado central da aplicação, sincronizado com o
   backend (SQLite/MySQL via Flask + SQLAlchemy) através da Api.
   catalogo: { fornecedor: [ {id, codigoBarra, codigoProduto, descricao, valorUnit} ] }
   perdas:   [ {id, fornecedor, descricao, codigo, tipo, quantidade, validade, valorUnit, valorTotal, data} ]
   ============================================================ */
const State = {
  catalogo: {},
  perdas: [],
  fornecedorAtual: '',

  async reloadAll(){
    await Promise.all([this.reloadCatalogo(), this.reloadPerdas()]);
  },

  async reloadCatalogo(){
    try{ this.catalogo = await Api.getCatalogo(); }
    catch(e){ Utils.toast(e.message || 'Erro ao carregar catálogo.', 'error'); }
  },

  async reloadPerdas(){
    try{ this.perdas = await Api.getPerdas(); }
    catch(e){ Utils.toast(e.message || 'Erro ao carregar perdas.', 'error'); }
  },

  fornecedoresList(){
    return Object.keys(this.catalogo).sort((a, b) => a.localeCompare(b));
  },

  lookupPorBarcodeLocal(fornecedor, barcode){
    if(!fornecedor || !this.catalogo[fornecedor]) return null;
    return this.catalogo[fornecedor].find(p => p.codigoBarra && p.codigoBarra === barcode.trim()) || null;
  },

  produtoPorId(id){
    for(const forn of Object.keys(this.catalogo)){
      const p = this.catalogo[forn].find(x => x.id === id);
      if(p) return p;
    }
    return null;
  }
};
