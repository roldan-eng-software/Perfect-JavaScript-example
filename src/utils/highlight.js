// @ts-check
/**
 * ARQUIVO: highlight.js
 * PROPÓSITO: tokenizar código JavaScript para realce de sintaxe — pura, sem DOM.
 * CONCEITOS DEMONSTRADOS: máquina de estados, regex, funções puras, Imutabilidade.
 * USADO EM: components/code-peek.js (realce) e tests/highlight.test.js.
 * COMPLEXIDADE/OBSERVAÇÕES: tokenizador enxuto de propósito — não é um parser
 *   completo; cobre comentários, strings/template literals, números, palavras-
 *   chave, operadores e identificadores, o suficiente para exibir código legível.
 */

/**
 * Um pedaço de código classificado.
 *
 * @typedef {object} Token
 * @property {'comment'|'string'|'template'|'number'|'keyword'|'operator'|'punct'|'ident'|'plain'} type
 *   classe sintática do trecho
 * @property {string} value texto original do trecho (nunca modificado)
 */

/** Palavras-chave do ES que recebem destaque. */
const KEYWORDS = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'true',
  'false',
  'null',
  'undefined',
]);

/** Operadores e pontuação que recebem destaque. */
const OPERATORS = new Set([
  '=>',
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '?.',
  '??=',
  '||=',
  '&&=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '**=',
  '++',
  '--',
  '...',
  '??',
  '=>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '<',
  '>',
  '!',
  '&',
  '|',
  '^',
  '~',
  '?',
  ':',
]);

/**
 * Tokeniza uma fonte JS. Função pura: mesma entrada → mesma saída, sem efeitos.
 *
 * Regras de precedência (importante para casos como `"// não é comentário"`):
 * 1. comentários (`//` e `/* *\/`)
 * 2. strings ('…' e "…") com escapes
 * 3. template literals (com `${}` tratado como parte)
 * 4. números (decimais, hex, exponenciais, BigInt com `n`)
 * 5. palavras-chave e identificadores
 * 6. operadores/pontuação de 2–3 chars
 * 7. resto → `plain`
 *
 * @param {string} source código JS completo
 * @returns {Token[]} sequência de tokens cuja concatenação reconstrói `source` exatamente
 * @throws {TypeError} se `source` não for string
 * @example
 * tokenizeJs('const x = 1 // fim');
 * // → [{type:'keyword',value:'const'}, {type:'plain',value:' '}, ...]
 */
export function tokenizeJs(source) {
  if (typeof source !== 'string') {
    throw new TypeError('tokenizeJs: "source" deve ser uma string.');
  }

  /** @type {Token[]} */
  const tokens = [];
  let i = 0;
  const len = source.length;

  /** Empurra um token, fundindo adjacentes do mesmo tipo quando fizer sentido. */
  function push(type, value) {
    if (value === '') return;
    const ultimo = tokens[tokens.length - 1];
    if (ultimo && ultimo.type === type) {
      ultimo.value += value;
      return;
    }
    tokens.push({ type, value });
  }

  while (i < len) {
    const char = source[i];
    const resto = source.slice(i);

    // 1) Comentários — checados antes de strings para não confundir "//"
    if (resto.startsWith('//')) {
      const fim = source.indexOf('\n', i);
      const fimComentario = fim === -1 ? len : fim;
      push('comment', source.slice(i, fimComentario));
      i = fimComentario;
      continue;
    }
    if (resto.startsWith('/*')) {
      const fim = source.indexOf('*/', i + 2);
      const fimComentario = fim === -1 ? len : fim + 2;
      push('comment', source.slice(i, fimComentario));
      i = fimComentario;
      continue;
    }

    // 2) Strings simples com escapes
    if (char === '"' || char === "'") {
      let j = i + 1;
      while (j < len) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === char) {
          j += 1;
          break;
        }
        j += 1;
      }
      push('string', source.slice(i, Math.min(j, len)));
      i = Math.min(j, len);
      continue;
    }

    // 3) Template literals (inclui ${...} como parte do token)
    if (char === '`') {
      let j = i + 1;
      let profundidade = 0;
      while (j < len) {
        const c = source[j];
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (profundidade === 0 && c === '`') {
          j += 1;
          break;
        }
        if (profundidade === 0 && c === '$' && source[j + 1] === '{') {
          profundidade += 1;
          j += 2;
          continue;
        }
        if (profundidade > 0 && c === '}') {
          profundidade -= 1;
          j += 1;
          continue;
        }
        if (profundidade > 0 && c === '{') {
          profundidade += 1;
        }
        j += 1;
      }
      push('template', source.slice(i, Math.min(j, len)));
      i = Math.min(j, len);
      continue;
    }

    // 4) Números (decimais, hex, exponenciais, BigInt)
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const m = resto.match(
        /^(?:0[xXbBoO][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)[n]?/,
      );
      if (m) {
        push('number', m[0]);
        i += m[0].length;
        continue;
      }
    }

    // 5) Palavras-chave / identificadores
    if (/[A-Za-z_$]/.test(char)) {
      const m = resto.match(/^[A-Za-z_$][\w$]*/);
      const palavra = m ? m[0] : char;
      push(KEYWORDS.has(palavra) ? 'keyword' : 'ident', palavra);
      i += palavra.length;
      continue;
    }

    // 6) Operadores (tenta os de 3, 2 chars antes de 1)
    const operador3 = resto.slice(0, 3);
    const operador2 = resto.slice(0, 2);
    if (OPERATORS.has(operador3)) {
      push('operator', operador3);
      i += 3;
      continue;
    }
    if (OPERATORS.has(operador2)) {
      push('operator', operador2);
      i += 2;
      continue;
    }
    if (OPERATORS.has(char)) {
      push('operator', char);
      i += 1;
      continue;
    }

    // 6b) Pontuação (chaves, parênteses etc.)
    if (/[{}()[\];,.]/.test(char)) {
      push('punct', char);
      i += 1;
      continue;
    }

    // 7) Espaços e o resto
    push('plain', char);
    i += 1;
  }

  return tokens;
}

/**
 * Renderiza tokens como HTML seguro (para uso interno do code-peek).
 * Apenas escapa `<`, `>` e `&` — os dados vêm do próprio repositório,
 * mas o escape mantém a regra "nunca injetar HTML cru" consistente.
 *
 * @param {Token[]} tokens lista tokenizada
 * @param {Record<string, string>} classes mapa tipo → classe CSS
 * @returns {string} HTML com spans e entidades escapadas
 * @example
 * renderTokens(tokenizeJs('const x = 1'), { keyword: 'tk-kw' });
 */
export function renderTokens(tokens, classes = {}) {
  return tokens
    .map(({ type, value }) => {
      const seguro = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      const classe = classes[type];
      return classe ? `<span class="${classe}">${seguro}</span>` : seguro;
    })
    .join('');
}
