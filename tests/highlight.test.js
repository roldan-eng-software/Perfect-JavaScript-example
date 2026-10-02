/**
 * ARQUIVO: highlight.test.js
 * PROPÓSITO: testar o tokenizador puro usado pelo <code-peek>.
 * CONCEITOS DEMONSTRADOS: máquina de estados, reconstrução exata da fonte.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeJs, renderTokens } from '../src/utils/highlight.js';

/** Concatena os tokens e deve reconstituir o código original. */
function reconstruir(source) {
  return tokenizeJs(source)
    .map((t) => t.value)
    .join('');
}

describe('tokenizeJs', () => {
  it('classifica palavras-chave, identificadores, operadores e números', () => {
    const tokens = tokenizeJs('const x = 42;');
    const tipos = tokens.map((t) => `${t.type}:${t.value}`);
    assert.ok(tipos.includes('keyword:const'));
    assert.ok(tipos.includes('ident:x'));
    assert.ok(tipos.includes('operator:='));
    assert.ok(tipos.includes('number:42'));
    assert.ok(tipos.includes('punct:;'));
  });

  it('reconstrói a fonte exatamente (nada se perde nem se duplica)', () => {
    const fontes = [
      'const x = 1;',
      'let a = "texto // não é comentário";',
      '// comentário de linha\nconst b = 2;',
      '/* bloco\nmulti-linha */ fn()',
      'const t = `olá ${nome}!`;',
      'const n = 0xFF + 1e3 + 10n;',
      'obj?.metodo?.(x) ?? "padrao";',
      'x ||= 1; y &&= 2; z ??= 3;',
      '',
    ];
    for (const fonte of fontes) {
      assert.equal(reconstruir(fonte), fonte, `reconstrução falhou para: ${fonte}`);
    }
  });

  it('não confunde "//" dentro de string com comentário', () => {
    const tokens = tokenizeJs('const url = "https://exemplo.com";');
    const comentarios = tokens.filter((t) => t.type === 'comment');
    assert.equal(comentarios.length, 0, 'a URL não gera token de comentário');
    const strings = tokens.filter((t) => t.type === 'string');
    assert.equal(strings.length, 1);
  });

  it('trata comentário de bloco', () => {
    const tokens = tokenizeJs('/* nota */ const x = 1');
    assert.equal(tokens[0].type, 'comment');
    assert.equal(tokens[0].value, '/* nota */');
  });

  it('tokeniza template literal com interpolação inteira', () => {
    const tokens = tokenizeJs('`a ${b + 1} c`');
    const tpl = tokens.find((t) => t.type === 'template');
    assert.ok(tpl, 'deve haver um token template');
    assert.equal(tpl.value, '`a ${b + 1} c`');
  });

  it('distigue false/null/undefined como keywords', () => {
    const tokens = tokenizeJs('false; null; undefined;');
    assert.ok(
      tokens.every((t) => t.type === 'keyword' || t.type === 'punct' || t.type === 'plain'),
    );
  });

  it('lança TypeError para entrada não-string', () => {
    assert.throws(() => tokenizeJs(/** @type {any} */ (123)), TypeError);
  });

  it('token vazio produz lista vazia', () => {
    assert.deepEqual(tokenizeJs(''), []);
  });
});

describe('renderTokens', () => {
  it('escapa HTML perigoso nos valores', () => {
    const html = renderTokens([{ type: 'plain', value: '<script>alert(1)</script>' }], {});
    assert.ok(!html.includes('<script>'), 'deve escapar <');
    assert.ok(html.includes('&lt;script&gt;'));
  });

  it('aplica as classes CSS fornecidas', () => {
    const html = renderTokens([{ type: 'keyword', value: 'const' }], { keyword: 'tk-kw' });
    assert.equal(html, '<span class="tk-kw">const</span>');
  });
});
