'use strict';

const { PseudoError } = require('./erros');
const { TIPOS_INFO, ROTULO_ESTATICO } = require('./tipos');
const { buscarFuncao, NOMES_FUNCOES } = require('./funcoes');
const { PALAVRAS_ESTRUTURA } = require('./palavras');
const { sugerir } = require('./sugestoes');

const rot = (t) => ROTULO_ESTATICO[t];

/** Funções cujo resultado costuma ter casas decimais (usado nos avisos de comparação com '='). */
const FUNCOES_REAIS = new Set(['SQRT', 'SEN', 'COS', 'TAN', 'ASEN', 'ACOS', 'ATAN', 'EXP', 'LN', 'LOG', 'GRAUS', 'RADIANOS', 'POW', 'PARA_NUMERO']);

/** Percorre uma árvore (ou lista de nós) chamando cb em cada nó que tem `tipo`. */
function percorrer(no, cb) {
  if (Array.isArray(no)) { for (const x of no) percorrer(x, cb); return; }
  if (!no || typeof no !== 'object') return;
  if (typeof no.tipo === 'string') cb(no);
  for (const k of Object.keys(no)) {
    const v = no[k];
    if (v && typeof v === 'object') percorrer(v, cb);
  }
}

const filhosExpr = (no) => {
  switch (no.tipo) {
    case 'Unario': return [no.expr];
    case 'Binario': return [no.esq, no.dir];
    case 'Chamada': case 'ChamadaUsuario': return no.args;
    case 'Indice': return no.indices;
    default: return [];
  }
};

/**
 * Verificação feita ANTES de executar: variáveis declaradas, tipos compatíveis, condições lógicas,
 * argumentos de funções, uso correto de vetores/constantes/subprogramas.
 * Também coleta AVISOS (não impedem a execução) e os guarda em programa.avisos.
 */
