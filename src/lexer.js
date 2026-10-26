'use strict';

const { PseudoError } = require('./erros');
const { normalizar, RESERVADAS, NOMES_FUNCOES } = require('./palavras');

const OPS_DOIS = ['<-', ':=', '<>', '<=', '>=', '!=', '==', '++', '--', '**', '+=', '-=', '*=', '/=', '..'];
const OPS_UM = '+-*/^%(),;:=<>[]';

/**
 * Transforma o texto do programa em tokens.
 * Tipos: KW (palavra reservada), FN (função), ID (variável), NUM, STR, OP, EOF.
 * Comentários: "# ...", "// ..." e blocos entre barra-asterisco e asterisco-barra.
 */
function tokenizar(fonte) {
  const tokens = [];
  const n = fonte.length;
  let i = 0, linha = 1, col = 1;

  const avancar = (k = 1) => {
    for (let j = 0; j < k && i < n; j++) {
      if (fonte[i] === '\n') { linha++; col = 1; } else col++;
      i++;
    }
  };
  const erro = (msg, L, C) => new PseudoError('Erro léxico', msg, L, C);
  const ehLetra = (ch) => ch !== undefined && /[\p{L}_]/u.test(ch);
  const ehAlnum = (ch) => ch !== undefined && /[\p{L}\p{N}_]/u.test(ch);
  const ehDigito = (ch) => ch !== undefined && ch >= '0' && ch <= '9';

  while (i < n) {
    const c = fonte[i];

    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { avancar(); continue; }

    // Comentários
    if (c === '#' || (c === '/' && fonte[i + 1] === '/')) {
      while (i < n && fonte[i] !== '\n') avancar();
      continue;
    }
    if (c === '/' && fonte[i + 1] === '*') {
      const L = linha, C = col;
      avancar(2);
      while (i < n && !(fonte[i] === '*' && fonte[i + 1] === '/')) avancar();
      if (i >= n) throw erro('Comentário de bloco não foi fechado.', L, C);
      avancar(2);
      continue;
    }

    const L = linha, C = col, inicio = i;

    // Texto entre aspas
    if (c === '"' || c === "'") {
      avancar();
      let s = '';
      for (;;) {
        if (i >= n || fonte[i] === '\n') throw erro('Texto sem aspas de fechamento.', L, C);
        const ch = fonte[i];
        if (ch === c) { avancar(); break; }
        if (ch === '\\' && i + 1 < n) {
          const mapa = { n: '\n', t: '\t', '\\': '\\', '"': '"', "'": "'" };
          const prox = fonte[i + 1];
          s += prox in mapa ? mapa[prox] : '\\' + prox;
          avancar(2);
          continue;
        }
        s += ch;
        avancar();
      }
      tokens.push({ tipo: 'STR', valor: s, raw: fonte.slice(inicio, i), linha: L, col: C, len: i - inicio });
      continue;
    }

    // Número (e erro para nomes que começam com número, ex.: 2abc)
    if (ehDigito(c)) {
      let j = i;
      while (ehDigito(fonte[j])) j++;
      if (fonte[j] === '.' && ehDigito(fonte[j + 1])) { j++; while (ehDigito(fonte[j])) j++; }
      if (ehLetra(fonte[j])) {
        let k = j;
        while (ehAlnum(fonte[k])) k++;
        throw erro(`"${fonte.slice(i, k)}" não é um nome válido: nomes de variáveis não podem começar com número.`, L, C);
      }
      const txt = fonte.slice(i, j);
      avancar(j - i);
      tokens.push({ tipo: 'NUM', valor: Number(txt), raw: txt, linha: L, col: C, len: j - inicio });
      continue;
    }

    // Palavras: reservadas, funções ou variáveis (sem diferenciar maiúsculas/minúsculas/acentos)
    if (ehLetra(c)) {
      let j = i;
      while (ehAlnum(fonte[j])) j++;
      const raw = fonte.slice(i, j);
      const norm = normalizar(raw);
      avancar(j - i);
      const tipo = NOMES_FUNCOES.has(norm) ? 'FN' : RESERVADAS.has(norm) ? 'KW' : 'ID';
      tokens.push({ tipo, valor: norm, raw, linha: L, col: C, len: j - inicio });
      continue;
    }

    // Operadores e pontuação
    const dois = fonte.slice(i, i + 2);
    if (OPS_DOIS.includes(dois)) {
      avancar(2);
      tokens.push({ tipo: 'OP', valor: dois, raw: dois, linha: L, col: C, len: 2 });
      continue;
    }
    if (OPS_UM.includes(c)) {
      avancar();
      tokens.push({ tipo: 'OP', valor: c, raw: c, linha: L, col: C, len: 1 });
      continue;
    }

    throw erro(`Caractere inválido '${c}'.${c === '!' ? ' Para negar uma condição use NAO.' : ''}`, L, C);
  }

  tokens.push({ tipo: 'EOF', valor: '', raw: '', linha, col, len: 0 });
  return tokens;
}

module.exports = { tokenizar };
