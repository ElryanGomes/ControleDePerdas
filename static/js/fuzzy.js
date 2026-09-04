/* ============================================================
   FuzzySearch — busca tolerante a erros de digitação e acentos.
   Usada no campo de fornecedor do Registrar: digitando algo como
   "dias bnc" ainda encontra "M DIAS BRANCO".

   Algoritmo: cada palavra digitada precisa aparecer, em ordem
   (mas podendo pular letras), dentro de alguma palavra do nome
   do fornecedor — ou do nome inteiro. Quanto mais "juntinhas"
   as letras encontradas estiverem, maior a pontuação.
   ============================================================ */
const FuzzySearch = (function(){

  function normalizar(s){
    return (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toLowerCase();
  }

  // pontua o quanto 'padrao' aparece, em ordem, dentro de 'texto'
  // (tolera letras erradas/puladas no meio, mas penaliza "buracos" grandes)
  function pontuarSubsequencia(padrao, texto){
    if(!padrao) return 0;
    let ti = 0, pi = 0, acertos = 0, penalidade = 0, ultimo = -1;
    while(ti < texto.length && pi < padrao.length){
      if(texto[ti] === padrao[pi]){
        acertos++;
        if(ultimo >= 0) penalidade += (ti - ultimo - 1);
        ultimo = ti;
        pi++;
      }
      ti++;
    }
    if(pi < padrao.length) return 0; // nem todos os caracteres do termo foram encontrados em ordem
    return acertos / (padrao.length + penalidade * 0.3);
  }

  // pontua um nome de fornecedor contra o texto digitado (pode ter várias palavras)
  function pontuar(query, nome){
    const alvo = normalizar(nome);
    const alvoSemEspaco = alvo.replace(/\s+/g, '');
    const palavras = alvo.split(/\s+/).filter(Boolean);
    const termos = normalizar(query).trim().split(/\s+/).filter(Boolean);
    if(termos.length === 0) return 0;

    let total = 0;
    for(const termo of termos){
      let melhor = pontuarSubsequencia(termo, alvoSemEspaco);
      for(const palavra of palavras){
        melhor = Math.max(melhor, pontuarSubsequencia(termo, palavra) * 1.2);
      }
      if(melhor === 0) return 0; // todo termo digitado precisa achar alguma correspondência
      total += melhor;
    }
    return total / termos.length;
  }

  // retorna os nomes mais parecidos com a busca, melhor pontuação primeiro
  function buscar(query, lista, limite){
    limite = limite || 6;
    if(!query || query.trim().length < 2) return [];
    return lista
      .map(nome => ({ nome, score: pontuar(query, nome) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limite)
      .map(x => x.nome);
  }

  return { normalizar, pontuar, buscar };
})();
