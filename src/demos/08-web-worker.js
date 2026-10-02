// @ts-check
/**
 * ARQUIVO: 08-web-worker.js
 * PROPÓSITO: mostrar Web Worker na prática — cálculo pesado com progresso e
 *   cancelamento fora da main thread, contrastado com o MESMO tipo de carga
 *   rodando na main thread (jank medido por frames de requestAnimationFrame).
 * CONCEITOS DEMONSTRADOS: Web Worker, postMessage/terminate, import.meta.url,
 *   feature detection, requestAnimationFrame vs trabalho síncrono, ARIA
 *   progressbar/aria-live, performance.now.
 * USADO EM: seção 08 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: o worker é criado sob demanda e destruído no
 *   cleanup (worker.terminate()) — sem isso a thread ficaria viva após a seção
 *   sair da viewport.
 */
import { h, on } from '../core/dom.js';
import { formatNumber } from '../utils/format.js';

/** Duração do travamento síncrono da UI, em ms. */
const DURACAO_JANK_MS = 3000;

/**
 * Inicializa a demo de Web Worker.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — cancela rAF/timers e encerra o worker
 * @example
 * const cleanup = init(document.querySelector('#demo08'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  // ── estado da demo ─────────────────────────────────────────────────────────
  /** @type {Worker|null} */ let worker = null;
  /** @type {(() => void)|null} */ let removerMensagem = null;
  /** @type {(() => void)|null} */ let removerErro = null;
  let rafContador = 0;
  let rafBaseline = 0;
  let timerJank = 0;
  let encerrado = false;

  // Feature detection: Worker existe? Sem ele, mostramos fallback e seguimos.
  const suportaWorker = typeof Worker === 'function';

  // ── barra de progresso acessível ───────────────────────────────────────────
  /**
   * Cria uma barra com role="progressbar" — o que é: régua nativa de ARIA que
   * leitores de tela anunciam como "X%"; por que usei aqui: o progresso do
   * worker precisa ser percebido também sem visão.
   *
   * @param {string} rotulo rótulo acessível da barra
   * @returns {HTMLDivElement} barra (1º filho = preenchimento)
   */
  function criarBarra(rotulo) {
    const preenchido = h('span', {
      style: 'display:block;height:100%;width:0%;background:#1f6feb;transition:width .15s linear',
    });
    const barra = h(
      'div',
      {
        role: 'progressbar',
        'aria-label': rotulo,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        style: 'height:.75rem;background:#e6e6e6;border-radius:4px;overflow:hidden',
      },
      preenchido,
    );
    return /** @type {HTMLDivElement} */ (barra);
  }

  /**
   * Atualiza valor ARIA e visual da barra.
   *
   * @param {HTMLDivElement} barra barra criada por criarBarra
   * @param {number} pct percentual 0–100
   */
  function atualizarBarra(barra, pct) {
    const limite = Math.min(100, Math.max(0, Math.round(pct)));
    barra.setAttribute('aria-valuenow', String(limite));
    barra.setAttribute('aria-valuetext', `${limite}%`);
    const preenchido = barra.firstElementChild;
    if (preenchido instanceof HTMLElement) preenchido.style.width = `${limite}%`;
  }

  // ── UI: seção 1 — worker ───────────────────────────────────────────────────
  const barraPrimos = criarBarra('Progresso: contagem de primos no worker');
  const barraOrdenar = criarBarra('Progresso: ordenação de 1 milhão no worker');
  const statusWorker = h('output', { 'aria-live': 'polite', text: 'pronto.' });
  const resumoWorker = h('p', { class: 'nota', 'aria-live': 'polite' });

  const botaoPrimos = h('button', {
    type: 'button',
    text: 'Rodar no Worker (primos 300k)',
    on: { click: () => rodarNoWorker({ tipo: 'primos', limite: 300_000 }) },
  });
  const botaoOrdenar = h('button', {
    type: 'button',
    text: 'Ordenar 1M no worker',
    on: { click: () => rodarNoWorker({ tipo: 'ordenar', itens: 1_000_000 }) },
  });
  const botaoCancelar = h('button', {
    type: 'button',
    text: 'Cancelar',
    on: { click: cancelarWorker },
  });

  const avisoWorker = h('p', {
    class: 'nota erro',
    role: 'status',
    'aria-live': 'polite',
    text: suportaWorker
      ? ''
      : 'Seu navegador não suporta Web Worker — os botões de cálculo ficaram desativados; compare abaixo com a versão que trava a UI.',
  });

  if (!suportaWorker) {
    botaoPrimos.disabled = true;
    botaoOrdenar.disabled = true;
    botaoCancelar.disabled = true;
  }

  // ── UI: seção 2 — jank na main thread ──────────────────────────────────────
  const contadorTrabalho = h('output', { text: 'aguardando execução…' });
  const contadorFrames = h('p', {
    class: 'nota',
    text: 'frames renderizados durante o cálculo: 0',
  });
  const linhaFrames = h('p', { class: 'nota', 'aria-live': 'polite', text: 'frames: — vs —' });

  const botaoTravar = h('button', {
    type: 'button',
    text: 'Travar a UI (3s)',
    on: { click: () => void travarUI() },
  });

  // ── ciclo de vida do worker ────────────────────────────────────────────────
  /**
   * Obtém (criando sob demanda) o worker da demo, com feature detection e
   * try/catch: arquivo ausente/caminho errado/`file://` lançam aqui.
   *
   * @returns {Worker|null} worker pronto ou null se indisponível
   */
  function obterWorker() {
    if (!suportaWorker) return null;
    if (worker) return worker;
    try {
      // new URL + import.meta.url: caminho resolvido contra ESTE módulo,
      // sobrevive a mudanças de base de URL (serve, Vite, GitHub Pages…).
      worker = new Worker(new URL('../../workers/heavy-task.worker.js', import.meta.url), {
        type: 'module',
      });
      removerMensagem = on(worker, 'message', aoReceberMensagem);
      removerErro = on(worker, 'error', (evento) => {
        const mensagem = /** @type {{ message?: string }} */ (evento).message;
        statusWorker.textContent = `erro no worker: ${mensagem ?? 'falha ao carregar o arquivo'}`;
      });
      statusWorker.textContent = 'worker criado.';
      return worker;
    } catch (erro) {
      worker = null;
      statusWorker.textContent = `worker indisponível: ${erro instanceof Error ? erro.message : String(erro)}`;
      return null;
    }
  }

  /** Remove os listeners do worker atual (sem terminate). */
  function soltarOuvintesWorker() {
    removerMensagem?.();
    removerErro?.();
    removerMensagem = null;
    removerErro = null;
  }

  /**
   * Processa as mensagens vindas do worker: progresso → barra da tarefa;
   * resultado → linha aria-live com tempos formatados.
   *
   * @param {MessageEvent} evento evento 'message'
   */
  function aoReceberMensagem(evento) {
    const msg = /** @type {{ tipo?: string, pct?: number, tarefa?: string,
      primos?: number, total?: number, itens?: number, ms?: number }} */ (evento.data);
    if (!msg || typeof msg.tipo !== 'string') return;

    if (msg.tipo === 'progresso') {
      const pct = typeof msg.pct === 'number' ? msg.pct : 0;
      atualizarBarra(msg.tarefa === 'ordenar' ? barraOrdenar : barraPrimos, pct);
      return;
    }

    if (msg.tipo === 'resultado') {
      const ms = typeof msg.ms === 'number' ? msg.ms : 0;
      if (msg.tarefa === 'ordenar') {
        atualizarBarra(barraOrdenar, 100);
        statusWorker.textContent = 'ordenação concluída.';
        resumoWorker.textContent = `${formatNumber(msg.itens ?? 0)} inteiros ordenados em ${ms.toFixed(1)} ms (merge sort no worker).`;
      } else {
        atualizarBarra(barraPrimos, 100);
        statusWorker.textContent = 'contagem concluída.';
        resumoWorker.textContent =
          `${formatNumber(msg.primos ?? 0)} primos até ${formatNumber(msg.total ?? 0)} ` +
          `em ${ms.toFixed(1)} ms — e a UI continuou respondendo.`;
      }
    }
  }

  /**
   * Envia uma tarefa ao worker (criando-o se preciso).
   *
   * @param {{ tipo: string, limite?: number, itens?: number }} comando mensagem de comando
   */
  function rodarNoWorker(comando) {
    const alvo = obterWorker();
    if (!alvo) return;
    resumoWorker.textContent = '';
    if (comando.tipo === 'ordenar') {
      atualizarBarra(barraOrdenar, 0);
      statusWorker.textContent = 'ordenando 1M de inteiros…';
    } else {
      atualizarBarra(barraPrimos, 0);
      statusWorker.textContent = 'calculando primos…';
    }
    alvo.postMessage(comando);
  }

  /**
   * Cancela o cálculo: terminate() mata a thread inteira (não há "pausa" em um
   * worker puro) — em seguida descartamos a referência para a próxima tarefa
   * recriar um worker limpo.
   */
  function cancelarWorker() {
    soltarOuvintesWorker();
    worker?.terminate();
    worker = null;
    statusWorker.textContent = 'cancelado';
    resumoWorker.textContent = 'worker encerrado — clique em um botão para recomeçar.';
  }

  // ── demo de jank: rAF vs trabalho síncrono ─────────────────────────────────
  /**
   * Mede quantos frames o navegador renderizaria em `ms` SEM bloqueio.
   *
   * @param {number} ms janela de medição
   * @returns {Promise<number>} quantidade de callbacks de rAF na janela
   */
  function medirFrames(ms) {
    return new Promise((resolve) => {
      const inicio = performance.now();
      let total = 0;
      const passo = (timestamp) => {
        if (encerrado) {
          resolve(total);
          return;
        }
        total += 1;
        if (timestamp - inicio < ms) {
          rafBaseline = requestAnimationFrame(passo);
        } else {
          resolve(total);
        }
      };
      rafBaseline = requestAnimationFrame(passo);
    });
  }

  /**
   * Laço CPU-bound síncrono de ~`duracaoMs` — o que é: nada aqui cede a main
   * thread; por que usei aqui: é exatamente o padrão que provoca jank para
   * comparar com a versão no worker.
   *
   * @param {number} duracaoMs duração alvo em ms
   * @returns {void}
   */
  function trabalhoSincrono(duracaoMs) {
    const inicio = performance.now();
    let iteracoes = 0;
    let ultimoTexto = 0;
    while (performance.now() - inicio < duracaoMs) {
      for (let i = 0; i < 20_000; i++) iteracoes += Math.sqrt(i) % 7;
      const decorrido = performance.now() - inicio;
      if (decorrido - ultimoTexto >= 200) {
        ultimoTexto = decorrido;
        // Escreve no DOM "ao vivo", mas o navegador só pinta DEPOIS do laço:
        // é o congelamento visual que o worker elimina.
        contadorTrabalho.textContent = `${formatNumber(iteracoes)} iterações · ${decorrido.toFixed(0)} ms`;
      }
    }
    contadorTrabalho.textContent = `${formatNumber(iteracoes)} iterações · concluídas em ${duracaoMs} ms`;
  }

  /**
   * Executa a sequência: mede baseline → inicia contador de rAF → trava a UI →
   * compara "frames: X vs Y".
   *
   * @returns {Promise<void>}
   */
  async function travarUI() {
    botaoTravar.disabled = true;
    try {
      linhaFrames.textContent = 'mediando baseline por rAF…';
      const framesBase = await medirFrames(500);
      if (encerrado) return;
      const fps = Math.round((framesBase / 500) * 1000);
      const esperados = Math.round((framesBase / 500) * DURACAO_JANK_MS);

      contadorFrames.textContent = 'frames renderizados durante o cálculo: 0';
      const inicio = performance.now();
      let framesDurante = 0;
      const passo = (timestamp) => {
        framesDurante += 1;
        // Congela aqui dentro: o laço síncrono impede novos callbacks de rAF.
        contadorFrames.textContent = `frames renderizados durante o cálculo: ${framesDurante}`;
        if (timestamp - inicio < DURACAO_JANK_MS) {
          rafContador = requestAnimationFrame(passo);
        }
      };
      rafContador = requestAnimationFrame(passo);

      // Deixa 1–2 quadros renderizarem antes de travar (mostra a "congelação")
      await new Promise((resolver) => {
        timerJank = setTimeout(resolver, 64);
      });
      if (encerrado) return;

      trabalhoSincrono(DURACAO_JANK_MS);
      cancelAnimationFrame(rafContador);
      rafContador = 0;

      contadorFrames.textContent = `frames renderizados durante o cálculo: ${framesDurante}`;
      linhaFrames.textContent =
        `frames: ${framesDurante} vs ${esperados} ` +
        `(janela travada vs 3s sem bloqueio a ~${fps} fps) — o contador de rAF congela enquanto a main thread está ocupada.`;
    } finally {
      botaoTravar.disabled = false;
    }
  }

  // ── montagem ───────────────────────────────────────────────────────────────
  const secaoWorker = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Cálculo pesado no worker' }),
    h('div', { class: 'botoes' }, botaoPrimos, botaoOrdenar, botaoCancelar),
    h('p', { class: 'nota', text: 'primos até 300.000:' }),
    barraPrimos,
    h('p', { class: 'nota', text: 'ordenar 1.000.000 de inteiros:' }),
    barraOrdenar,
    statusWorker,
    resumoWorker,
    ...(suportaWorker ? [] : [avisoWorker]),
    h('p', {
      class: 'nota',
      text: 'progresso chega por postMessage({ tipo: "progresso" }) e cancelar chama worker.terminate().',
    }),
  );

  const secaoJank = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Cálculo travando a UI' }),
    h('div', { class: 'botoes' }, botaoTravar),
    h('p', { class: 'nota', text: 'contador de trabalho (só pinta após o laço): ' }),
    contadorTrabalho,
    contadorFrames,
    linhaFrames,
    h('p', {
      class: 'nota',
      text: 'Mesmo workload (~3 s), só que na main thread: rolagem, cliques e animações ficam congelados até o laço terminar.',
    }),
  );

  container.append(secaoWorker, secaoJank);

  // Cleanup: mata timers/rAF pendentes e a thread do worker de vez.
  return () => {
    encerrado = true;
    soltarOuvintesWorker();
    if (rafContador) cancelAnimationFrame(rafContador);
    if (rafBaseline) cancelAnimationFrame(rafBaseline);
    if (timerJank) clearTimeout(timerJank);
    worker?.terminate();
    worker = null;
  };
}
