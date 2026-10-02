/**
 * ARQUIVO: retry.test.js
 * PROPÓSITO: testar retry com backoff — usando sleep injetável (sem espera real).
 * CONCEITOS DEMONSTRADOS: injeção de dependência, Error.cause, abort.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attemptWithRetry } from '../src/utils/retry.js';

/** Cria um sleep fake que registra os atrasos solicitados. */
function fakeSleep() {
  /** @type {number[]} */
  const atrasos = [];
  const sleep = (ms) => {
    atrasos.push(ms);
    return Promise.resolve();
  };
  return { sleep, atrasos };
}

describe('attemptWithRetry', () => {
  it('retorna na primeira tentativa quando não há falha', async () => {
    const { sleep, atrasos } = fakeSleep();
    const resultado = await attemptWithRetry(async () => 'ok', { sleep });
    assert.equal(resultado, 'ok');
    assert.equal(atrasos.length, 0, 'sem falha não há espera');
  });

  it('re-tenta após falhas e sucede na segunda tentativa', async () => {
    const { sleep, atrasos } = fakeSleep();
    let tentativas = 0;
    const resultado = await attemptWithRetry(
      async () => {
        tentativas += 1;
        if (tentativas < 2) throw new Error('falhou');
        return 'recuperado';
      },
      { retries: 3, baseDelay: 100, factor: 2, sleep },
    );
    assert.equal(resultado, 'recuperado');
    assert.equal(tentativas, 2);
    assert.deepEqual(atrasos, [100], 'backoff da 1ª re-tentativa = baseDelay * 2⁰');
  });

  it('aplica backoff exponencial crescente entre tentativas', async () => {
    const { sleep, atrasos } = fakeSleep();
    await assert.rejects(
      attemptWithRetry(
        async () => {
          throw new Error('sempre falha');
        },
        { retries: 3, baseDelay: 100, factor: 2, sleep },
      ),
      /todas as 4 tentativas falharam/,
    );
    assert.deepEqual(atrasos, [100, 200, 400], '100 · 2⁰, 100 · 2¹, 100 · 2²');
  });

  it('esgota as tentativas e preserva a falha original em error.cause', async () => {
    const { sleep } = fakeSleep();
    const erroOriginal = new Error('boom');
    try {
      await attemptWithRetry(
        async () => {
          throw erroOriginal;
        },
        { retries: 2, sleep },
      );
      assert.fail('deveria ter lançado');
    } catch (erro) {
      assert.match(erro.message, /todas as 3 tentativas/);
      assert.equal(erro.cause, erroOriginal, 'cause aponta p/ o erro original');
    }
  });

  it('notifica a cada re-tentativa via onRetry', async () => {
    const { sleep } = fakeSleep();
    /** @type {Array<[number, string]>} */
    const notificacoes = [];
    await assert.rejects(
      attemptWithRetry(
        async () => {
          throw new Error('x');
        },
        {
          retries: 2,
          sleep,
          onRetry: (n, erro) => notificacoes.push([n, erro.message]),
        },
      ),
    );
    assert.deepEqual(notificacoes, [
      [1, 'x'],
      [2, 'x'],
    ]);
  });

  it('aborta imediatamente quando o signal já está abortado', async () => {
    const { sleep } = fakeSleep();
    const controller = new AbortController();
    controller.abort(new Error('cancelado'));
    await assert.rejects(
      attemptWithRetry(async () => 'nunca', { sleep, signal: controller.signal }),
      /cancelado/,
    );
  });

  it('lança TypeError quando attempt não é função', async () => {
    await assert.rejects(attemptWithRetry(/** @type {any} */ (null)), TypeError);
  });
});
