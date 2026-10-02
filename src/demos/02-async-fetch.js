// @ts-check
/**
 * ARQUIVO: 02-async-fetch.js
 * PROPÓSITO: demonstrar async/await + fetch com Promise.all, allSettled e race,
 *   cancelamento (AbortController / AbortSignal.timeout) e retry com backoff.
 * CONCEITOS DEMONSTRADOS: async/await, fetch, Promise.all/allSettled/race,
 *   AbortController, AbortSignal.timeout, máquina de estados, attemptWithRetry.
 * USADO EM: seção 02 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: cada operação em voo tem seu AbortController e seus
 *   timers são rastreados — o cleanup aborta/cancela tudo; listeners criados via
 *   h({ on }) morrem junto com o DOM do container.
 */
import { h } from '../core/dom.js';
import { sleep } from '../utils/sleep.js';
import { attemptWithRetry } from '../utils/retry.js';

/** Caminhos relativos a este módulo — resolvem certo em qualquer host/porta. */
const URL_PROJECTS = new URL('../../data/projects.json', import.meta.url);
const URL_QUOTES = new URL('../../data/quotes.json', import.meta.url);
/** URL inexistente de propósito: força o estado "erro" em allSettled. */
const URL_INVALIDA = new URL('../../data/nao-existe.json', import.meta.url);

/**
 * Estados possíveis da máquina de estados (transição só entre estes).
 * @type {readonly string[]}
 */
const ESTADOS = Object.freeze(['ocioso', 'carregando', 'sucesso', 'erro', 'vazio']);

/**
 * Cria a região visual da máquina de estados: estado atual + histórico curto.
 *
 * O nó é `role="status" aria-live="polite"` — leitores de tela anunciam cada
 * transição (inclusive o "carregando") sem roubar o foco de quem navega.
 *
 * @returns {{ regiao: HTMLElement, transicionar: (estado: string, detalhe: string) => void }}
 * região para anexar ao DOM e função que aplica uma transição
 * @throws {RangeError} se `estado` não for um dos estados conhecidos
 * @example
 * const maquina = criarMaquinaEstados();
 * maquina.transicionar('carregando', 'projects.json');
 */
function criarMaquinaEstados() {
  const atual = h('p', { class: 'nota', text: 'estado: ocioso' });
  const historico = h('ul', { class: 'nota' });
  const regiao = h(
    'div',
    { class: 'linha', role: 'status', 'aria-live': 'polite' },
    h('h3', { text: 'Máquina de estados (fetch)' }),
    atual,
    historico,
  );

  function transicionar(estado, detalhe) {
    if (!ESTADOS.includes(estado)) {
      throw new RangeError(`máquina de estados: estado desconhecido "${estado}".`);
    }
    atual.textContent = `estado: ${estado} — ${detalhe}`;
    // prepend + recorte mantém o histórico legível (máx. 5 entradas)
    historico.prepend(h('li', { text: `${estado}: ${detalhe}` }));
    while (historico.childElementCount > 5) historico.lastElementChild?.remove();
  }

  return { regiao, transicionar };
}

