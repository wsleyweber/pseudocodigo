'use strict';

/** Erro "amigável" do pseudocódigo (léxico, sintaxe, semântico ou de execução). */
class PseudoError extends Error {
  constructor(tipo, mensagem, linha = null, coluna = null) {
    super(mensagem);
    this.name = 'PseudoError';
    this.tipo = tipo;
    this.linha = linha;
    this.coluna = coluna;
  }
}

function escaparControlesTerminal(texto) {
  return texto.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g,
    (caractere) => `\\u${caractere.codePointAt(0).toString(16).padStart(4, '0')}`);
}

/** Monta a mensagem exibida ao aluno, com a linha do código e uma seta (^) no ponto do erro. */
function formatarErro(erro, fonte) {
  const local = erro.linha
    ? ` (linha ${erro.linha}${erro.coluna ? `, coluna ${erro.coluna}` : ''})`
    : '';
  const partes = [escaparControlesTerminal(`${erro.tipo}${local}: ${erro.message}`)];

  if (erro.linha && fonte) {
    const texto = escaparControlesTerminal(
      (fonte.split('\n')[erro.linha - 1] || '').replace(/\r$/, '').replace(/\t/g, ' ')
    );
    const num = String(erro.linha);
    partes.push(`  ${num} | ${texto}`);
    if (erro.coluna) partes.push(`  ${' '.repeat(num.length)} | ${' '.repeat(erro.coluna - 1)}^`);
  }
  return partes.join('\n');
}

module.exports = { PseudoError, formatarErro };