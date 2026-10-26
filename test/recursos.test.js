'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { compilar } = require('../src');
const { rodar, falha, prog } = require('./helpers');

const avisosDe = (src) => compilar(src).avisos.map((a) => a.message);

// ---------- vetores e matrizes ----------
test('vetor: LEIA, atribuição, leitura e soma com PARA', async () => {
  const src = prog('DECLARE V : VETOR[3] DE INTEIRO; I, S : INTEIRO;', `
    S <- 0;
    PARA I DE 1 ATE 3 FACA LEIA(V[I]); S <- S + V[I]; FIMPARA
    ESCREVA(S, V[1], V[3]);`);
  assert.strictEqual(await rodar(src, [4, 5, 6]), '15 4 6\n');
});

test('matriz: M[i][j] e M[i, j] são equivalentes', async () => {
  const src = prog('DECLARE M : MATRIZ[2][3] DE INTEIRO; I, J : INTEIRO;', `
    PARA I DE 1 ATE 2 FACA PARA J DE 1 ATE 3 FACA M[I][J] <- I * 10 + J; FIMPARA FIMPARA
    ESCREVA(M[2][3], M[2, 3], M[1, 1]);`);
  assert.strictEqual(await rodar(src), '23 23 11\n');
});

test('MATRIZ[2, 3] com vírgula na declaração', async () => {
  const src = prog('DECLARE M : MATRIZ[2, 3] DE INTEIRO;', 'M[2, 3] <- 9; ESCREVA(M[2][3]);');
  assert.strictEqual(await rodar(src), '9\n');
});

test('índice fora dos limites e posição sem valor', async () => {
  const d = 'DECLARE V : VETOR[3] DE INTEIRO;';
  assert.match((await falha(prog(d, 'V[4] <- 1;'))).message, /fora dos limites.*1 a 3/);
  assert.match((await falha(prog(d, 'V[0] <- 1;'))).message, /fora dos limites/);
  assert.match((await falha(prog(d, 'ESCREVA(V[2]);'))).message, /antes de receber um valor/);
  assert.match((await falha(prog(d, 'V[1.5] <- 1;'))).message, /inteiro/);
});

test('vetor: erros de uso', async () => {
  const d = 'DECLARE V : VETOR[3] DE INTEIRO; X : INTEIRO;';
  assert.match((await falha(prog(d, 'V <- 1;'))).message, /informe a posição/);
  assert.match((await falha(prog(d, 'X[1] <- 1;'))).message, /não é um VETOR/);
  assert.match((await falha(prog(d, 'V[1][2] <- 1;'))).message, /dimensão/);
  assert.match((await falha(prog(d, 'V[1] <- "a";'))).message, /não aceita um valor texto/);
  assert.match((await falha(prog(d, 'V["a"] <- 1;'))).message, /índice/);
});

test('tamanho do vetor deve ser fixo (literal ou CONSTANTE)', async () => {
  assert.match((await falha(prog('DECLARE N : INTEIRO; V : VETOR[N] DE INTEIRO;', ''))).message, /fixo ou uma CONSTANTE/);
  assert.match((await falha(prog('DECLARE V : VETOR[0] DE INTEIRO;', ''))).message, /maior que zero/);
  assert.match((await falha(prog('DECLARE V : VETOR DE INTEIRO;', ''))).message, /precisa do tamanho/);
  assert.match((await falha(prog('DECLARE V : VETOR[2][2] DE INTEIRO;', ''))).message, /uma dimensão/);
});