/**
 * Inicializa a demo de async/await + fetch.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — aborta controllers e cancela timers
 * @example
 * const cleanup = init(document.querySelector('#demo02'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  /** @type {Set<AbortController>} controllers de requisições em voo */
  const controllers = new Set();
  /** @type {Set<ReturnType<typeof setTimeout>>} timers pendentes (canceláveis no cleanup) */
  const timers = new Set();

  const maquina = criarMaquinaEstados();

  // ── fetch: helper com caminho relativo ao módulo e checagem de status HTTP ──
  /**
   * Busca JSON e lança Error se a resposta não for 2xx.
   * Passa o `signal` para que o cleanup possa abortar a requisição em voo.
   *
   * @param {URL} caminho URL relativa (resolvida contra import.meta.url)
   * @param {AbortSignal} [signal] cancela a requisição
   * @returns {Promise<any>} corpo da resposta já convertido em objeto
   * @throws {Error} se `resposta.ok` for falso (404, 500…)
   */
  async function buscarJson(caminho, signal) {
    const resposta = await fetch(caminho, { signal });
    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status} ao buscar ${caminho.pathname.split('/').pop()}`);
    }
    return resposta.json();
  }

  /** Cria um AbortController rastreado (abortado no cleanup se ainda estiver em voo). */
  function novoController() {
    const controller = new AbortController();
    controllers.add(controller);
    return controller;
  }

  /** Agenda um timeout rastreado — devolve o id e o remove do rastreio ao disparar. */
  function agendar(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  /**
   * Extrai o array de itens de um JSON (formato { projects: [...] } / { quotes: [...] }).
   *
   * @param {any} dados corpo da resposta
   * @returns {any[]} primeiro array encontrado (ou vazio)
   */
  function extrairItens(dados) {
    if (Array.isArray(dados)) return dados;
    for (const valor of Object.values(dados ?? {})) {
      if (Array.isArray(valor)) return valor;
    }
    return [];
  }

  // ── Saídas (detalhe dos dados não precisa ser aria-live: a máquina já announce) ──
  const saidaProjects = h('div', { class: 'grade' });
  const saidaQuotes = h('div', { class: 'grade' });
  const saidaVazio = h('p', { class: 'nota' });

  /**
   * Renderiza itens de texto numa grade — sempre via textContent (sem innerHTML),
   * então dado vindo da rede nunca é interpretado como HTML.
   *
   * @param {HTMLElement} destino elemento que receberá os filhos
   * @param {any[]} itens lista a renderizar
   * @param {(item: any) => string} formato transforma cada item em texto
   */
  function renderizarItens(destino, itens, formato) {
    destino.replaceChildren();
    if (itens.length === 0) {
      destino.append(h('p', { class: 'nota', text: 'Nenhum item para exibir (lista vazia).' }));
      return;
    }
    for (const item of itens) destino.append(h('p', { text: formato(item) }));
  }

  // ── 1. Carregamentos individuais: carregando → sucesso/erro/vazio ────────────
  /**
   * Carrega um recurso e conduz a máquina de estados pela transição completa.
   *
   * @param {string} nome rótulo curto (ex.: 'projects.json')
   * @param {URL} caminho URL do JSON
   * @param {HTMLElement} destino grade onde o resultado é renderizado
   * @returns {Promise<void>} resolve após a transição final
   */
  async function carregarRecurso(nome, caminho, destino) {
    const controller = novoController();
    maquina.transicionar('carregando', `${nome} — aguardando resposta…`);
    try {
      const dados = await buscarJson(caminho, controller.signal);
      const itens = extrairItens(dados);
      if (itens.length === 0) {
        // estado vazio: resposta OK mas sem itens — ≠ de erro
        maquina.transicionar('vazio', `${nome} respondeu sem itens`);
      } else {
        maquina.transicionar('sucesso', `${nome}: ${itens.length} itens carregados`);
      }
      renderizarItens(destino, itens, formatoDe(nome));
    } catch (erro) {
      maquina.transicionar(
        'erro',
        `${nome}: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
      renderizarItens(destino, [], formatoDe(nome));
    } finally {
      controllers.delete(controller);
    }
  }

  /**
   * Escolhe o formatador de item de acordo com o recurso (projetos ou citações).
   *
   * @param {string} nome rótulo do recurso
   * @returns {(item: any) => string} transforma o item em texto (via textContent)
   */
  function formatoDe(nome) {
    if (nome.startsWith('projects')) {
      return (p) => `${p.name} · ${p.language} · ★ ${p.stars}`;
    }
    return (q) => `“${q.text}” — ${q.author} (${q.lang})`;
  }

  // ── 2. Promise.all: duas cargas em paralelo, erro em uma falha o grupo ───────
  /**
   * Dispara as duas cargas ao mesmo tempo e só resolve quando AMBAS terminam.
   * `Promise.all` rejeita no primeiro erro — por isso há try/catch no grupo.
   *
   * @returns {Promise<void>} resolve quando o par termina
   */
  async function carregarTudoComAll() {
    const controller = novoController();
    maquina.transicionar('carregando', 'Promise.all — projects + quotes em paralelo…');
    try {
      const [projects, quotes] = await Promise.all([
        buscarJson(URL_PROJECTS, controller.signal),
        buscarJson(URL_QUOTES, controller.signal),
      ]);
      const total = extrairItens(projects).length + extrairItens(quotes).length;
      maquina.transicionar('sucesso', `Promise.all ok — ${total} itens no total`);
      renderizarItens(saidaProjects, extrairItens(projects), (p) => `${p.name} ★ ${p.stars}`);
      renderizarItens(saidaQuotes, extrairItens(quotes), (q) => `“${q.text}” — ${q.author}`);
    } catch (erro) {
      maquina.transicionar('erro', `Promise.all: ${erro instanceof Error ? erro.message : erro}`);
    } finally {
      controllers.delete(controller);
    }
  }

  // ── 3. Promise.allSettled: nunca rejeita — devolve o status de cada item ─────
  const saidaSettled = h('div', { class: 'grade', role: 'status', 'aria-live': 'polite' });

  /**
   * Executa três cargas (duas válidas + uma 404 de propósito) e mostra o status
   * individual de cada uma — `allSettled` resolve sempre, com {status, value|reason}.
   *
   * @returns {Promise<void>} resolve quando as três terminam
   */
  async function carregarComAllSettled() {
    maquina.transicionar('carregando', 'Promise.allSettled — 3 cargas (uma vai falhar)…');
    const controller = novoController();
    const rotulos = ['projects.json', 'quotes.json', 'nao-existe.json'];
    const resultados = await Promise.allSettled([
      buscarJson(URL_PROJECTS, controller.signal),
      buscarJson(URL_QUOTES, controller.signal),
      buscarJson(URL_INVALIDA, controller.signal),
    ]);
    controllers.delete(controller);

    let sucessos = 0;
    saidaSettled.replaceChildren();
    resultados.forEach((resultado, i) => {
      if (resultado.status === 'fulfilled') {
        sucessos += 1;
        const qtd = extrairItens(resultado.value).length;
        saidaSettled.append(h('p', { text: `✔ ${rotulos[i]}: fulfilled (${qtd} itens)` }));
      } else {
        const motivo = resultado.reason instanceof Error ? resultado.reason.message : 'falhou';
        saidaSettled.append(h('p', { text: `✘ ${rotulos[i]}: rejected (${motivo})` }));
      }
    });

    // 2 fulfilled + 1 rejected → sucesso parcial é esperado, não é erro
    maquina.transicionar(
      sucessos === 3 ? 'sucesso' : 'erro',
      `allSettled: ${sucessos}/3 fulfilled (nenhuma exceção escapou)`,
    );
  }

  /** Simula servidor respondendo JSON válido porém sem itens (estado "vazio"). */
  function simularVazio() {
    maquina.transicionar('vazio', 'resposta simulada: 0 itens');
    renderizarItens(saidaProjects, [], (p) => p.name);
    renderizarItens(saidaQuotes, [], (q) => q.text);
    saidaVazio.textContent = 'Estado vazio ≠ erro: HTTP ok, só não há o que mostrar.';
  }

  const painelFetch = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'fetch + async/await' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Carregar projects.json',
        on: { click: () => void carregarRecurso('projects.json', URL_PROJECTS, saidaProjects) },
      }),
      h('button', {
        type: 'button',
        text: 'Carregar quotes.json',
        on: { click: () => void carregarRecurso('quotes.json', URL_QUOTES, saidaQuotes) },
      }),
      h('button', {
        type: 'button',
        text: 'Promise.all (ambos)',
        on: { click: () => void carregarTudoComAll() },
      }),
      h('button', {
        type: 'button',
        text: 'Promise.allSettled (3 cargas)',
        on: { click: () => void carregarComAllSettled() },
      }),
      h('button', { type: 'button', text: 'Simular resposta vazia', on: { click: simularVazio } }),
    ),
    saidaProjects,
    saidaQuotes,
    saidaSettled,
    saidaVazio,
    h('p', {
      class: 'nota',
      text: 'fetch usa new URL(..., import.meta.url): o caminho do JSON é resolvido relativo a este módulo.',
    }),
  );

  // ── 4. Promise.race + AbortSignal.timeout ───────────────────────────────────
  const saidaRace = h('output', { 'aria-live': 'polite' });

  /**
   * Promise que rejeita quando o `AbortSignal.timeout(ms)` abortar.
   * `AbortSignal.timeout` é um signal que expira sozinho — ideal para limitar
   * tempo de resposta sem gerar um setTimeout "solto" (feature-detect abaixo).
   *
   * @param {number} ms milissegundos até o timeout
   * @returns {Promise<void>} promise que rejeita com o motivo do timeout
   */
  function promessaDeTimeout(ms) {
    const sinal = window.AbortSignal?.timeout?.(ms);
    if (sinal) {
      return new Promise((_resolve, reject) => {
        if (sinal.aborted) {
          reject(sinal.reason);
          return;
        }
        sinal.addEventListener('abort', () => reject(sinal.reason), { once: true });
      });
    }
    // Fallback p/ navegadores sem AbortSignal.timeout: timer comum rastreado
    return new Promise((_resolve, reject) => {
      agendar(() => reject(new DOMException('Timeout', 'TimeoutError')), ms);
    });
  }

  /**
   * Corrida entre uma "requisição" simulada (sleep) e o timeout.
   * `Promise.race` resolve/rejeita com o PRIMEIRO a terminar — os dois lados
   * são cancelados em `finally` para não deixar timer ou request pendurado.
   *
   * @param {number} msRequisição latência simulada da requisição
   * @param {number} msTimeout limite de tempo
   * @returns {Promise<void>} resolve se a requisição vence; rejeita se o timeout
   */
  async function corridaComTimeout(msRequisição, msTimeout) {
    const controller = novoController();
    const t0 = performance.now();
    try {
      // Lado A: requisição simulada — sleep cancelável via signal
      const lenta = sleep(msRequisição, { signal: controller.signal }).then(() => 'resposta');
      // Lado B: timeout autodestrutivo
      await Promise.race([lenta, promessaDeTimeout(msTimeout)]);
      const ms = Math.round(performance.now() - t0);
      maquina.transicionar('sucesso', `race: requisição venceu em ${ms} ms`);
    } catch (erro) {
      const ms = Math.round(performance.now() - t0);
      const nome = erro instanceof Error ? erro.name : 'erro';
      maquina.transicionar(
        'erro',
        `race: timeout venceu em ${ms} ms (${nome}) — requisição descartada`,
      );
    } finally {
      // abortar cancela o sleep (clearTimeout interno) — sem timer órfão
      controller.abort();
      controllers.delete(controller);
    }
  }

  const painelRace = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Promise.race + AbortSignal.timeout' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Race: lenta 1500ms × timeout 400ms',
        on: { click: () => void corridaComTimeout(1500, 400) },
      }),
      h('button', {
        type: 'button',
        text: 'Race: rápida 200ms × timeout 600ms',
        on: { click: () => void corridaComTimeout(200, 600) },
      }),
      saidaRace,
    ),
    h('p', {
      class: 'nota',
      text: 'O lado perdedor é abortado no finally: cancela o sleep e evita trabalho fantasma.',
    }),
  );

  // ── 5. AbortController: cancelar uma requisição em voo pelo usuário ─────────
  const saidaCancel = h('output', { 'aria-live': 'polite' });
  /** @type {AbortController|null} controller da simulação atual (null = nada em voo) */
  let controllerSimulacao = null;

  function iniciarSimulacao() {
    controllerSimulacao?.abort(); // reiniciar cancela a anterior
    const controller = novoController();
    controllerSimulacao = controller;
    saidaCancel.textContent = '⏳ em andamento (3000 ms)… clique em "Cancelar"';

    // sleep aceita signal: abort() rejeita a promise imediatamente com AbortError
    void sleep(3000, { signal: controller.signal }).then(
      () => {
        saidaCancel.textContent = '✔ concluído — o usuário NÃO cancelou a tempo.';
        controllers.delete(controller);
        controllerSimulacao = null;
      },
      (erro) => {
        saidaCancel.textContent = `✖ cancelado pelo usuário (${erro?.name ?? 'AbortError'})`;
        controllers.delete(controller);
        controllerSimulacao = null;
      },
    );
  }

  function cancelarSimulacao() {
    if (!controllerSimulacao) {
      saidaCancel.textContent = 'Nada em voo para cancelar.';
      return;
    }
    controllerSimulacao.abort();
  }

  const painelCancel = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'AbortController: cancelar requisição em voo' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Iniciar simulação (3s)',
        on: { click: iniciarSimulacao },
      }),
      h('button', { type: 'button', text: 'Cancelar', on: { click: cancelarSimulacao } }),
      saidaCancel,
    ),
    h('p', {
      class: 'nota',
      text: 'O mesmo signal vai para fetch/sleep: um único .abort() encerra a operação inteira.',
    }),
  );

  // ── 6. Retry com backoff (attemptWithRetry) ─────────────────────────────────
  const logRetry = h('ul', { class: 'nota', role: 'status', 'aria-live': 'polite' });

  function registrarRetry(texto) {
    logRetry.append(h('li', { text: texto }));
  }

  /**
   * Demonstra retry: o contador faz as 2 primeiras tentativas falharem e a 3ª
   * busca o JSON de verdade. O `sleep` injetado resolve na hora (demo ágil) —
   * mesma técnica usada nos testes para rodar sem espera real.
   *
   * @returns {Promise<void>} resolve quando o retry termina (sucesso ou esgotado)
   */
  async function executarRetry() {
    logRetry.replaceChildren();
    maquina.transicionar('carregando', 'retry — tentativa 1 de até 4…');
    let tentativas = 0;

    try {
      const dados = await attemptWithRetry(
        async () => {
          tentativas += 1;
          if (tentativas <= 2) {
            // falha simulada 2× — na 3ª o fetch de verdade acontece
            throw new Error(`falha simulada na tentativa ${tentativas}`);
          }
          return buscarJson(URL_QUOTES);
        },
        {
          retries: 3,
          baseDelay: 100,
          factor: 2,
          sleep: () => Promise.resolve(), // backoff instantâneo p/ demo snappy
          onRetry: (n, erro) =>
            registrarRetry(`tentativa ${n} falhou (${erro.message}) → nova tentativa`),
        },
      );
      const qtd = extrairItens(dados).length;
      registrarRetry(`sucesso na tentativa ${tentativas}: ${qtd} citações`);
      maquina.transicionar('sucesso', `retry ok após ${tentativas} tentativas`);
      renderizarItens(saidaQuotes, extrairItens(dados), (q) => `“${q.text}” — ${q.author}`);
    } catch (erro) {
      registrarRetry(`esgotado: ${erro instanceof Error ? erro.message : String(erro)}`);
      maquina.transicionar('erro', 'retry esgotou as tentativas');
    }
  }

  const painelRetry = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'attemptWithRetry: falha 2× e sucesso' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Executar retry',
        on: { click: () => void executarRetry() },
      }),
    ),
    logRetry,
    h('p', {
      class: 'nota',
      text: 'Backoff exponencial: 100 ms, 200 ms, 400 ms entre tentativas (aqui instantâneos via sleep injetado).',
    }),
  );

  container.append(painelFetch, maquina.regiao, painelRace, painelCancel, painelRetry);

  // Cleanup: aborta o que ainda estiver em voo e cancela timers pendentes.
  // Os listeners entretidos via h({ on }) morrem com o próprio DOM do container.
  return () => {
    for (const controller of controllers) controller.abort();
    controllers.clear();
    controllerSimulacao = null;
    for (const id of timers) clearTimeout(id);
    timers.clear();
  };
}
