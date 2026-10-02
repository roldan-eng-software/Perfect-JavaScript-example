// @ts-check
/**
 * ARQUIVO: 01-closures-hof.js
 * PROPÓSITO: demonstrar closures, funções de ordem superior, compose/pipe/curry
 *   e memoize com medição de desempenho real (performance.now).
 * CONCEITOS DEMONSTRADOS: closure, HOF, compose/pipe/curry, memoize,
 *   template literals, optional chaining, performance.now.
 * USADO EM: seção 01 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: retorna cleanup que cancela timers e remove listeners.
 */
import { h, on } from '../core/dom.js';
import { compose, pipe, curry } from '../utils/compose.js';
import { memoize } from '../utils/memoize.js';

/**
 * Inicializa a demo de closures e funções de ordem superior.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — remove listeners e cancela timers
 * @example
 * const cleanup = init(document.querySelector('#demo01'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];

  // ── 1. Closure: contador que "lembra" o estado sem variável global ─────────
  function criarContador(inicio = 0) {
    let valor = inicio; // estado privado da closure
    return {
      inc: () => (valor += 1),
      dec: () => (valor -= 1),
      get: () => valor,
    };
  }
  const contador = criarContador(0);

  const valorContador = h('output', { text: '0', 'aria-live': 'polite' });
  const painelContador = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Closure: contador encapsulado' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: '−1', on: { click: () => atualizar(-1) } }),
      valorContador,
      h('button', { type: 'button', text: '+1', on: { click: () => atualizar(1) } }),
    ),
    h('p', {
      class: 'nota',
      text: 'Cada chamada a criarContador() cria um escopo novo: `valor` não é global e não vaza.',
    }),
  );

  function atualizar(delta) {
    if (delta > 0) contador.inc();
    else contador.dec();
    valorContador.textContent = String(contador.get());
  }

  // ── 2. compose vs pipe + curry ─────────────────────────────────────────────
  const inc = (n) => n + 1;
  const dobro = (n) => n * 2;
  const menos3 = (n) => n - 3;

  const entrada = h('input', {
    type: 'number',
    value: '5',
    inputmode: 'numeric',
    'aria-label': 'Valor de entrada para compose e pipe',
  });
  const saidaCompose = h('output', { 'aria-live': 'polite' });
  const saidaPipe = h('output', { 'aria-live': 'polite' });

  function calcularComposicoes() {
    const n = Number(entrada.value);
    if (!Number.isFinite(n)) {
      saidaCompose.textContent = '—';
      saidaPipe.textContent = '—';
      return;
    }
    // compose aplica da direita p/ esquerda; pipe da esquerda p/ direita
    saidaCompose.textContent = String(compose(menos3, dobro, inc)(n));
    saidaPipe.textContent = String(pipe(inc, dobro, menos3)(n));
  }

  const somaComCurry = curry((a, b, c) => a + b + c);
  const painelComposicao = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'compose / pipe / curry' }),
    h(
      'div',
      { class: 'grade' },
      h('label', {}, 'entrada: ', entrada),
      h('p', {}, h('code', { text: 'compose(−3, ×2, +1)(n)' }), ' = ', saidaCompose),
      h('p', {}, h('code', { text: 'pipe(+1, ×2, −3)(n)' }), ' = ', saidaPipe),
      h('p', {
        class: 'nota',
        text: `curry: somaComCurry(1)(2)(3) = ${somaComCurry(1)(2)(3)} — mesma saída, args parciais.`,
      }),
    ),
  );

  remocoes.push(on(entrada, 'input', calcularComposicoes));
  calcularComposicoes();

  // ── 3. memoize: medição real com performance.now() ─────────────────────────
  /** Soma pesada de propósito (laço determinístico) para medir. */
  function trabalhoPesado(limite) {
    let total = 0;
    for (let i = 0; i < limite; i++) total = (total + i) % 1_000_003;
    return total;
  }
  const trabalhoMemoizado = memoize(trabalhoPesado);

  const resultadoMemo = h('output', { 'aria-live': 'polite' });
  const temposMemo = h('p', { class: 'nota', 'aria-live': 'polite' });

  function medirMemoize() {
    const entrada = 90_000;

    const t0 = performance.now();
    trabalhoPesado(entrada);
    const t1 = performance.now();

    trabalhoMemoizado.clearCache();
    const t2 = performance.now();
    trabalhoMemoizado(entrada);
    const t3 = performance.now();

    const t4 = performance.now();
    const cached = trabalhoMemoizado(entrada); // 2ª chamada → cache
    const t5 = performance.now();

    resultadoMemo.textContent = String(cached);
    temposMemo.textContent =
      `1ª chamada (sem cache): ${(t1 - t0).toFixed(3)} ms · ` +
      `memoize 1ª: ${(t3 - t2).toFixed(3)} ms · ` +
      `memoize 2ª (cache): ${(t5 - t4).toFixed(4)} ms → ` +
      `${((t1 - t0) / Math.max(t5 - t4, 0.0001)).toFixed(0)}× mais rápido`;
  }

  const painelMemo = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'memoize: com vs sem cache' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Medir performance.now()',
        on: { click: medirMemoize },
      }),
      h('span', { class: 'nota', text: 'resultado: ' }),
      resultadoMemo,
    ),
    temposMemo,
    h('p', {
      class: 'nota',
      text: 'memoize guarda o resultado num Map por argumentos — o 2º acesso não re-executa o corpo.',
    }),
  );

  container.append(painelContador, painelComposicao, painelMemo);

  // Cleanup: os listeners criados via h({on}) morrem com o container removido,
  // mas cancelamos o que for explícito — aqui apenas sinalizamos pronto.
  return () => {
    for (const remover of remocoes) remover();
  };
}