// ---------- constantes ----------
test('CONSTANTE: valor, uso em tamanho de vetor e proteção contra alteração', async () => {
  const src = prog('CONSTANTE N : INTEIRO <- 3;\nCONSTANTE DOBRO : INTEIRO <- N * 2;\nDECLARE V : VETOR[N] DE INTEIRO;', 'V[N] <- DOBRO; ESCREVA(V[3], N);');
  assert.strictEqual(await rodar(src), '6 3\n');
  assert.match((await falha(prog('CONSTANTE N : INTEIRO <- 3;', 'N <- 4;'))).message, /CONSTANTE/);
  assert.match((await falha(prog('CONSTANTE N : INTEIRO <- 3;', 'LEIA(N);'))).message, /CONSTANTE/);
  assert.match((await falha(prog('CONSTANTE N : INTEIRO <- "a";', ''))).message, /não aceita um valor texto/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;\nCONSTANTE N : INTEIRO <- X;', ''))).message, /CONSTANTE/);
});

// ---------- potência: ^ e ** ----------
test('** é potência, igual a ^ (precedência e associação à direita)', async () => {
  const src = prog('DECLARE A, B : NUMERICO;', `
    A <- 3; B <- 4;
    ESCREVA(2 ** 3, 2**3, 2 ^ 3, 2 ** 3 ** 2, 2 ^ 3 ** 2, 2 ** 3 ^ 2);
    ESCREVA(-2 ** 2, (-2) ** 2, 2 ** -1, 2 * 3 ** 2, 2 ** 3 * 2, 10 - 2 ** 2);
    ESCREVA(SQRT(A ** 2 + B ** 2), A ** 2 + B ** 2, 2 ** 0.5 > 1.41);`);
  assert.strictEqual(await rodar(src), '8 8 8 512 512 512\n-4 4 0.5 18 16 6\n5 25 VERDADEIRO\n');
});

test('o * simples e as formas compostas continuam funcionando', async () => {
  const src = prog('DECLARE X : NUMERICO;', 'X <- 3 * 2; X *= 2; X <- X *2; ESCREVA(X, 6*7, 2 * 3 ** 2);');
  assert.strictEqual(await rodar(src), '24 42 18\n');
});

test('erros de ** mostram o símbolo escrito pelo aluno', async () => {
  const d = 'DECLARE T : CARACTERES; N : NUMERICO;';
  assert.match((await falha(prog(d, 'N <- 2 ** T;'))).message, /operador '\*\*'/);
  assert.match((await falha(prog(d, 'N <- 2 ^ T;'))).message, /operador '\^'/);
  assert.match((await falha(prog(d, 'N <- 10 ** 400;'))).message, /'\*\*'.*não é um número válido/);
  assert.match((await falha(prog(d, 'N <- 2 ** ;'))).message, /Esperava um valor/);
});

test('/** ... **/ em comentário de bloco não confunde o ** do lexer', async () => {
  const src = prog('DECLARE X : INTEIRO;', '/** comentário **/ X <- 2 ** 2; /* ** */ ESCREVA(X);');
  assert.strictEqual(await rodar(src), '4\n');
});

// ---------- funções e procedimentos ----------
const FUNCOES = `
FUNCAO FAT(N : INTEIRO) : INTEIRO
INICIO
    SE (N <= 1) ENTAO RETORNE 1; FIMSE
    RETORNE N * FAT(N - 1);
FIMFUNCAO
FUNCAO SOMA(A : NUMERICO, B : NUMERICO) : NUMERICO
INICIO RETORNE A + B; FIMFUNCAO
PROCEDIMENTO SAUDAR(NOME : CARACTERES)
INICIO ESCREVA("Olá,", NOME); FIMPROCEDIMENTO
PROCEDIMENTO PREENCHER(V : VETOR DE INTEIRO, N : INTEIRO)
    DECLARE K : INTEIRO;
INICIO PARA K DE 1 ATE N FACA V[K] <- K * K; FIMPARA FIMPROCEDIMENTO
`;

test('função recursiva, função com 2 parâmetros e procedimento', async () => {
  const src = prog('DECLARE R : INTEIRO;', 'R <- FAT(5); ESCREVA(R, SOMA(1.5, 2), FAT(3) + FAT(2)); SAUDAR("Ana");', FUNCOES);
  assert.strictEqual(await rodar(src), '120 3.5 8\nOlá, Ana\n');
});

test('vetor é passado por referência; escalar é passado por valor', async () => {
  const src = prog('DECLARE V : VETOR[3] DE INTEIRO;', 'PREENCHER(V, 3); ESCREVA(V[1], V[2], V[3]);', FUNCOES);
  assert.strictEqual(await rodar(src), '1 4 9\n');
  const porValor = prog('DECLARE X : INTEIRO;', 'X <- 5; MUDAR(X); ESCREVA(X);', `
PROCEDIMENTO MUDAR(A : INTEIRO)
INICIO A <- 99; FIMPROCEDIMENTO`);
  assert.strictEqual(await rodar(porValor), '5\n');
});

test('variáveis locais não vazam e globais podem ser lidas', async () => {
  const extra = `
FUNCAO USA_GLOBAL() : INTEIRO
    DECLARE LOCAL : INTEIRO;
INICIO LOCAL <- G * 2; RETORNE LOCAL; FIMFUNCAO`;
  assert.strictEqual(await rodar(prog('DECLARE G : INTEIRO;', 'G <- 4; ESCREVA(USA_GLOBAL());', extra)), '8\n');
  assert.match((await falha(prog('DECLARE G : INTEIRO;', 'G <- 4; ESCREVA(LOCAL);', extra))).message, /não foi declarada/);
});

test('LEIA dentro de função', async () => {
  const extra = `
FUNCAO PERGUNTA() : INTEIRO
    DECLARE N : INTEIRO;
INICIO LEIA(N); RETORNE N; FIMFUNCAO`;
  assert.strictEqual(await rodar(prog('DECLARE R : INTEIRO;', 'R <- PERGUNTA() + PERGUNTA(); ESCREVA(R);', extra), [3, 4]), '7\n');
});

test('erros de função e procedimento', async () => {
  const d = 'DECLARE R : INTEIRO;';
  assert.match((await falha(prog(d, 'R <- FAT(1, 2);', FUNCOES))).message, /espera 1 argumento/);
  assert.match((await falha(prog(d, 'R <- FAT("a");', FUNCOES))).message, /deve ser INTEIRO/);
  assert.match((await falha(prog(d, 'R <- SAUDAR("a");', FUNCOES))).message, /PROCEDIMENTO/);
  assert.match((await falha(prog(d, 'FAT(3);', FUNCOES))).message, /FUNCAO/);
  assert.match((await falha(prog(d, 'RETORNE 1;'))).message, /dentro de uma FUNCAO/);
  assert.match((await falha(prog(d, 'R <- FAT(2.5);', FUNCOES))).message, /deve ser INTEIRO|INTEIRO/);
  assert.match((await falha(prog(d, 'PREENCHER(R, 3);', FUNCOES))).message, /VETOR/);
  assert.match((await falha(prog(d, 'ESCREVA(1);', 'FUNCAO F() : INTEIRO\nINICIO ESCREVA(1); FIMFUNCAO'))).message, /RETORNE/);
  assert.match((await falha(prog(d, 'ESCREVA(1);', 'FUNCAO F() : INTEIRO\nINICIO RETORNE "a"; FIMFUNCAO'))).message, /devolve INTEIRO/);
});

test('recursão infinita é interrompida com mensagem clara', async () => {
  const extra = 'FUNCAO F(N : INTEIRO) : INTEIRO\nINICIO RETORNE F(N + 1); FIMFUNCAO';
  assert.match((await falha(prog('DECLARE R : INTEIRO;', 'R <- F(1);', extra))).message, /condição de parada/);
});

test('nome de função não pode ser palavra reservada nem repetido', async () => {
  assert.match((await falha(prog('DECLARE X : INTEIRO;', '', 'PROCEDIMENTO SE()\nINICIO FIMPROCEDIMENTO'))).message, /palavra reservada/);
  const dup = 'PROCEDIMENTO A()\nINICIO ESCREVA(1); FIMPROCEDIMENTO\nPROCEDIMENTO A()\nINICIO ESCREVA(2); FIMPROCEDIMENTO';
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'A();', dup))).message, /Já existe/);
});

