/**
 * ARQUIVO: throttle.test.js
 * PROPÓSITO: testar throttle (leading + trailing) com timers e relógio mockados.
 * CONCEITOS DEMONSTRADOS: mock.timers com Date, controle de frequência.
 * USADO EM: npm test
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { throttle } from '../src/utils/throttle.js';

describe('throttle', () => {
  it('executa imediatamente na primeira chamada (leading)', () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
      let chamadas = 0;
      const fn = throttle(() => (chamadas += 1), 100);

      fn();
      assert.equal(chamadas, 1);
    } finally {
      mock.timers.reset();
    }
  });

  it('limita a quantidade de execuções dentro do intervalo', () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
      let chamadas = 0;
      const fn = throttle(() => (chamadas += 1), 100);

      fn(); // leading: 1
      mock.timers.tick(10);
      fn(); // dentro do intervalo → pendente
      mock.timers.tick(10);
      fn(); // dentro do intervalo → substitui a pendente

      assert.equal(chamadas, 1, 'só o leading rodou até aqui');

      mock.timers.tick(100); // trailing dispara
      assert.equal(chamadas, 2, 'trailing executa 1x com os args mais recentes');
    } finally {
      mock.timers.reset();
    }
  });

  it('permite nova execução após o intervalo expirar', () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
      let chamadas = 0;
      const fn = throttle(() => (chamadas += 1), 100);

      fn();
      mock.timers.tick(150);
      fn();

      assert.equal(chamadas, 2);
    } finally {
      mock.timers.reset();
    }
  });

  it('cancel() descarta a chamada pendente', () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
      let chamadas = 0;
      const fn = throttle(() => (chamadas += 1), 100);

      fn();
      mock.timers.tick(10);
      fn();
      fn.cancel();
      mock.timers.tick(500);

      assert.equal(chamadas, 1, 'trailing cancelado não executa');
    } finally {
      mock.timers.reset();
    }
  });

  it('lança erros de entrada inválida', () => {
    assert.throws(() => throttle(/** @type {any} */ (undefined), 100), TypeError);
    assert.throws(() => throttle(() => {}, 0), RangeError);
    assert.throws(() => throttle(() => {}, -5), RangeError);
  });
});
