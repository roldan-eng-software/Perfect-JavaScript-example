/**
 * ARQUIVO: format.test.js
 * PROPÓSITO: testar formatação Intl — números, datas, listas, plural, collator.
 * CONCEITOS DEMONSTRADOS: Intl.*, determinismo de string com locale fixo.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumber,
  formatDate,
  formatRelativeTime,
  formatList,
  pluralize,
  collate,
} from '../src/utils/format.js';

describe('formatNumber', () => {
  it('formata decimal em pt-BR', () => {
    assert.equal(formatNumber(1234.5), '1.234,5');
  });

  it('formata moeda BRL', () => {
    // O Intl usa NBSP (U+00A0) entre R$ e o número — \s casa NBSP e normalizamos
    const texto = formatNumber(1234.5, { style: 'currency' });
    assert.equal(texto.replace(/\s+/g, ' ').trim(), 'R$ 1.234,50');
  });

  it('formata em en-US quando solicitado', () => {
    assert.equal(formatNumber(1234.5, { locale: 'en-US' }), '1,234.5');
  });

  it('lança RangeError para valores não numéricos', () => {
    assert.throws(() => formatNumber(Number.NaN), RangeError);
    assert.throws(() => formatNumber(Infinity), RangeError);
    assert.throws(() => formatNumber(/** @type {any} */ ('12')), RangeError);
  });
});

describe('formatDate', () => {
  it('formata data em pt-BR', () => {
    const texto = formatDate(new Date(2026, 0, 15), { locale: 'pt-BR' });
    assert.match(texto, /15/);
    assert.match(texto, /2026/);
  });

  it('aceita timestamp além de Date', () => {
    const texto = formatDate(Date.UTC(2026, 0, 15), {
      locale: 'en-US',
      opções: { timeZone: 'UTC', dateStyle: 'short' },
    });
    assert.match(texto, /15/);
  });

  it('lança RangeError para data inválida', () => {
    assert.throws(() => formatDate('não é data'), RangeError);
    assert.throws(() => formatDate(Number.NaN), RangeError);
  });
});

describe('formatRelativeTime', () => {
  it('formata passado em pt-BR', () => {
    assert.equal(formatRelativeTime(-3, 'day'), 'há 3 dias');
  });

  it('formata futuro em en-US', () => {
    assert.equal(formatRelativeTime(2, 'hour', { locale: 'en-US' }), 'in 2 hours');
  });
});

describe('formatList', () => {
  it('formata conjunção em pt-BR', () => {
    assert.equal(formatList(['Ana', 'Bia', 'Caio']), 'Ana, Bia e Caio');
  });

  it('lança TypeError para entrada que não é array', () => {
    assert.throws(() => formatList(/** @type {any} */ ('a, b')), TypeError);
  });
});

describe('pluralize', () => {
  it('escolhe a forma correta para 1, 0 e n (CLDR pt: 0 e 1 → "one")', () => {
    const formas = { one: '{n} item', other: '{n} itens' };
    assert.equal(pluralize(1, formas), '1 item');
    assert.equal(pluralize(5, formas), '5 itens');
    // Em pt-BR o CLDR classifica 0 na categoria "one" — comportamento do Intl
    assert.equal(pluralize(0, formas), '0 item');
  });

  it('cai em other quando a forma da categoria não existe', () => {
    assert.equal(pluralize(3, { other: '{n} coisas' }), '3 coisas');
  });
});

describe('collate', () => {
  it('ordena em pt-BR sem diferenciar caixa/acento na sensibilidade base', () => {
    const lista = ['ola', 'Ovo', 'ação'];
    const ordenada = [...lista].sort((a, b) => collate(a, b));
    assert.deepEqual(ordenada, ['ação', 'ola', 'Ovo']);
  });

  it('retorna 0 para strings equivalentes na sensibilidade base', () => {
    assert.equal(collate('ana', 'ANA'), 0);
    assert.equal(collate('ana', 'Ana'), 0);
  });
});
