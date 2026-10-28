'use strict';

const { PseudoError } = require('./erros');
const { TIPOS_INFO, BASE_INDICE, formatar, nomeTipoValor } = require('./tipos');
const { buscarFuncao } = require('./funcoes');

// Devolve o controle ao ambiente de vez em quando em laços longos: no Node isso deixa o Ctrl+C
// funcionar; no navegador deixa a página responder (botão "Parar"). Como o navegador não tem
// setImmediate, usa-se MessageChannel (rápido); setTimeout é o último recurso.
const cederVez = (() => {
  if (typeof setImmediate === 'function') return () => new Promise((r) => setImmediate(r));
  if (typeof MessageChannel === 'function') {
    const canal = new MessageChannel();
    const fila = [];
    canal.port1.onmessage = () => fila.shift()();
    return () => new Promise((r) => { fila.push(r); canal.port2.postMessage(null); });
  }
  return () => new Promise((r) => setTimeout(r, 0));
})();
const MAX_CELULAS = 5_000_000;
const SINAL_INTERROMPA = { tipo: 'interrompa' };
const SINAL_CONTINUE = { tipo: 'continue' };

class Interpretador {
  /**
   * @param programa  AST já verificada
   * @param io        { escrever(texto), lerLinha(): Promise<string|null> }
   * @param opcoes    { maxIteracoes (0 = sem limite), maxProfundidade, sinal }
   *                  sinal: AbortSignal opcional; ao ser acionado, o programa para na próxima repetição
   *                         (usado pelo botão "Parar" da versão web)
   */
  constructor(programa, io, opcoes = {}) {
    this.programa = programa;
    this.io = io;
    this.maxIteracoes = opcoes.maxIteracoes ?? 10_000_000;
    this.maxProfundidade = opcoes.maxProfundidade ?? 3000;
    this.sinal = opcoes.sinal;
    this.iteracoes = 0;
    this.profundidade = 0;
    this.globais = new Map();
    this.frame = this.globais;
    this.subprogramas = new Map((programa.funcoes || []).map((f) => [f.nome, f]));
  }

  erro(msg, no) { return new PseudoError('Erro de execução', msg, no?.linha, no?.col); }

  async executar() {
    this.frame = this.globais;
    for (const d of this.programa.decls) this.declarar(d, this.globais);
    await this.bloco(this.programa.corpo);
  }

  // ---------- variáveis ----------
  achar(no) { return this.frame.get(no.nome) ?? this.globais.get(no.nome); }

  declarar(d, mapa) {
    if (d.constante) {
      const n = d.nomes[0];
      const valor = this.avaliar(d.valor);
      if (!TIPOS_INFO[d.tipo].aceita(valor)) {
        throw this.erro(`A constante '${n.raw}' é do tipo ${d.tipo} e não aceita o valor ${formatar(valor)}.`, n);
      }
      mapa.set(n.nome, { tipo: d.tipo, raw: n.raw, valor, inicializada: true, constante: true });
      return;
    }
    if (d.rank > 0) {
      const dims = d.dims.map((e) => {
        const v = this.avaliar(e);
        if (!Number.isInteger(v) || v < 1) throw this.erro(`O tamanho de um vetor/matriz deve ser um inteiro maior que zero (encontrado ${formatar(v)}).`, e);
        return v;
      });
      const total = dims.reduce((a, b) => a * b, 1);
      if (total > MAX_CELULAS) throw this.erro(`Vetor/matriz grande demais (${total} posições; o máximo é ${MAX_CELULAS}).`, d.nomes[0]);
      for (const n of d.nomes) {
        mapa.set(n.nome, { tipo: d.tipo, raw: n.raw, rank: d.rank, dims, dados: new Array(total), ehArray: true, inicializada: true });
      }
      return;
    }
    for (const n of d.nomes) mapa.set(n.nome, { tipo: d.tipo, raw: n.raw, valor: undefined, inicializada: false });
  }

  /** Posição (base 0) dentro do vetor/matriz, validando os limites. `idx` = índices já calculados. */
  posicao(no, info, idx) {
    let pos = 0;
    idx.forEach((v, k) => {
      if (!Number.isInteger(v)) throw this.erro(`O índice de '${info.raw}' deve ser um número inteiro (encontrado ${formatar(v)}).`, no);
      const max = info.dims[k] + BASE_INDICE - 1;
      if (v < BASE_INDICE || v > max) {
        throw this.erro(`Índice ${v} fora dos limites de '${info.raw}' (${BASE_INDICE} a ${max}${info.rank > 1 ? `, na dimensão ${k + 1}` : ''}).`, no);
      }
      pos = pos * info.dims[k] + (v - BASE_INDICE);
    });
    return pos;
  }