// ---------- INTERROMPA / CONTINUE ----------
test('INTERROMPA e CONTINUE em ENQUANTO, REPITA e PARA', async () => {
  const a = prog('DECLARE I : INTEIRO;', `I <- 0;
    ENQUANTO (VERDADEIRO) FACA I++; SE (I = 3) ENTAO CONTINUE; FIMSE SE (I > 5) ENTAO INTERROMPA; FIMSE ESCREVA(I); FIMENQUANTO`);
  assert.strictEqual(await rodar(a), '1\n2\n4\n5\n');
  const b = prog('DECLARE I : INTEIRO;', `I <- 0;
    REPITA I++; SE (I = 2) ENTAO CONTINUE; FIMSE ESCREVA(I); SE (I = 4) ENTAO INTERROMPA; FIMSE ATE(I >= 10);`);
  assert.strictEqual(await rodar(b), '1\n3\n4\n');
  const c = prog('DECLARE I : INTEIRO;', 'PARA I DE 1 ATE 10 FACA SE (I MOD 2 = 0) ENTAO CONTINUE; FIMSE SE (I > 7) ENTAO INTERROMPA; FIMSE ESCREVA(I); FIMPARA');
  assert.strictEqual(await rodar(c), '1\n3\n5\n7\n');
});

test('INTERROMPA só sai do laço mais interno; RETORNE sai de laços dentro da função', async () => {
  const src = prog('DECLARE I, J : INTEIRO;', `
    PARA I DE 1 ATE 2 FACA PARA J DE 1 ATE 3 FACA SE (J = 2) ENTAO INTERROMPA; FIMSE ESCREVA(I, J); FIMPARA FIMPARA
    ESCREVA(ACHAR(7));`, `
FUNCAO ACHAR(X : INTEIRO) : INTEIRO
    DECLARE K : INTEIRO;
INICIO PARA K DE 1 ATE 100 FACA SE (K * K > X) ENTAO RETORNE K; FIMSE FIMPARA RETORNE 0; FIMFUNCAO`);
  assert.strictEqual(await rodar(src), '1 1\n2 1\n3\n');
});

