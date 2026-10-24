# Contribuindo

Este guia é para quem quer **mexer no código** do interpretador. Para apenas usar, veja o [README](README.md).

## Preparar o ambiente

Precisa do [Node.js 24+](https://nodejs.org/pt-br/download) e do Git. Não há dependências para instalar.

```bash
git clone https://github.com/wsleyweber/pseudocodigo.git
cd pseudocodigo
```

## Comandos

```bash
npm start                                 # executa o arquivo programa.alg
npm start -- exemplos/03_escolha_mes.alg  # executa outro arquivo
node bin/pseudo.js meu_codigo.txt         # qualquer extensão serve (.alg, .txt, .md ...)
node bin/pseudo.js --verificar prog.alg   # só confere erros e avisos, sem executar
npm test                                  # testes automatizados
npm run build:web                         # gera docs/pseudo.js (a página web)
```

## Estrutura do interpretador

```
programa.alg          arquivo executado por padrão
bin/pseudo.js         linha de comando
src/
  lexer.js            texto -> tokens (comentários, números, palavras, operadores)
  parser.js           tokens -> árvore do programa (sintaxe e precedência)
  semantica.js        verificação ANTES de executar (declarações e tipos)
  interpretador.js    execução da árvore
  tipos.js            os 5 tipos: validação, conversão do LEIA, formatação do ESCREVA
  funcoes.js          funções pré-definidas (SQRT, COS, ...). Fácil de estender
  sugestoes.js        "Você quis dizer ...?" (distância entre palavras)
  palavras.js         palavras reservadas
  io.js               entrada/saída pelo terminal
  erros.js            mensagens de erro amigáveis
exemplos/             programas prontos (também aparecem na lista da página web)
test/                 testes (node:test)
scripts/
  build-web.js        empacota src/ + exemplos/ em docs/pseudo.js
docs/index.html       página web (editor, botões, entrada/saída no navegador)
.github/workflows/    publicação automática no GitHub Pages
```

## Versão web e arquivo para o terminal

A pasta `docs/` é a página que executa o interpretador no navegador: editor com realce de sintaxe e
numeração de linhas, `LEIA` interativo na própria página, botões **Executar**, **Parar** e **Verificar erros**,
exemplos prontos, abrir/baixar arquivos `.alg` e salvamento automático no navegador. O limite de repetições
na página é menor que o do terminal, para detectar laços infinitos mais rápido.

Os arquivos de `src/` usam `require`, que o navegador não entende. Por isso dois scripts juntam tudo em um
único arquivo cada:

* `npm run build:web` gera `docs/pseudo.js`, usado pela página;

Esse arquivo **não fica no repositório** (está no `.gitignore`): é gerado a cada publicação.
Para testar a página no seu computador, rode o comando acima e abra `docs/index.html`.

**Regra para a versão web continuar funcionando:** os módulos de `src/` (exceto `src/io.js`) não podem usar
módulos do Node (`fs`, `readline`, `process`...). O `build:web` avisa se isso acontecer. A entrada/saída do
terminal fica em `src/io.js` e a da página em `docs/index.html`.

## Publicação (GitHub Pages)

A publicação é feita pelo **GitHub Actions** (`.github/workflows/pages.yml`). A cada push na `main`, o fluxo:

1. roda `npm test` (se algum teste falhar, **nada é publicado** e a página anterior continua no ar);
2. gera `docs/pseudo.js`;
3. publica a pasta `docs/` no GitHub Pages.

Configuração necessária no repositório, uma única vez: em *Settings → Pages → Build and deployment → Source*,
escolha **GitHub Actions**.

## Antes de enviar uma alteração

* Rode `npm test` e confira que tudo passa.
* Se mudou a linguagem (sintaxe, funções, mensagens), acrescente ou ajuste um teste em `test/`.
* Se criou um exemplo novo em `exemplos/`, ele aparece sozinho na lista da página web.
* Para criar uma função pré-definida nova, acrescente uma entrada em `src/funcoes.js`: ela vira função e palavra reservada sozinha.
* Para criar uma palavra reservada nova, edite `src/palavras.js`.
* As posições de vetores começam em 1; para começar em 0, mude `BASE_INDICE` em `src/tipos.js`.