  lerCelula(no, idx) {
    const info = this.achar(no);
    const v = info.dados[this.posicao(no, info, idx)];
    if (v === undefined) throw this.erro(`A posição ${info.raw}[${idx.join('][')}] foi usada antes de receber um valor.`, no);
    return v;
  }

  async calcularIndices(no) {
    const idx = [];
    for (const e of no.indices) idx.push(await this.av(e));
    return idx;
  }

  async atribuir(alvo, valor, indicesCalculados = null) {
    const info = this.achar(alvo);
    if (!TIPOS_INFO[info.tipo].aceita(valor)) {
      const dica = info.tipo === 'INTEIRO' && typeof valor === 'number'
        ? ' Dica: use TRUNC() ou ROUND() para obter um número inteiro.' : '';
      throw this.erro(
        `Não é possível guardar ${typeof valor === 'string' ? `"${valor}"` : formatar(valor)} (${nomeTipoValor(valor)}) na variável '${info.raw}', que é do tipo ${info.tipo}.${dica}`,
        alvo,
      );
    }
    if (alvo.tipo === 'Indice') {
      const idx = indicesCalculados ?? await this.calcularIndices(alvo);
      info.dados[this.posicao(alvo, info, idx)] = valor;
    } else {
      info.valor = valor;
      info.inicializada = true;
    }
  }

  // ---------- comandos ----------
  async bloco(lista) {
    for (const c of lista) {
      const sinal = await this.comando(c);
      if (sinal) return sinal; // INTERROMPA / CONTINUE / RETORNE sobem até quem trata
    }
    return undefined;
  }

  async repeticao(no) {
    if (this.sinal?.aborted) {
      throw new PseudoError('Execução interrompida', 'O programa foi interrompido antes de terminar.', no?.linha, no?.col);
    }
    this.iteracoes++;
    if (this.maxIteracoes > 0 && this.iteracoes > this.maxIteracoes) {
      throw this.erro(`O programa passou de ${this.maxIteracoes} repetições. Parece haver um laço infinito: a condição nunca muda?`, no);
    }
    if (this.iteracoes % 2000 === 0) await cederVez();
  }

  async comando(no) {
    switch (no.tipo) {
      case 'Escreva': {
        const partes = [];
        for (const a of no.args) partes.push(formatar(await this.av(a)));
        this.io.escrever(partes.join(' ') + (no.semQuebra ? '' : '\n'));
        return undefined;
      }
      case 'Leia': await this.leia(no); return undefined;
      case 'Atribuicao': {
        if (no.alvo.tipo === 'Indice' && no.valor.tipo === 'Binario' && no.valor.esq === no.alvo) {
          const indices = await this.calcularIndices(no.alvo);
          const anterior = this.lerCelula(no.alvo, indices);
          const direita = await this.av(no.valor.dir);
          const valor = this.aplicarBinario(no.valor, anterior, direita);
          await this.atribuir(no.alvo, valor, indices);
          return undefined;
        }
        await this.atribuir(no.alvo, await this.av(no.valor));
        return undefined;
      }
      case 'Se': {
        for (const r of no.ramos) {
          if (await this.condicao(r.cond)) return this.bloco(r.corpo);
        }
        return no.senao ? this.bloco(no.senao) : undefined;
      }
      case 'Escolha': return this.escolha(no);
      case 'Enquanto':
        while (await this.condicao(no.cond)) {
          await this.repeticao(no);
          const s = await this.bloco(no.corpo);
          if (s) { if (s === SINAL_INTERROMPA) break; if (s === SINAL_CONTINUE) continue; return s; }
        }
        return undefined;
      case 'Repita':
        do {
          await this.repeticao(no);
          const s = await this.bloco(no.corpo);
          if (s) { if (s === SINAL_INTERROMPA) break; if (s !== SINAL_CONTINUE) return s; } // CONTINUE: vai direto ao ATE
        } while (!(await this.condicao(no.cond)));
        return undefined;
      case 'Para': return this.para(no);
      case 'Bloco': return this.bloco(no.corpo);
      case 'ChamadaProc': await this.executarChamada(no.chamada); return undefined;
      case 'Retorne': return { tipo: 'retorne', valor: no.valor ? await this.av(no.valor) : undefined, no };
      case 'Interrompa': return SINAL_INTERROMPA;
      case 'Continue': return SINAL_CONTINUE;
      default: throw this.erro(`Comando desconhecido: ${no.tipo}`, no);
    }
  }