test('INTERROMPA/CONTINUE fora de laço é erro', async () => {
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'INTERROMPA;'))).message, /dentro de um laço/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'CONTINUE;'))).message, /dentro de um laço/);
});

// ---------- saída ----------
test('ESCREVA_SEM_QUEBRA mantém a mesma linha para o LEIA', async () => {
  const src = prog('DECLARE N : INTEIRO;', 'ESCREVA_SEM_QUEBRA("Digite:", 1); ESCREVA_SEM_QUEBRA(" "); ESCREVA(2);');
  assert.strictEqual(await rodar(src), 'Digite: 1 2\n');
});

test('FORMATAR fixa as casas decimais', async () => {
  const src = prog('DECLARE X : NUMERICO;', 'X <- 3.14159; ESCREVA(FORMATAR(X, 2), FORMATAR(2, 3), FORMATAR(1.005, 2), FORMATAR(2.5, 0));');
  assert.strictEqual(await rodar(src), '3.14 2.000 1.01 3\n');
  assert.match((await falha(prog('DECLARE X : NUMERICO;', 'ESCREVA(FORMATAR(1, -1));'))).message, /casas decimais/);
});

// ---------- sugestões ----------
test('"Você quis dizer?" para palavras e variáveis parecidas', async () => {
  const d = 'DECLARE NOTA, A : INTEIRO;';
  assert.match((await falha(prog(d, 'SE (A > 1) ETNAO ESCREVA(1); FIMSE'))).message, /Você quis dizer ENTAO/);
  assert.match((await falha(prog(d, 'FIMSEE'))).message, /Você quis dizer FIMSE/);
  assert.match((await falha(prog(d, 'ESCRVA("oi");'))).message, /Você quis dizer ESCREVA/);
  assert.match((await falha(prog(d, 'NOTAA <- 1;'))).message, /Você quis dizer 'NOTA'/);
  assert.match((await falha('ALGORITMO T:\nDECLAR X : INTEIRO;\nINICIO\nFIMALGORITMO')).message, /Você quis dizer DECLARE/);
  assert.match((await falha('ALGORITMO T:\nDECLARE X : INTEIR;\nINICIO\nFIMALGORITMO')).message, /Você quis dizer INTEIRO/);
});

