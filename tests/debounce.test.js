/**
 * ARQUIVO: debounce.test.js
 * PROPÓSITO: testar debounce com timers mockados do node:test.
 * CONCEITOS DEMONSTRADOS: mock.timers (controla setTimeout), casos de borda.
 * USADO EM: npm test
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from '../src/utils/debounce.js';

describe('debounce', () => {
  it('aguarda o período de inatividade antes de executar', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      let chamadas = 0;
      const fn = debounce(() => (chamadas += 1), 100);

      fn();
      fn();
      assert.equal(chamadas, 0, 'não deve executar antes do tempo');

      mock.timers.tick(99);
      assert.equal(chamadas, 0, 'ainda não: faltam 1ms');

      mock.timers.tick(1);
      assert.equal(chamadas, 1, 'executa exatamente 1x após a pausa');
    } finally {
      mock.timers.reset();
    }
  });

  it('passa os argumentos da última chamada para a função', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      /** @type {any[]} */
      let recebidos = null;
      const fn = debounce((...args) => (recebidos = args), 50);

      fn('a', 1);
      fn('b', 2);
      mock.timers.tick(50);

      assert.deepEqual(recebidos, ['b', 2], 'usa os args mais recentes');
    } finally {
      mock.timers.reset();
    }
  });

  it('cancel() impede a execução pendente', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      let executou = false;
      const fn = debounce(() => (executou = true), 100);

      fn();
      fn.cancel();
      mock.timers.tick(1000);

      assert.equal(executou, false, 'cancel deve abortar o timer');
    } finally {
      mock.timers.reset();
    }
  });

  it('leading: true executa também na primeira chamada', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      let chamadas = 0;
      const fn = debounce(() => (chamadas += 1), 100, { leading: true });

      fn();
      assert.equal(chamadas, 1, 'leading executa imediatamente');
      mock.timers.tick(100);
      assert.equal(chamadas, 1, 'não duplica no fim do intervalo sem novas chamadas');
    } finally {
      mock.timers.reset();
    }
  });

  it('lança TypeError quando fn não é função', () => {
    assert.throws(() => debounce(/** @type {any} */ (null), 100), TypeError);
  });

  it('lança RangeError quando wait é negativo ou não numérico', () => {
    assert.throws(() => debounce(() => {}, -1), RangeError);
    assert.throws(() => debounce(() => {}, Number.NaN), RangeError);
  });
});
