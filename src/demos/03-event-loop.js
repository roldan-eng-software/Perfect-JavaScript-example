// @ts-check
/**
 * ARQUIVO: 03-event-loop.js
 * PROPÓSITO: visualizar a ordem de execução da event loop: código síncrono,
 *   microtasks (Promise.then, queueMicrotask) e macrotasks (setTimeout, rAF).
 * CONCEITOS DEMONSTRADOS: event loop, microtask vs macrotask, Promise.then,
 *   queueMicrotask, setTimeout, requestAnimationFrame, microtask aninhada.
 * USADO EM: seção 03 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: a lista mostra a ordem de EXECUÇÃO (numerada em
 *   tempo real), enquanto o texto explicativo mostra a ordem de AGENDAMENTO —
 *   o cleanup cancela timers/rAF pendentes e ignora callbacks tardios.
 */
import { h } from '../core/dom.js';

/** Máximo prático de entradas na lista — ao chegar perto, ela reinicia. */
const LIMITE_ENTRADAS = 15;
/** Entradas produzidas por cada clique em "Executar sequência". */
const ENTRADAS_POR_EXECUCAO = 6;

/**
 * Inicializa a demo visual da event loop.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — cancela setTimeout e rAF pendentes
 * @example
 * const cleanup = init(document.querySelector('#demo03'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  /** @type {Set<ReturnType<typeof setTimeout>>} timers ainda pendentes */
  const timers = new Set();
  /** @type {Set<number>} ids de requestAnimationFrame ainda pendentes */
  const rafs = new Set();

  /** Fica false no cleanup: callbacks que ainda disparem não tocam o DOM. */
  let ativo = true;
  /** Número da próxima entrada (ordem de execução real, monotônica). */
  let ordem = 0;

  // Lista ordenada, vazia no início; aria-live anuncia cada nova entrada.
  // Cada <li> é criado por h() com apenas textContent — nunca innerHTML.
  const lista = h('ol', { 'aria-live': 'polite' });
  const contador = h('output', { text: `0/${LIMITE_ENTRADAS}` });

  /**
   * Registra uma execução na lista, na ordem em que ela de fato acontece.
   *
   * @param {string} rotulo o que rodou (ex.: 'Promise.then → callback')
   * @param {'sync'|'microtask'|'macrotask'|'rAF'} categoria fila de onde veio
   */
  function registrar(rotulo, categoria) {
    if (!ativo) return; // callback tardio pós-cleanup: não escreve no DOM
    ordem += 1;
    // textContent puro: rótulo + categoria + número de ordem numa única string
    lista.append(h('li', { text: `${ordem}º [${categoria}] ${rotulo}` }));
    contador.textContent = `${lista.childElementCount}/${LIMITE_ENTRADAS}`;
  }

  /**
   * Executa a sequência didática, agendando na ordem:
   * sync → Promise.then → queueMicrotask → setTimeout → rAF,
   * com uma microtask aninhada criada DENTRO do callback do Promise.then.
   */
  function executarSequencia() {
    if (!ativo) return;

    // Reinicia quando a próxima execução estouraria o limite (~15 entradas)
    if (lista.childElementCount + ENTRADAS_POR_EXECUCAO > LIMITE_ENTRADAS) {
      lista.replaceChildren();
      ordem = 0;
      contador.textContent = `0/${LIMITE_ENTRADAS}`;
    }

    // 1) SYNC: roda imediatamente dentro desta própria tarefa (mesmo stack).
    registrar('código síncrono do clique', 'sync');

    // 2) MICROTASK via Promise.then: enfileirada agora, esvazia ANTES de qualquer
    //    timer — a promise já resolvida não "pula" a fila, só muda de fila.
    Promise.resolve().then(() => {
      registrar('Promise.then → callback', 'microtask');
      // 4) MICROTASK ANINHADA: nascida dentro de outra microtask, ela entra no
      //    FIM da fila já em execução e roda ainda nesta drenagem de microtasks.
      queueMicrotask(() => registrar('microtask aninhada (criada dentro do then)', 'microtask'));
    });

    // 3) MICROTASK via queueMicrotask: mesma fila do Promise.then, FIFO —
    //    foi agendada depois, então roda depois do then (acima).
    queueMicrotask(() => registrar('queueMicrotask → callback', 'microtask'));

    // 5) MACROTASK via setTimeout: tarefa própria; só roda depois que TODAS as
    //    microtasks pendentes forem esgotadas (limpeza da pilha atual).
    const idTimer = setTimeout(() => {
      timers.delete(idTimer);
      registrar('setTimeout(0) → callback', 'macrotask');
    }, 0);
    timers.add(idTimer);

    // 6) rAF: roda antes do próximo paint (quadro do navegador) — normalmente
    //    DEPOIS do setTimeout(0), que já é elegível como tarefa imediata.
    const idRaf = requestAnimationFrame(() => {
      rafs.delete(idRaf);
      registrar('requestAnimationFrame → callback', 'rAF');
    });
    rafs.add(idRaf);
  }

  const painel = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Ordem de execução: microtasks × macrotasks' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: 'Executar sequência', on: { click: executarSequencia } }),
      h('span', { class: 'nota', text: 'entradas: ' }),
      contador,
    ),
    lista,
    h('p', {
      class: 'nota',
      text:
        'Ordem de AGENDAMENTO: sync → Promise.then → queueMicrotask → setTimeout → rAF. ' +
        'Ordem de EXECUÇÃO (a lista): sync → microtasks (then → queueMicrotask → aninhada) ' +
        '→ setTimeout → rAF.',
    }),
    h('p', {
      class: 'nota',
      text:
        'Microtasks esvaziam a pilha antes de qualquer tarefa; a lista reinicia ao passar de ' +
        `${LIMITE_ENTRADAS} entradas.`,
    }),
  );

  container.append(painel);

  // Cleanup: cancela o que ainda estiver agendado. Microtasks não têm API de
  // cancelamento — por isso a flag `ativo` ignora qualquer callback tardio.
  return () => {
    ativo = false;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const id of rafs) cancelAnimationFrame(id);
    rafs.clear();
  };
}