// ---------- avisos ----------
test('aviso: comparar números reais com =', () => {
  const a = avisosDe(prog('DECLARE A : NUMERICO;', 'A <- 0.1 + 0.2; SE (A = 0.3) ENTAO ESCREVA(A); FIMSE'));
  assert.ok(a.some((m) => /arredondamento/.test(m)));
  // variável simples contra inteiro não gera aviso
  const b = avisosDe(prog('DECLARE A : NUMERICO;', 'LEIA(A); SE (A = 10) ENTAO ESCREVA(A); FIMSE'));
  assert.ok(!b.some((m) => /arredondamento/.test(m)));
});

test('avisos: variável sem uso, sem valor, atribuída e nunca usada', () => {
  const a = avisosDe(prog('DECLARE A, B, C, D : INTEIRO; V : VETOR[2] DE INTEIRO;', 'A <- 1; ESCREVA(A, B); C <- 2;'));
  assert.ok(a.some((m) => /'D' foi declarada, mas nunca é usada/.test(m)));
  assert.ok(a.some((m) => /'B' é usada aqui, mas nunca recebe valor/.test(m)));
  assert.ok(a.some((m) => /'C' recebe valores, mas o conteúdo nunca é usado/.test(m)));
  assert.ok(a.some((m) => /O vetor 'V' foi declarado, mas nunca é usado/.test(m)));
  assert.ok(!a.some((m) => /'A'/.test(m)));
});

test('avisos: laço cuja condição nunca muda, divisão por zero e / em INTEIRO', () => {
  const a = avisosDe(prog('DECLARE I, K : INTEIRO;', 'I <- 1; ENQUANTO (I <= 3) FACA ESCREVA(I); FIMENQUANTO'));
  assert.ok(a.some((m) => /nenhuma dessas variáveis é alterada/.test(m)));
  const ok = avisosDe(prog('DECLARE I : INTEIRO;', 'I <- 1; ENQUANTO (I <= 3) FACA ESCREVA(I); I++; FIMENQUANTO'));
  assert.ok(!ok.some((m) => /alterada/.test(m)));
  const v = avisosDe(prog('DECLARE I : INTEIRO;', 'I <- 1; ENQUANTO (VERDADEIRO) FACA ESCREVA(I); FIMENQUANTO'));
  assert.ok(v.some((m) => /nunca vai terminar/.test(m)));
  const sai = avisosDe(prog('DECLARE I : INTEIRO;', 'I <- 1; ENQUANTO (VERDADEIRO) FACA ESCREVA(I); INTERROMPA; FIMENQUANTO'));
  assert.ok(!sai.some((m) => /nunca vai terminar/.test(m)));
  const d = avisosDe(prog('DECLARE K : INTEIRO;', 'K <- 7 / 2; K <- 4 / 0; ESCREVA(K);'));
  assert.ok(d.some((m) => /Divisão por zero/.test(m)));
  assert.ok(d.some((m) => /DIV/.test(m)));
});

test('avisos não impedem a execução e podem ser silenciados', async () => {
  const src = prog('DECLARE A, SOBRA : INTEIRO;', 'A <- 1; ESCREVA(A);');
  const avisos = [];
  const saida = [];
  const io = { escrever: (t) => saida.push(t), lerLinha: async () => null, avisar: (t) => avisos.push(t) };
  const { executar } = require('../src');
  await executar(src, io);
  assert.strictEqual(saida.join(''), '1\n');
  assert.match(avisos.join(''), /SOBRA/);
  avisos.length = 0;
  await executar(src, io, { semAvisos: true });
  assert.strictEqual(avisos.length, 0);
});