  async leia(no) {
    for (const alvo of no.vars) {
      const info = this.achar(alvo);
      for (;;) {
        const linha = await this.io.lerLinha();
        if (linha === null) throw this.erro(`A entrada terminou, mas o programa ainda esperava um valor para '${info.raw}'.`, alvo);
        const r = TIPOS_INFO[info.tipo].ler(linha);
        if (r.ok) { await this.atribuir(alvo, r.valor); break; }
        this.io.escrever(`Valor inválido para ${info.tipo}: ${r.motivo} Tente novamente.\n`);
      }
    }
  }

  async escolha(no) {
    const v = await this.av(no.expr);
    const igual = (x) => typeof x === typeof v && x === v;
    const dentro = (a, b) => typeof a === typeof v && typeof b === typeof v && v >= a && v <= b;
    for (const caso of no.casos) {
      let bate = false;
      for (const c of caso.valores) {
        bate = c.faixa ? dentro(await this.av(c.de), await this.av(c.ate)) : igual(await this.av(c.valor));
        if (bate) break;
      }
      if (bate) return this.bloco(caso.corpo);
    }
    return no.padrao ? this.bloco(no.padrao) : undefined;
  }

  async para(no) {
    const info = this.achar(no.var);
    const inicio = await this.av(no.inicio);
    const fim = await this.av(no.fim);
    const passo = no.passo ? await this.av(no.passo) : 1;
    if (passo === 0) throw this.erro('O PASSO do PARA não pode ser zero (o laço nunca terminaria).', no.passo);
    await this.atribuir(no.var, inicio);
    while (passo > 0 ? info.valor <= fim : info.valor >= fim) {
      await this.repeticao(no);
      const s = await this.bloco(no.corpo);
      if (s) { if (s === SINAL_INTERROMPA) break; if (s !== SINAL_CONTINUE) return s; }
      await this.atribuir(no.var, Number((info.valor + passo).toPrecision(15)));
    }
    return undefined;
  }

  // ---------- funções e procedimentos do aluno ----------
  async executarChamada(no) {
    const def = this.subprogramas.get(no.nome);
    if (this.profundidade >= this.maxProfundidade) {
      throw this.erro(`Chamadas demais uma dentro da outra (mais de ${this.maxProfundidade}). Falta a condição de parada da recursão?`, no);
    }
    await this.repeticao(no); // conta a chamada como repetição: limite, botão Parar e "respiro" para o navegador
    const novo = new Map();
    for (let i = 0; i < def.params.length; i++) {
      const p = def.params[i];
      const arg = no.args[i];
      if (p.rank > 0) { // vetor/matriz: passagem por referência (mesmos dados)
        const origem = this.achar(arg);
        novo.set(p.nome.nome, { tipo: p.tipo, raw: p.nome.raw, rank: origem.rank, dims: origem.dims, dados: origem.dados, ehArray: true, inicializada: true });
      } else {
        const v = await this.av(arg);
        if (!TIPOS_INFO[p.tipo].aceita(v)) {
          throw this.erro(`O argumento ${i + 1} de ${def.raw} deve ser ${p.tipo}, mas recebeu ${typeof v === 'string' ? `"${v}"` : formatar(v)}.${p.tipo === 'INTEIRO' && typeof v === 'number' ? ' Dica: use TRUNC() ou ROUND().' : ''}`, arg);
        }
        novo.set(p.nome.nome, { tipo: p.tipo, raw: p.nome.raw, valor: v, inicializada: true });
      }
    }
    const anterior = this.frame;
    this.frame = novo;
    this.profundidade++;
    try {
      for (const d of def.decls) this.declarar(d, novo);
      const sinal = await this.bloco(def.corpo);
      if (def.tipo !== 'Funcao') return undefined;
      if (!sinal || sinal.tipo !== 'retorne') throw this.erro(`A função '${def.raw}' terminou sem executar um RETORNE.`, no);
      if (!TIPOS_INFO[def.retorno].aceita(sinal.valor)) {
        throw this.erro(`A função '${def.raw}' devolve ${def.retorno}, mas retornou ${typeof sinal.valor === 'string' ? `"${sinal.valor}"` : formatar(sinal.valor)}.`, sinal.no);
      }
      return sinal.valor;
    } finally {
      this.frame = anterior;
      this.profundidade--;
    }
  }

  // ---------- expressões ----------
  /** Avalia uma expressão (síncrona se não tiver chamada de função do aluno; assíncrona se tiver). */
  av(no) { return no.temChamada ? this.avaliarA(no) : this.avaliar(no); }

  async condicao(no) {
    const v = await this.av(no);
    if (typeof v !== 'boolean') throw this.erro('Era esperada uma condição (VERDADEIRO ou FALSO).', no);
    return v;
  }

