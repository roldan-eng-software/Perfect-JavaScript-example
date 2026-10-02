// @ts-check
/**
 * ARQUIVO: 12-performance.js
 * PROPÓSITO: instrumentar a página com a Performance API nativa — mark/measure,
 *   PerformanceObserver (paint), requestIdleCallback e Navigation Timing.
 * CONCEITOS DEMONSTRADOS: performance.mark/measure, PerformanceObserver,
 *   requestIdleCallback/fallback, Navigation Timing, feature detection.
 * USADO EM: seção 12 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: o cleanup desconecta o observer, cancela o idle
 *   pendente e limpa as entradas de performance criadas pela demo.
 */
import { h } from '../core/dom.js';

/** Nomes de mark/measure usados pela demo (evita poluir o PerformanceTimeline). */
const MARK_INICIO = 'demo12:inicio';
const MARK_FIM = 'demo12:fim';
const MEASURE = 'demo12:trabalho';

/**
 * Inicializa a demo de Performance API.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — desconecta observers, cancela idle
 *   e limpa marks/measures
 * @example
 * const cleanup = init(document.querySelector('#demo12'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  /** Fica false no cleanup: callbacks tardios não escrevem no DOM. */
  let ativo = true;

  // ── 1. performance.mark + performance.measure ───────────────────────────────
  const saidaMedicao = h('output', { 'aria-live': 'polite' });

  /**
   * Marca o início e o fim de um trabalho síncrono e mede a distância.
   * O que é: `mark` é um ponto nomeado no PerformanceTimeline; `measure` cria
   * uma entrada com a duração entre dois marks. Por que usei aqui: ao contrário
   * de dois `performance.now()` soltos, a medida fica nomeada, limpa e
   * observável por qualquer PerformanceObserver.
   */
  function medirTrabalho() {
    // limpa execuções anteriores para não acumular entradas iguais
    performance.clearMarks(MARK_INICIO);
    performance.clearMarks(MARK_FIM);
    performance.clearMeasures(MEASURE);

    performance.mark(MARK_INICIO);
    let soma = 0;
    for (let i = 0; i < 300_000; i++) soma = (soma + i) % 999_983;
    performance.mark(MARK_FIM);

    const entrada = performance.measure(MEASURE, MARK_INICIO, MARK_FIM);
    saidaMedicao.textContent =
      `measure "${MEASURE}": ${entrada.duration.toFixed(3)} ms · ` +
      `performance.now() no clique: ${performance.now().toFixed(1)} ms · checksum: ${soma}`;
  }

  const painelMedicao = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'performance.mark / measure' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Medir trabalho síncrono',
        on: { click: medirTrabalho },
      }),
      saidaMedicao,
    ),
    h('p', {
      class: 'nota',
      text: 'As entradas ficam em performance.getEntriesByType("measure") — inspecione no painel de Performance do DevTools.',
    }),
  );

  // ── 2. PerformanceObserver: métricas de pintura (FP / FCP) ──────────────────
  /** @type {PerformanceObserver|null} observer de paint (desconectado no cleanup) */
  let obsPaint = null;
  const listaPaint = h('div', { class: 'grade' });

  // Feature detection: nem todo motor expõe PerformanceObserver nem o tipo 'paint'
  const temObserver = typeof window.PerformanceObserver === 'function';
  const observaPaint =
    temObserver && (window.PerformanceObserver.supportedEntryTypes ?? []).includes('paint');

  if (temObserver && observaPaint) {
    const vistos = new Set();
    obsPaint = new window.PerformanceObserver((lista) => {
      if (!ativo) return;
      for (const entrada of lista.getEntries()) {
        if (vistos.has(entrada.name)) continue; // 'buffered' entrega uma vez
        vistos.add(entrada.name);
        // textContent puro — nome da métrica e tempo nunca viram HTML
        listaPaint.append(
          h('p', {
            text: `${entrada.name}: ${entrada.startTime.toFixed(1)} ms após o início da navegação`,
          }),
        );
      }
    });
    // buffered: true entrega as entradas que JÁ ocorreram (demo montada "tarde")
    obsPaint.observe({ type: 'paint', buffered: true });
  } else {
    listaPaint.append(
      h('p', {
        class: 'nota',
        text: 'PerformanceObserver tipo "paint" indisponível neste navegador — FP/FCP omitidos.',
      }),
    );
  }

  const painelObserver = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'PerformanceObserver: first-paint / first-contentful-paint' }),
    listaPaint,
    h('p', {
      class: 'nota',
      text: 'O mesmo observer também recebe "layout-shift" (CLS) e "largest-contentful-paint" quando suportados.',
    }),
  );

  // ── 3. requestIdleCallback: trabalho quando o navegador está ocioso ─────────
  /** @type {number|null} id do idle agendado (ou do fallback com setTimeout) */
  let idleId = null;
  let idleEmFallback = false;
  const saidaIdle = h('output', { 'aria-live': 'polite' });

  /**
   * Agenda uma tarefa para rodar com folga de quadro.
   * O que é: requestIdleCallback só executa quando o navegador sobrou tempo
   * antes do próximo paint; por que usei aqui: é o lugar certo para trabalho
   * não urgente sem atrasar a renderização (com `timeout` como teto de espera).
   *
   * @param {number} esperaMs trava opcional da UI antes de agendar (0 = nenhuma)
   */
  function agendarIdle(esperaMs) {
    // cancela agenda anterior para não empilhar callbacks
    cancelarIdle();

    if (esperaMs > 0) {
      // trava proposital a main thread — o idle callback ainda roda (dep. do timeout)
      const limite = performance.now() + esperaMs;
      while (performance.now() < limite) {
        // loop vazio de propósito (demo didática de "travar a UI")
      }
    }

    /**
     * Callback comum aos dois caminhos.
     * @param {IdleDeadline|null} prazo deadline do navegador (null no fallback)
     */
    const aoRodar = (prazo) => {
      idleId = null;
      if (!ativo) return;
      const restante = prazo ? Math.max(0, prazo.timeRemaining()).toFixed(2) : '—';
      const origem = idleEmFallback ? ' · fallback setTimeout (sem requestIdleCallback)' : '';
      saidaIdle.textContent = `rodou no idle · tempo livre restante no quadro: ${restante} ms${origem}`;
    };

    const temRic = typeof window.requestIdleCallback === 'function';
    idleEmFallback = !temRic;
    if (temRic) {
      // timeout: 2000 garante execução mesmo com a UI sempre ocupada
      idleId = window.requestIdleCallback(aoRodar, { timeout: 2000 });
    } else {
      idleId = setTimeout(() => aoRodar(null), 50);
    }
  }

  function cancelarIdle() {
    if (idleId === null) return;
    if (idleEmFallback) clearTimeout(idleId);
    else cancelIdleCallback(idleId);
    idleId = null;
  }

  const painelIdle = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'requestIdleCallback' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Agendar no idle',
        on: { click: () => agendarIdle(0) },
      }),
      h('button', {
        type: 'button',
        text: 'Travar UI 300ms e agendar',
        on: { click: () => agendarIdle(300) },
      }),
      saidaIdle,
    ),
    h('p', {
      class: 'nota',
      text: 'Idle ≠ infinito: timeRemaining() mostra os ms livres do quadro; timeout evita starvation.',
    }),
  );

  // ── 4. Navigation Timing: tempos reais desta navegação ──────────────────────
  const painelNavegacao = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Navigation Timing (esta página)' }),
  );
  const nav = /** @type {PerformanceNavigationTiming|null} */ (
    performance.getEntriesByType('navigation')[0] ?? null
  );
  if (nav && typeof nav.responseStart === 'number' && nav.responseStart > 0) {
    const linha = (rotulo, ms) =>
      h('p', { text: `${rotulo}: ${ms > 0 ? `${ms.toFixed(1)} ms` : '— (ainda não ocorreu)'}` });
    painelNavegacao.append(
      h(
        'div',
        { class: 'grade' },
        linha('TTFB (responseStart)', nav.responseStart),
        linha('DOMContentLoaded', nav.domContentLoadedEventEnd),
        linha('load', nav.loadEventEnd),
        linha('redirect (se houve)', nav.redirectEnd - nav.redirectStart),
      ),
    );
  } else {
    painelNavegacao.append(
      h('p', {
        class: 'nota',
        text: 'Navigation Timing indisponível (ou navegação ainda em curso).',
      }),
    );
  }

  container.append(painelMedicao, painelObserver, painelIdle, painelNavegacao);

  // Cleanup: desconecta o observer, cancela o idle pendente e limpa as entradas
  // que a demo criou no PerformanceTimeline. Listeners via h({ on }) morrem com
  // o DOM do container.
  return () => {
    ativo = false;
    obsPaint?.disconnect();
    obsPaint = null;
    cancelarIdle();
    performance.clearMarks(MARK_INICIO);
    performance.clearMarks(MARK_FIM);
    performance.clearMeasures(MEASURE);
  };
}
