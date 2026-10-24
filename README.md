<div align="center">

# Pseudocódigo > JS

[![Abrir no navegador](https://img.shields.io/badge/%F0%9F%8C%90%20Abrir%20no%20navegador-1f4fd8?style=for-the-badge)](https://wsleyweber.github.io/pseudocodigo/)

![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-2f9e44?style=flat-square)
![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![Portugol](https://img.shields.io/badge/portugol-pseudoc%C3%B3digo-862e9c?style=flat-square)

</div>

Interpretador de **pseudocódigo em português (portugol)** para ensinar lógica de programação.
Você escreve o algoritmo e executa no navegador ou no terminal, com `LEIA` interativo (como o `input()` do Python).

<details>
<summary><b>📑 Neste documento</b></summary>

- 🚀 [Como usar](#como-usar)
- 💻 [Usar no terminal (Visual Studio Code)](#usar-no-terminal-visual-studio-code)
  - [Opções](#opções)
  - [Customizações (opcional)](#customizações-opcional)
- 📘 [Resumo da linguagem](#resumo-da-linguagem)
  - [Tipos](#tipos) · [Nomes de variáveis](#nomes-de-variáveis) · [Entrada e saída](#entrada-e-saída) · [Operadores](#operadores)
  - [Estruturas](#estruturas) · [Vetores e matrizes](#vetores-e-matrizes) · [Constantes](#constantes)
  - [Funções e procedimentos](#funções-e-procedimentos) · [Controle de laços](#controle-de-laços) · [Funções pré-definidas](#funções-pré-definidas)
- ⚠️ [Avisos pedagógicos](#avisos-pedagógicos)
- 🐞 [Erros que o usuário vê](#erros-que-o-usuário-vê)
- 🤝 [Contribuir](#contribuir)

</details>

---

## Como usar

| Quero... | Faça isto |
|---|---|
| **Usar no navegador** | Acesse [wsleyweber.github.io/pseudocodigo](https://wsleyweber.github.io/pseudocodigo/) |
| **Usar no terminal / Visual Studio Code** | Baixe o `pseudo-cli.js` (veja abaixo). Precisa do [Node.js 24+](https://nodejs.org/pt-br/download) |

---

## Usar no terminal (Visual Studio Code)

**1. Crie uma pasta** para os seus algoritmos e abra-a no Visual Studio Code (*Arquivo → Abrir Pasta*).

**2. Baixe o interpretador** uma única vez. Abra o terminal do Visual Studio Code (*Terminal → Novo Terminal*) e rode:

```powershell
irm https://wsleyweber.github.io/pseudocodigo/pseudo-cli.js -OutFile pseudo-cli.js
```

No Linux, Mac ou Git Bash:

```bash
curl -O https://wsleyweber.github.io/pseudocodigo/pseudo-cli.js
```

> 💡 O `irm` só existe no PowerShell (o terminal padrão do Visual Studio Code no Windows). No Prompt de Comando (`cmd`),
> abra o endereço acima no navegador e salve o arquivo na sua pasta com **Salvar como**.

> ⚠️ **IMPORTANTE:** Se houver atualizações no interpretador é necessário repetir o passo 2 para baixar a nova versão (o arquivo antigo é substituído).

**3. Crie o seu algoritmo**, por exemplo `meualgoritmo.alg`, na mesma pasta, e escreva o código nele.

**4. Execute:**

```
node pseudo-cli.js meualgoritmo.alg
```

Se aparecer `'node' não é reconhecido`, o Node.js não está instalado, ou o VS Code precisa ser fechado e
aberto de novo depois da instalação.

### Opções

| Opção | O que faz |
|---|---|
| `--verificar` | Só confere erros e avisos, sem executar |
| `--sem-avisos` | Não mostra os avisos pedagógicos |
| `--max-iteracoes <n>` | Limite de repetições contra laços infinitos (padrão 10000000; 0 = sem limite) |

Exemplo: `node pseudo-cli.js --verificar meu.alg`. Para interromper um programa a qualquer momento, use `Ctrl+C`.

### Customizações (opcional)

Para melhor visualização e execução dos algoritmos, algumas customizações podem ser feitas pelo usuário:

#### Atalho no Visual Studio Code

Para facilitar e permitir executar o arquivo aberto com **Ctrl + Shift + B**, crie o arquivo `.vscode/tasks.json` na sua pasta e cole o bloco abaixo:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Executar algoritmo",
      "type": "shell",
      "command": "node pseudo-cli.js \"${file}\"",
      "group": { "kind": "build", "isDefault": true },
      "presentation": { "reveal": "always", "panel": "shared", "focus": true }
    }
  ]
}
```

#### Extensão para realçar sintaxe

Permite ver as palavras reservadas, tipos e comentários coloridos nos arquivos `.alg`. Instale da seguinte forma:
1. Baixe o arquivo **pseudocodigo.vsix** na [página de Releases](https://github.com/wsleyweber/pseudocodigo/releases/latest/download/pseudocodigo.vsix).
2. No Visual Studio Code, abra a aba **Extensões** (`Ctrl + Shift + X`).
3. Clique nos três pontinhos (**...**) no topo do painel → **Instalar do VSIX...**
4. Escolha o arquivo baixado e recarregue o VS Code, se pedir.

> ⚠️ **IMPORTANTE:** Se houver atualizações na extensão é necessário baixar a nova versão e reinstalar.

---

## Resumo da linguagem

```
ALGORITMO NOME:                 # o cabeçalho é opcional; "ALGORITMO_X:" também vale
    DECLARE A, B : INTEIRO;     # todas as variáveis precisam ser declaradas e tipadas
    DECLARE NOME : CARACTERES;  # DECLARE pode se repetir
INICIO
    ...comandos...
FIMALGORITMO
```

* Todo comando simples termina com `;`. Comentários: `# ...`, `// ...` e `/* ... */`.
* Palavras reservadas e nomes de variáveis **não diferenciam maiúsculas/minúsculas nem acentos**
  (`SE`, `se` e `Se` são iguais; `ENTÃO` = `ENTAO`).

### Tipos

| Tipo | Guarda | Exemplo |
|---|---|---|
| `INTEIRO` | números sem casas decimais | `10` |
| `NUMERICO` | números com ou sem casas decimais | `3.14` |
| `CARACTERES` | texto | `"Ana"` |
| `ALFANUMERICOS` | texto (letras e números) | `"ABC123"` |
| `LOGICOS` | `VERDADEIRO` ou `FALSO` | `VERDADEIRO` |

Atribuir um valor de tipo errado é erro (`A <- "oi"` em um `INTEIRO`). Um `INTEIRO` também não aceita um
resultado com casas decimais (`A <- 7 / 2`): use `TRUNC`, `ROUND` ou `DIV`.

### Nomes de variáveis

Começam com letra ou `_`, seguidos de letras, números ou `_`. Não podem começar com número nem ser palavra
reservada: `ALGORITMO FIMALGORITMO DECLARE INICIO FIM SE ENTAO SENAO FIMSE ESCOLHA CASO OUTROCASO PADRAO
FIMESCOLHA ENQUANTO FACA FIMENQUANTO REPITA ATE PARA DE PASSO FIMPARA ESCREVA ESCREVA_SEM_QUEBRA LEIA
CONSTANTE VETOR MATRIZ FUNCAO FIMFUNCAO PROCEDIMENTO FIMPROCEDIMENTO RETORNE INTERROMPA CONTINUE
E OU NAO DIV MOD VERDADEIRO FALSO PI`, os nomes dos tipos e os nomes das funções (`COS`, `SEN`, `SQRT`...).

### Entrada e saída

```
ESCREVA("Texto", variavel, 2 + 3);   # itens separados por espaço; pula linha no final
ESCREVA_SEM_QUEBRA("Digite: ");      # igual, mas NÃO pula linha (bom antes de um LEIA)
LEIA(X);                             # lê um valor; LEIA(A, B, C) lê um por linha; LEIA(V[2]) lê numa posição
```

`LEIA` valida o tipo e pede de novo se o usuário digitar algo inválido. Em `NUMERICO` vale `3,5` ou `3.5`.
Em `LOGICOS` vale `verdadeiro/falso`, `v/f`, `sim/nao`.

### Operadores

* Atribuição: `<-` (ou `:=`); também `i++`, `i--`, `+=`, `-=`, `*=`, `/=`.
* Aritméticos: `+ - * / ^` (potência), `DIV` (divisão inteira), `MOD` ou `%` (resto).
  `+` também junta textos.
* Relacionais: `=  <>  <  >  <=  >=` (também `==` e `!=`).
* Lógicos: `E`, `OU`, `NAO` (com curto-circuito).
* Precedência (do menor para o maior): `OU` < `E` < `NAO` < relacionais < `+ -` < `* / DIV MOD` < `-` unário < `^`.
  Use parênteses na dúvida.

> ⚠️ Atenção: `i<-1` é lido como atribuição. Para comparar com um negativo escreva `i < -1`.

### Estruturas

```
SE(cond) ENTAO                    ESCOLHA(X)
    ...                               CASO 1:
SENAO SE(cond) ENTAO                      ...
    ...                               CASO 2..5:        # faixa
SENAO                                     ...
    ...                               CASO 7, 9:        # lista
FIMSE                                     ...
                                      OUTROCASO:        # padrão (opcional)
ENQUANTO(cond) FACA                       ...
    ...                           FIMESCOLHA
FIMENQUANTO
                                  PARA I DE 1 ATE 10 PASSO 2 FACA
REPITA                                ...
    ...                           FIMPARA
ATE(cond);
```

* `INICIO ... FIM` forma um bloco (como `{ }`) e pode ser usado em qualquer lugar.
* `SENAO SE` continua o **mesmo** `SE` (um único `FIMSE` fecha tudo). Para aninhar um `SE` dentro de um
  `SENAO`, coloque-o em um bloco: `SENAO INICIO SE ... FIMSE FIM`.
* No `ESCOLHA` não há "queda" entre casos: só o caso que combinou é executado.
* Depois de `CASO` e de `OUTROCASO` os dois pontos (`:`) são obrigatórios.

### Vetores e matrizes

```
DECLARE NOTAS : VETOR[5] DE NUMERICO;      # posições 1 a 5
DECLARE M : MATRIZ[3][4] DE INTEIRO;       # também vale MATRIZ[3, 4]
...
NOTAS[1] <- 8.5;
M[2][3] <- NOTAS[1] * 2;                   # também vale M[2, 3]
```

* As posições começam em **1**.
* O tamanho deve ser fixo: um número ou uma `CONSTANTE` (nunca uma variável).
* Ler uma posição que nunca recebeu valor, ou usar um índice fora dos limites, é erro de execução.

### Constantes

```
CONSTANTE QTD : INTEIRO <- 5;              # valor fixo; não pode ser alterada nem lida com LEIA
CONSTANTE DOBRO : INTEIRO <- QTD * 2;      # só pode usar literais e outras constantes
```

### Funções e procedimentos

Ficam **antes do `INICIO`** do algoritmo, depois das declarações.

```
FUNCAO FATORIAL(N : INTEIRO) : INTEIRO     # devolve um valor
    DECLARE R : INTEIRO;                   # variáveis locais
INICIO
    SE (N <= 1) ENTAO RETORNE 1; FIMSE
    RETORNE N * FATORIAL(N - 1);           # recursão permitida
FIMFUNCAO

PROCEDIMENTO PREENCHER(V : VETOR DE INTEIRO, TAM : INTEIRO)   # não devolve valor
INICIO
    ...                                    # RETORNE; (sem valor) encerra o procedimento
FIMPROCEDIMENTO
```

Uso: `X <- FATORIAL(5);` (função, dentro de uma expressão) e `PREENCHER(V, 3);` (procedimento, como comando).

* Parâmetros simples são passados **por valor**. `VETOR DE tipo` e `MATRIZ DE tipo` são passados **por referência**
  (a função/procedimento altera o vetor original).
* Variáveis globais podem ser lidas e alteradas; uma variável local com o mesmo nome "esconde" a global.
* Uma `FUNCAO` precisa de pelo menos um `RETORNE valor;`.

### Controle de laços

`INTERROMPA;` sai do laço mais interno (`ENQUANTO`, `REPITA` ou `PARA`). `CONTINUE;` pula para a próxima repetição
(no `REPITA`, vai direto para o teste do `ATE`; no `PARA`, vai para o próximo valor).

### Funções pré-definidas

| Categoria | Funções |
|---|---|
| Matemática | `SQRT ABS POW EXP LN LOG` (LOG = base 10) e a constante `PI` |
| Trigonometria (radianos) | `SEN COS TAN ASEN ACOS ATAN GRAUS RADIANOS` |
| Arredondamento | `ROUND(x)`, `ROUND(x, casas)` (ou `ARREDONDAR`), `TRUNC FLOOR CEIL` |
| Outras | `MAX(a, b, ...)`, `MIN(a, b, ...)`, `ALEATORIO(min, max)` |
| Formatação | `FORMATAR(valor, casas)` devolve texto com casas fixas: `FORMATAR(3.14159, 2)` → `3.14` |
| Texto | `MAIUSCULO MINUSCULO TAM_TEXTO SUBTEXTO(t, inicio, qtd) LOCALIZAR(trecho, t)` (posições começam em 1) |
| Conversão | `PARA_TEXTO(valor)`, `PARA_NUMERO(texto)` |

---

## Avisos pedagógicos

Antes de executar, o sistema mostra **avisos** (não impedem a execução; use `--sem-avisos` para esconder):
variável declarada e nunca usada, variável usada mas que nunca recebe valor, comparação de números decimais com
`=` (o clássico `0.1 + 0.2 = 0.3`), `/` atribuído a `INTEIRO`, divisão por zero literal e laço cuja condição
nunca muda (possível laço infinito).

---

## Erros que o usuário vê

```
Erro de tipo/declaração (linha 4, coluna 3): A variável 'A' é do tipo INTEIRO e não aceita um valor texto.
  4 |   A <- "oi";
    |   ^
```

Quando há uma palavra ou variável parecida, o sistema sugere a correção (`'ETNAO'... Você quis dizer ENTAO?`).

Erros léxicos, de sintaxe e de tipo/declaração são encontrados **antes** de qualquer execução, inclusive em
trechos que não seriam executados. Erros de execução (divisão por zero, variável sem valor, `SQRT(-1)`...)
aparecem quando acontecem. Um limite de repetições (padrão 10 milhões, `--max-iteracoes`) evita travar
com laço infinito, e `Ctrl+C` interrompe a qualquer momento.

---

## Contribuir

O projeto é de código aberto (licença MIT). Quer entender como o interpretador funciona, corrigir algo ou
sugerir uma melhoria? Veja o [CONTRIBUTE.md](CONTRIBUTE.md).