  logico(no) {
    const v = this.avaliar(no);
    if (typeof v !== 'boolean') throw this.erro('Era esperada uma condição (VERDADEIRO ou FALSO).', no);
    return v;
  }

  async logicoA(no) {
    const v = await this.av(no);
    if (typeof v !== 'boolean') throw this.erro('Era esperada uma condição (VERDADEIRO ou FALSO).', no);
    return v;
  }

  numero(no, v) {
    if (typeof v !== 'number') throw this.erro('Era esperado um número.', no);
    return v;
  }

  avaliar(no) {
    switch (no.tipo) {
      case 'Num': case 'Str': case 'Bool': return no.valor;
      case 'Var': {
        const info = this.achar(no);
        if (!info) throw this.erro(`A variável '${no.raw}' não foi declarada.`, no);
        if (!info.inicializada) {
          throw this.erro(`A variável '${no.raw}' foi usada antes de receber um valor (use LEIA ou uma atribuição '<-' antes).`, no);
        }
        return info.valor;
      }
      case 'Indice': return this.lerCelula(no, no.indices.map((e) => this.avaliar(e)));
      case 'Unario': {
        if (no.op === 'NAO') return !this.logico(no.expr);
        const v = this.numero(no.expr, this.avaliar(no.expr));
        return no.op === '-' ? -v : v;
      }
      case 'Binario': {
        if (no.op === 'E') return this.logico(no.esq) ? this.logico(no.dir) : false; // curto-circuito
        if (no.op === 'OU') return this.logico(no.esq) ? true : this.logico(no.dir);
        return this.aplicarBinario(no, this.avaliar(no.esq), this.avaliar(no.dir));
      }
      case 'Chamada': return this.aplicarChamada(no, no.args.map((a) => this.avaliar(a)));
      default: throw this.erro('Expressão desconhecida.', no);
    }
  }

  /** Versão assíncrona: usada só quando a expressão contém chamada de FUNCAO do aluno. */
  async avaliarA(no) {
    if (!no.temChamada) return this.avaliar(no);
    switch (no.tipo) {
      case 'ChamadaUsuario': return this.executarChamada(no);
      case 'Indice': return this.lerCelula(no, await this.calcularIndices(no));
      case 'Unario': {
        if (no.op === 'NAO') return !(await this.logicoA(no.expr));
        const v = this.numero(no.expr, await this.avaliarA(no.expr));
        return no.op === '-' ? -v : v;
      }
      case 'Binario': {
        if (no.op === 'E') return (await this.logicoA(no.esq)) ? this.logicoA(no.dir) : false;
        if (no.op === 'OU') return (await this.logicoA(no.esq)) ? true : this.logicoA(no.dir);
        const a = await this.avaliarA(no.esq);
        const b = await this.avaliarA(no.dir);
        return this.aplicarBinario(no, a, b);
      }
      case 'Chamada': {
        const args = [];
        for (const a of no.args) args.push(await this.avaliarA(a));
        return this.aplicarChamada(no, args);
      }
      default: throw this.erro('Expressão desconhecida.', no);
    }
  }

  aplicarBinario(no, a, b) {
    switch (no.op) {
      case '=': return a === b;
      case '<>': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
      case '+':
        if (typeof a === 'string') { // texto + texto
          const r = a + b;
          if (r.length > 1000000) throw this.erro('O texto ficou grande demais (mais de 1.000.000 de caracteres).', no);
          return r;
        }
    }
    this.numero(no.esq, a); this.numero(no.dir, b);
    let r;
    switch (no.op) {
      case '+': r = a + b; break;
      case '-': r = a - b; break;
      case '*': r = a * b; break;
      case '^': r = Math.pow(a, b); break;
      case '/': case 'DIV': case 'MOD': {
        if (b === 0) throw this.erro('Divisão por zero.', no);
        r = no.op === '/' ? a / b : no.op === 'DIV' ? Math.trunc(a / b) : a % b;
        break;
      }
      default: throw this.erro(`Operador desconhecido '${no.op}'.`, no);
    }
    if (!Number.isFinite(r)) throw this.erro(`O resultado de '${no.simbolo ?? no.op}' não é um número válido.`, no);
    return r;
  }

  aplicarChamada(no, args) {
    const f = buscarFuncao(no.nome);
    let r;
    try { r = f.fn(...args); } catch (e) { throw this.erro(`Erro em ${no.raw}: ${e.message}`, no); }
    if (typeof r === 'number' && !Number.isFinite(r)) {
      throw this.erro(`${no.raw}(${args.map(formatar).join(', ')}) não resulta em um número válido.`, no);
    }
    return r;
  }
}

module.exports = { Interpretador };