function analisar(programa) {
  const avisos = [];
  const erro = (msg, no) => new PseudoError('Erro de tipo/declaração', msg, no.linha, no.col);
  const aviso = (msg, no) => avisos.push(new PseudoError('Aviso', msg, no.linha, no.col));

  const globais = new Map();   // nome -> info
  const subs = new Map();      // nome -> FUNCAO / PROCEDIMENTO
  const todasInfos = [];       // para os avisos de variáveis sem uso
  let local = null;            // escopo do subprograma atual (null = programa principal)
  let subAtual = null;
  let profLaco = 0;

  const procurar = (nome) => (local && local.get(nome)) || globais.get(nome);

  function achar(no) {
    const info = procurar(no.nome);
    if (!info) {
      const nomes = [...(local ? local.values() : []), ...globais.values()].map((i) => i.raw);
      const s = sugerir(no.raw, nomes);
      throw erro(`A variável '${no.raw}' não foi declarada.${s ? ` Você quis dizer '${s}'?` : ' Declare-a com DECLARE antes do INICIO.'}`, no);
    }
    return info;
  }

  // ---------- subprogramas (registrados antes, para permitir chamadas em qualquer ordem) ----------
  for (const s of programa.funcoes) {
    if (subs.has(s.nome)) throw erro(`Já existe uma função/procedimento chamado '${s.raw}'.`, s);
    subs.set(s.nome, s);
  }

  // ---------- expressões ----------
  const ehConstante = (no) => {
    switch (no.tipo) {
      case 'Num': case 'Str': case 'Bool': return true;
      case 'Var': { const i = procurar(no.nome); return !!i && i.constante; }
      case 'Unario': return ehConstante(no.expr);
      case 'Binario': return ehConstante(no.esq) && ehConstante(no.dir);
      case 'Chamada': return no.nome !== 'ALEATORIO' && no.args.every(ehConstante);
      default: return false;
    }
  };

  function ehReal(no) {
    switch (no.tipo) {
      case 'Num': return !Number.isInteger(no.valor);
      case 'Var': case 'Indice': { const i = procurar(no.nome); return !!i && i.tipo === 'NUMERICO'; }
      case 'Unario': return ehReal(no.expr);
      case 'Binario':
        if (no.op === '/') return true;
        return ['+', '-', '*', '^'].includes(no.op) && (ehReal(no.esq) || ehReal(no.dir));
      case 'Chamada': return FUNCOES_REAIS.has(no.nome);
      case 'ChamadaUsuario': { const s = subs.get(no.nome); return !!s && s.retorno === 'NUMERICO'; }
      default: return false;
    }
  }
  /** Só avisa quando o número vem de um cálculo (ou literal decimal), não de uma variável simples. */
  function suspeitoReal(no) {
    switch (no.tipo) {
      case 'Num': return !Number.isInteger(no.valor);
      case 'Unario': return suspeitoReal(no.expr);
      case 'Var': case 'Indice': return false;
      default: return ehReal(no);
    }
  }

  function descreverColecao(info, raw) {
    return info.rank === 1 ? `um VETOR (use ${raw}[posição])` : `uma MATRIZ (use ${raw}[linha][coluna])`;
  }

  function verificarIndices(no, info) {
    if (info.rank === 0) throw erro(`'${no.raw}' não é um VETOR nem uma MATRIZ, então não aceita índice.`, no);
    if (no.indices.length !== info.rank) {
      throw erro(`'${no.raw}' tem ${info.rank} dimensão(ões), mas foram informados ${no.indices.length} índice(s).`, no);
    }
    for (const e of no.indices) {
      if (inferir(e) !== 'numero') throw erro('O índice de um vetor/matriz deve ser um número inteiro.', e);
    }
  }

  function inferir(no) {
    const t = inferirTipo(no);
    no.temChamada = no.tipo === 'ChamadaUsuario' || filhosExpr(no).some((f) => f.temChamada);
    return t;
  }

  function inferirTipo(no) {
    switch (no.tipo) {
      case 'Num': return 'numero';
      case 'Str': return 'texto';
      case 'Bool': return 'logico';
      case 'Var': {
        const info = achar(no);
        if (info.rank > 0) throw erro(`'${no.raw}' é ${descreverColecao(info, no.raw)}: informe a posição.`, no);
        info.usada = true;
        if (!info.leitura) info.leitura = no;
        return TIPOS_INFO[info.tipo].estatico;
      }
      case 'Indice': {
        const info = achar(no);
        verificarIndices(no, info);
        info.usada = true;
        if (!info.leitura) info.leitura = no;
        return TIPOS_INFO[info.tipo].estatico;
      }
      case 'Unario': {
        const t = inferir(no.expr);
        const esperado = no.op === 'NAO' ? 'logico' : 'numero';
        if (t !== esperado) throw erro(`O operador ${no.op} espera um valor ${rot(esperado)}, mas recebeu ${rot(t)}.`, no);
        return esperado;
      }
      case 'Binario': return inferirBinario(no);
      case 'Chamada': return inferirChamada(no);
      case 'ChamadaUsuario': return chamarUsuario(no, true);
      default: throw erro('Expressão desconhecida.', no);
    }
  }

  function inferirBinario(no) {
    const a = inferir(no.esq);
    const b = inferir(no.dir);
    const ambos = `(encontrado: ${rot(a)} e ${rot(b)})`;
    switch (no.op) {
      case '+':
        if (a === 'numero' && b === 'numero') return 'numero';
        if (a === 'texto' && b === 'texto') return 'texto';
        throw erro(`O operador '+' só funciona entre dois números ou entre dois textos ${ambos}. Use PARA_TEXTO() para converter.`, no);
      case '-': case '*': case '^':
        if (a === 'numero' && b === 'numero') return 'numero';
        throw erro(`O operador '${no.simbolo ?? no.op}' só funciona entre números ${ambos}.`, no);
      case '/': case 'DIV': case 'MOD':
        if (a === 'numero' && b === 'numero') {
          if (no.dir.tipo === 'Num' && no.dir.valor === 0) aviso('Divisão por zero: o programa vai parar com erro ao executar esta conta.', no);
          return 'numero';
        }
        throw erro(`O operador '${no.op}' só funciona entre números ${ambos}.`, no);
      case '=': case '<>':
        if (a !== b) throw erro(`Não é possível comparar valores de tipos diferentes com '${no.op}' ${ambos}.`, no);
        if (a === 'numero' && (suspeitoReal(no.esq) || suspeitoReal(no.dir))) {
          aviso(`Cuidado: comparar números com casas decimais usando '${no.op}' pode falhar por causa de arredondamento (ex.: 0.1 + 0.2 não é exatamente 0.3). Prefira comparar a diferença: ABS(A - B) < 0.0001.`, no);
        }
        return 'logico';
      case '<': case '>': case '<=': case '>=':
        if (a === b && a !== 'logico') return 'logico';
        throw erro(`O operador '${no.op}' compara dois números ou dois textos ${ambos}.`, no);
      case 'E': case 'OU':
        if (a === 'logico' && b === 'logico') return 'logico';
        throw erro(`O operador ${no.op} só funciona entre valores lógicos (condições) ${ambos}. Dica: use parênteses, ex.: (A > 1) ${no.op} (B < 5).`, no);
      default: throw erro(`Operador desconhecido '${no.op}'.`, no);
    }
  }

  function inferirChamada(no) {
    const f = buscarFuncao(no.nome);
    const min = f.min ?? f.params.length;
    const max = f.variadico ? Infinity : f.params.length;
    if (no.args.length < min || no.args.length > max) {
      const qtd = min === max ? `${min}` : max === Infinity ? `pelo menos ${min}` : `de ${min} a ${max}`;
      throw erro(`A função ${no.raw} espera ${qtd} argumento(s), mas recebeu ${no.args.length}.`, no);
    }
    no.args.forEach((arg, i) => {
      const esperado = f.params[Math.min(i, f.params.length - 1)];
      const t = inferir(arg);
      if (esperado !== 'qualquer' && t !== esperado) {
        throw erro(`O argumento ${i + 1} de ${no.raw} deve ser ${rot(esperado)}, mas recebeu ${rot(t)}.`, arg);
      }
    });
    return f.retorno;
  }

  /** Chamada de FUNCAO (comoExpressao = true) ou PROCEDIMENTO (false) escrita pelo aluno. */
  function chamarUsuario(no, comoExpressao) {
    const def = subs.get(no.nome);
    if (!def) {
      const candidatos = [...[...subs.values()].map((s) => s.raw), ...NOMES_FUNCOES, ...PALAVRAS_ESTRUTURA];
      const s = sugerir(no.raw, candidatos);
      throw erro(`'${no.raw}' não é uma função, um procedimento nem um comando conhecido.${s ? ` Você quis dizer ${s}?` : ''}`, no);
    }
    if (comoExpressao && def.tipo === 'Procedimento') {
      throw erro(`'${def.raw}' é um PROCEDIMENTO e não devolve valor. Chame-o como comando: ${def.raw}(...);`, no);
    }
    if (!comoExpressao && def.tipo === 'Funcao') {
      throw erro(`'${def.raw}' é uma FUNCAO: o valor que ela devolve precisa ser usado (ex.: X <- ${def.raw}(...);).`, no);
    }
    if (no.args.length !== def.params.length) {
      throw erro(`'${def.raw}' espera ${def.params.length} argumento(s), mas recebeu ${no.args.length}.`, no);
    }
    def.params.forEach((p, i) => {
      const arg = no.args[i];
      if (p.rank > 0) {
        const info = arg.tipo === 'Var' ? achar(arg) : null;
        if (!info || info.rank !== p.rank || info.tipo !== p.tipo) {
          throw erro(`O argumento ${i + 1} de ${def.raw} deve ser ${p.rank === 1 ? 'um VETOR' : 'uma MATRIZ'} DE ${p.tipo} (informe só o nome, sem índice).`, arg);
        }
        info.usada = true;
        info.atribuida = true; // o subprograma pode alterar o conteúdo (passagem por referência)
      } else {
        const t = inferir(arg);
        const esperado = TIPOS_INFO[p.tipo].estatico;
        if (t !== esperado) {
          throw erro(`O argumento ${i + 1} de ${def.raw} deve ser ${p.tipo}, mas recebeu um valor ${rot(t)}.`, arg);
        }
      }
    });
    return def.retorno ? TIPOS_INFO[def.retorno].estatico : null;
  }

  function exigir(no, esperado, contexto) {
    const t = inferir(no);
    if (t !== esperado) throw erro(`${contexto} deve ser ${rot(esperado)}, mas aqui é ${rot(t)}.`, no);
  }

  // ---------- declarações ----------
  function validarDimensao(e) {
    if (!ehConstante(e)) throw erro('O tamanho de um VETOR/MATRIZ deve ser um número inteiro fixo ou uma CONSTANTE (não pode ser uma variável).', e);
    if (inferir(e) !== 'numero') throw erro('O tamanho de um VETOR/MATRIZ deve ser um número inteiro.', e);
    if (e.tipo === 'Num' && (!Number.isInteger(e.valor) || e.valor < 1)) throw erro('O tamanho de um VETOR/MATRIZ deve ser um inteiro maior que zero.', e);
  }

  function declarar(decls, mapa) {
    for (const d of decls) {
      if (d.constante) {
        if (!ehConstante(d.valor)) throw erro('O valor de uma CONSTANTE deve ser um número, texto, lógico ou uma conta feita só com outras constantes.', d.valor);
        const t = inferir(d.valor);
        if (t !== TIPOS_INFO[d.tipo].estatico) {
          throw erro(`A constante '${d.nomes[0].raw}' é do tipo ${d.tipo} e não aceita um valor ${rot(t)}.`, d.nomes[0]);
        }
      }
      if (d.rank > 0) d.dims.forEach(validarDimensao);
      for (const n of d.nomes) {
        if (mapa.has(n.nome)) throw erro(`A variável '${n.raw}' já foi declarada.`, n);
        if (subs.has(n.nome)) throw erro(`'${n.raw}' já é o nome de uma função/procedimento.`, n);
        const info = {
          nome: n.nome, raw: n.raw, tipo: d.tipo, rank: d.rank || 0, constante: !!d.constante,
          linha: n.linha, col: n.col, usada: false, atribuida: !!d.constante, leitura: null, parametro: false,
        };
        mapa.set(n.nome, info);
        todasInfos.push(info);
      }
    }
  }

  // ---------- comandos ----------
  function validarAlvo(no) {
    const info = achar(no);
    if (info.constante) throw erro(`'${no.raw}' é uma CONSTANTE e não pode receber outro valor.`, no);
    if (no.tipo === 'Var') {
      if (info.rank > 0) throw erro(`'${no.raw}' é ${descreverColecao(info, no.raw)}: informe a posição.`, no);
    } else {
      verificarIndices(no, info);
      no.temChamada = no.indices.some((i) => i.temChamada);
    }
    info.atribuida = true;
    return info;
  }

  function avisarLaco(no, cond, corpo, ehRepita) {
    const nomes = new Map();
    let condChamada = false;
    percorrer(cond, (n) => {
      if (n.tipo === 'Var' || n.tipo === 'Indice') nomes.set(n.nome, n.raw);
      if (n.tipo === 'ChamadaUsuario') condChamada = true;
    });
    if (condChamada) return;
    const escritas = new Set();
    let sai = false, chamada = false;
    percorrer(corpo, (n) => {
      if (n.tipo === 'Atribuicao') escritas.add(n.alvo.nome);
      else if (n.tipo === 'Leia') n.vars.forEach((v) => escritas.add(v.nome));
      else if (n.tipo === 'Para') escritas.add(n.var.nome);
      else if (n.tipo === 'Interrompa' || n.tipo === 'Retorne') sai = true;
      else if (n.tipo === 'ChamadaProc' || n.tipo === 'ChamadaUsuario') chamada = true;
    });
    if (sai || chamada) return;
    if (cond.tipo === 'Bool') {
      if (cond.valor === !ehRepita) aviso('Esta condição é sempre a mesma e não há INTERROMPA no laço: ele nunca vai terminar.', no);
      return;
    }
    if (nomes.size > 0 && [...nomes.keys()].every((n) => !escritas.has(n))) {
      aviso(`A condição usa ${[...nomes.values()].join(', ')}, mas nenhuma dessas variáveis é alterada dentro do laço: ele pode nunca terminar.`, no);
    }
  }

  function verificar(lista) { for (const c of lista) comando(c); }

  function comando(c) {
    switch (c.tipo) {
      case 'Escreva': c.args.forEach(inferir); break;
      case 'Leia': c.vars.forEach(validarAlvo); break;
      case 'Atribuicao': {
        const info = validarAlvo(c.alvo);
        const t = inferir(c.valor);
        if (t !== TIPOS_INFO[info.tipo].estatico) {
          throw erro(`A variável '${c.alvo.raw}' é do tipo ${info.tipo} e não aceita um valor ${rot(t)}.`, c.alvo);
        }
        if (info.tipo === 'INTEIRO' && c.valor.tipo === 'Binario' && c.valor.op === '/') {
          aviso(`A divisão '/' pode resultar em número com casas decimais, que uma variável INTEIRO não aceita. Use DIV (divisão inteira) ou TRUNC().`, c.valor);
        }
        break;
      }
      case 'Se':
        for (const r of c.ramos) { exigir(r.cond, 'logico', 'A condição do SE'); verificar(r.corpo); }
        if (c.senao) verificar(c.senao);
        break;
      case 'Escolha': {
        const t = inferir(c.expr);
        if (t === 'logico') throw erro('O ESCOLHA trabalha com números ou textos, não com valores lógicos.', c.expr);
        const confere = (no) => exigir(no, t, 'Os valores do CASO precisam ser do mesmo tipo do ESCOLHA, ou seja,');
        for (const caso of c.casos) {
          for (const v of caso.valores) { if (v.faixa) { confere(v.de); confere(v.ate); } else confere(v.valor); }
          verificar(caso.corpo);
        }
        if (c.padrao) verificar(c.padrao);
        break;
      }
      case 'Enquanto':
        exigir(c.cond, 'logico', 'A condição do ENQUANTO');
        avisarLaco(c, c.cond, c.corpo, false);
        profLaco++; verificar(c.corpo); profLaco--;
        break;
      case 'Repita':
        profLaco++; verificar(c.corpo); profLaco--;
        exigir(c.cond, 'logico', 'A condição do ATE');
        avisarLaco(c, c.cond, c.corpo, true);
        break;
      case 'Para': {
        const info = achar(c.var);
        if (info.constante) throw erro(`'${c.var.raw}' é uma CONSTANTE e não pode ser a variável do PARA.`, c.var);
        if (info.rank > 0 || TIPOS_INFO[info.tipo].estatico !== 'numero') throw erro(`A variável '${c.var.raw}' do PARA precisa ser INTEIRO ou NUMERICO.`, c.var);
        info.atribuida = true;
        info.usada = true;
        exigir(c.inicio, 'numero', 'O valor inicial do PARA');
        exigir(c.fim, 'numero', 'O valor final do PARA');
        if (c.passo) exigir(c.passo, 'numero', 'O PASSO do PARA');
        profLaco++; verificar(c.corpo); profLaco--;
        break;
      }
      case 'Bloco': verificar(c.corpo); break;
      case 'ChamadaProc': chamarUsuario(c.chamada, false); break;
      case 'Interrompa': case 'Continue':
        if (profLaco === 0) throw erro(`${c.tipo === 'Interrompa' ? 'INTERROMPA' : 'CONTINUE'} só pode ser usado dentro de um laço (ENQUANTO, REPITA ou PARA).`, c);
        break;
      case 'Retorne':
        if (!subAtual) throw erro('RETORNE só pode ser usado dentro de uma FUNCAO ou de um PROCEDIMENTO.', c);
        if (subAtual.tipo === 'Funcao') {
          if (!c.valor) throw erro(`A função '${subAtual.raw}' precisa devolver um valor: RETORNE valor;`, c);
          const t = inferir(c.valor);
          if (t !== TIPOS_INFO[subAtual.retorno].estatico) {
            throw erro(`A função '${subAtual.raw}' devolve ${subAtual.retorno}, mas aqui o valor é ${rot(t)}.`, c.valor);
          }
        } else if (c.valor) {
          throw erro(`O procedimento '${subAtual.raw}' não devolve valor: use apenas RETORNE;`, c);
        }
        break;
      default: throw erro('Comando desconhecido.', c);
    }
  }

  // ---------- execução da análise ----------
  declarar(programa.decls, globais);

  for (const s of programa.funcoes) {
    const mapa = new Map();
    local = mapa; subAtual = s; profLaco = 0;
    for (const p of s.params) {
      if (mapa.has(p.nome.nome)) throw erro(`O parâmetro '${p.nome.raw}' foi repetido.`, p.nome);
      mapa.set(p.nome.nome, {
        nome: p.nome.nome, raw: p.nome.raw, tipo: p.tipo, rank: p.rank, constante: false,
        usada: true, atribuida: true, leitura: null, parametro: true, linha: p.nome.linha, col: p.nome.col,
      });
    }
    declarar(s.decls, mapa);
    verificar(s.corpo);
    if (s.tipo === 'Funcao') {
      let achou = false;
      percorrer(s.corpo, (n) => { if (n.tipo === 'Retorne') achou = true; });
      if (!achou) throw erro(`A função '${s.raw}' precisa ter pelo menos um RETORNE.`, s);
    }
    local = null; subAtual = null;
  }

  verificar(programa.corpo);

  // ---------- avisos sobre variáveis ----------
  for (const info of todasInfos) {
    if (info.parametro) continue;
    const [art, quem] = info.constante ? ['A', 'constante']
      : info.rank === 1 ? ['O', 'vetor'] : info.rank === 2 ? ['A', 'matriz'] : ['A', 'variável'];
    if (!info.usada) {
      aviso(info.atribuida && !info.constante
        ? `${art} ${quem} '${info.raw}' recebe valores, mas o conteúdo nunca é usado.`
        : `${art} ${quem} '${info.raw}' foi ${art === 'O' ? 'declarado' : 'declarada'}, mas nunca é ${art === 'O' ? 'usado' : 'usada'}.`, info);
    } else if (info.leitura && !info.atribuida) {
      aviso(`${art} ${quem} '${info.raw}' é ${art === 'O' ? 'usado' : 'usada'} aqui, mas nunca recebe valor no programa (falta LEIA ou atribuição '<-').`, info.leitura);
    }
  }

  avisos.sort((a, b) => a.linha - b.linha || a.coluna - b.coluna);
  programa.avisos = avisos;
  return avisos;
}

module.exports = { analisar };
