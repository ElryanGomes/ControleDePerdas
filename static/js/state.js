/* ============================================================
   State — estado central da aplicação, sincronizado com o
   backend (SQLite/MySQL via Flask + SQLAlchemy) através da Api.

   catalogo: { fornecedor: [ {id, codigoBarra, codigoProduto, descricao, valorUnit} ] }
   perdas:   perdas do mês selecionado (ou de todos, se mesSelecionado = 'TODOS')
             [ {id, fornecedor, descricao, codigo, tipo, quantidade, validade,
                valorUnit, valorTotal, data, dataLocal, mesRef} ]
   meses:    [ {ref, status, registros, vencido:{valor,quantidade}, avariado:{...}} ]
   ============================================================ */
const State = {
  catalogo: {},
  perdas: [],
  perdasTodas: [],        // todos os meses (usado só pelo Gráficos)
  meses: [],
  mesAberto: '',          // 'AAAA-MM' do mês aberto (onde o Registrar grava)
  mesCalendario: '',      // 'AAAA-MM' do mês atual do calendário
  mesSelecionado: '',     // 'AAAA-MM' ou 'TODOS' (compartilhado entre Relatório e Rankings)
  usoFornecedores: {},    // { fornecedor: nº de perdas } — todos os meses
  fornecedorAtual: '',
  erro: '',               // mensagem do último erro de carga (vazio = ok)

  async reloadAll(){
    this.erro = '';
    await Promise.all([this.reloadCatalogo(), this.reloadMeses(), this.reloadUso()]);
    await this.reloadPerdas(); // depende do mês selecionado, definido em reloadMeses
  },

  async reloadCatalogo(){
    try{ this.catalogo = await Api.getCatalogo(); }
    catch(e){ this.erro = e.message; Utils.toast(e.message || 'Erro ao carregar catálogo.', 'error'); }
  },

  async reloadMeses(){
    try{
      const r = await Api.getMeses();
      this.meses = r.meses || [];
      this.mesAberto = r.aberto || '';
      this.mesCalendario = r.calendario || '';
      const valido = this.mesSelecionado === 'TODOS' || this.meses.some(m => m.ref === this.mesSelecionado);
      if(!valido) this.mesSelecionado = this.mesAberto;
    }catch(e){ this.erro = e.message; Utils.toast(e.message || 'Erro ao carregar meses.', 'error'); }
  },

  async reloadUso(){
    try{ this.usoFornecedores = await Api.getUsoFornecedores(); }
    catch(e){ /* só ordena os atalhos do Registrar; falhar aqui não deve travar a tela */ }
  },

  async reloadPerdas(){
    try{ this.perdas = await Api.getPerdas(this.mesSelecionado || undefined); }
    catch(e){ this.erro = e.message; Utils.toast(e.message || 'Erro ao carregar perdas.', 'error'); }
  },

  async reloadPerdasTodas(){
    try{ this.perdasTodas = await Api.getPerdas('TODOS'); }
    catch(e){ this.erro = e.message; Utils.toast(e.message || 'Erro ao carregar perdas.', 'error'); }
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