// ---------- mais cobertura da linguagem ----------
test('laços aninhados (tabuada) e ESCOLHA com textos', async () => {
  const src = prog('DECLARE I, J : INTEIRO; OP : CARACTERES;', `
    PARA I DE 1 ATE 2 FACA PARA J DE 1 ATE 2 FACA ESCREVA(I * J); FIMPARA FIMPARA
    LEIA(OP);
    ESCOLHA(OP)
      CASO "a", "b": ESCREVA("ab");
      CASO "c".."e": ESCREVA("c a e");
      OUTROCASO: ESCREVA("outro");
    FIMESCOLHA`);
  assert.strictEqual(await rodar(src, ['d']), '1\n2\n2\n4\nc a e\n');
  assert.strictEqual(await rodar(src, ['b']), '1\n2\n2\n4\nab\n');
  assert.strictEqual(await rodar(src, ['z']), '1\n2\n2\n4\noutro\n');
});

test('ESCOLHA com tipos misturados é erro', async () => {
  assert.match((await falha(prog('DECLARE N : INTEIRO;', 'ESCOLHA(N) CASO "a": ESCREVA(1); FIMESCOLHA'))).message, /mesmo tipo/);
});

test('+=, -=, *=, /= e atribuição composta em posição de vetor', async () => {
  const src = prog('DECLARE X : NUMERICO; V : VETOR[2] DE INTEIRO;', 'X <- 10; X += 5; X -= 3; X *= 2; X /= 4; V[2] <- 1; V[2] += 4; V[2]++; ESCREVA(X, V[2]);');
  assert.strictEqual(await rodar(src), '6 6\n');
});

test('erros de sintaxe comuns têm mensagens claras', async () => {
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'SE (X > 1) ESCREVA(1); FIMSE'))).message, /Esperava ENTAO/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'ESCREVA("a);'))).message, /aspas/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'X <- 3 +;'))).message, /Esperava um valor/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'X <- 3 $ 2;'))).message, /Caractere inválido/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'ESCREVA(X);\nFIMENQUANTO'))).message, /não pode aparecer aqui/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'ESCREVA(SQRT);'))).message, /parênteses/);
});

test('DECLARE depois do INICIO e FUNCAO depois do INICIO são recusados', async () => {
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'DECLARE Y : INTEIRO;'))).message, /antes do INICIO/);
  assert.match((await falha(prog('DECLARE X : INTEIRO;', 'FUNCAO F() : INTEIRO INICIO RETORNE 1; FIMFUNCAO'))).message, /antes do INICIO/);
});

test('SE em outra linha depois do SENAO é aninhado (com FIMSE próprio)', async () => {
  const src = prog('DECLARE X, Y : INTEIRO;', `LEIA(X, Y);
    SE (X > 10) ENTAO
        ESCREVA("grande");
    SENAO SE (X > 5) ENTAO
        ESCREVA("medio");
    SENAO
        // comentário
        SE (Y = 1) ENTAO
            ESCREVA("pequeno-1");
        SENAO SE (Y = 2) ENTAO
            ESCREVA("pequeno-2");
        SENAO
            ESCREVA("pequeno-outro");
        FIMSE
    FIMSE`);
  assert.strictEqual(await rodar(src, [20, 1]), 'grande\n');
  assert.strictEqual(await rodar(src, [7, 1]), 'medio\n');
  assert.strictEqual(await rodar(src, [1, 1]), 'pequeno-1\n');
  assert.strictEqual(await rodar(src, [1, 2]), 'pequeno-2\n');
  assert.strictEqual(await rodar(src, [1, 9]), 'pequeno-outro\n');
});
