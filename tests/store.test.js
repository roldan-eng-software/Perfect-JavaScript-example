/**
 * ARQUIVO: store.test.js
 * PROPÓSITO: testar a mini store reativa — subscribe, unsubscribe e notificação.
 * CONCEITOS DEMONSTRADOS: pub/sub, imutabilidade, selectors.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/core/store.js';

describe('createStore', () => {
  it('inicia com o estado inicial fornecido', () => {
    const store = createStore({ contador: 0 });
    assert.deepEqual(store.getState(), { contador: 0 });
  });

  it('update aplica mutação e notifica assinantes', () => {
    const store = createStore({ contador: 0 });
    /** @type {any[]} */
    const estados = [];
    store.subscribe((estado) => estados.push(estado));

    store.update((s) => ({ ...s, contador: s.contador + 1 }));

    assert.equal(store.getState().contador, 1);
    assert.equal(estados.length, 1);
    assert.equal(estados[0].contador, 1);
  });

  it('assina várias vezes e cada assinante recebe o estado', () => {
    const store = createStore({ n: 0 });
    let a = 0;
    let b = 0;
    store.subscribe((s) => (a = s.n));
    store.subscribe((s) => (b = s.n));
    store.update((s) => ({ ...s, n: 5 }));
    assert.equal(a, 5);
    assert.equal(b, 5);
  });

  it('unsubscribe remove o assinante', () => {
    const store = createStore({ n: 0 });
    let chamadas = 0;
    const remover = store.subscribe(() => (chamadas += 1));

    store.update((s) => ({ ...s, n: 1 }));
    remover();
    store.update((s) => ({ ...s, n: 2 }));

    assert.equal(chamadas, 1, 'apenas a primeira notificação conta');
  });

  it('set substitui o estado inteiro', () => {
    const store = createStore({ a: 1, b: 2 });
    store.set({ a: 9, b: 9 });
    assert.deepEqual(store.getState(), { a: 9, b: 9 });
  });

  it('selector permite ler uma fatia do estado', () => {
    const store = createStore({ usuario: { nome: 'Ana' } });
    assert.equal(
      store.select((s) => s.usuario.nome),
      'Ana',
    );
  });

  it('não modifica o estado anterior (imutabilidade)', () => {
    const store = createStore({ itens: [1] });
    const antes = store.getState();
    store.update((s) => ({ ...s, itens: [...s.itens, 2] }));
    assert.deepEqual(antes.itens, [1], 'estado anterior intacto');
    assert.deepEqual(store.getState().itens, [1, 2]);
  });

  it('erros em assinantes não interrompem os demais', () => {
    const store = createStore({ n: 0 });
    let ok = false;
    store.subscribe(() => {
      throw new Error('assinante quebrado');
    });
    store.subscribe(() => (ok = true));
    store.update((s) => ({ ...s, n: 1 }));
    assert.equal(ok, true, 'segundo assinante ainda foi notificado');
  });
});
