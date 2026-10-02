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
import { tr } from '../core/i18n.js';
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

/** Dicionário de strings da demo — tr() lê o idioma ativo em tempo de render. */
const STRINGS = {
  'en-US': {
    'machine.title': 'State machine (fetch)',
    'state.initial': 'state: idle',
    'state.line': 'state: {estado} — {detalhe}',
    'state.history': '{estado}: {detalhe}',
    'state.ocioso': 'idle',
    'state.carregando': 'loading',
    'state.sucesso': 'success',
    'state.erro': 'error',
    'state.vazio': 'empty',
    'state.unknown': 'state machine: unknown state "{estado}".',
    'error.http': 'HTTP {status} while fetching {arquivo}',
    'error.generic': 'error',
    'detail.waiting': '{nome} — waiting for response…',
    'detail.noItems': '{nome} responded with no items',
    'detail.loaded': '{nome}: {qtd} items loaded',
    'items.none': 'No items to show (empty list).',
    'all.waiting': 'Promise.all — projects + quotes in parallel…',
    'all.success': 'Promise.all ok — {total} items total',
    'empty.simulated': 'simulated response: 0 items',
    'empty.note': 'Empty state ≠ error: HTTP ok, there is just nothing to show.',
    'btn.loadProjects': 'Load projects.json',
    'btn.loadQuotes': 'Load quotes.json',
    'btn.all': 'Promise.all (both)',
    'btn.allSettled': 'Promise.allSettled (3 loads)',
    'btn.simulateEmpty': 'Simulate empty response',
    'fetch.note':
      'fetch uses new URL(..., import.meta.url): the JSON path is resolved relative to this module.',
    'settled.waiting': 'Promise.allSettled — 3 loads (one will fail)…',
    'settled.ok': '✔ {rotulo}: fulfilled ({qtd} items)',
    'settled.rejected': '✘ {rotulo}: rejected ({motivo})',
    'reason.failed': 'failed',
    'settled.summary': 'allSettled: {sucessos}/3 fulfilled (no exception escaped)',
    'race.success': 'race: request won in {ms} ms',
    'race.error': 'race: timeout won in {ms} ms ({nome}) — request discarded',
    'race.btnSlow': 'Race: slow 1500ms × timeout 400ms',
    'race.btnFast': 'Race: fast 200ms × timeout 600ms',
    'race.note':
      'The losing side is aborted in the finally: it cancels the sleep and avoids ghost work.',
    'cancel.inProgress': '⏳ in progress (3000 ms)… click "Cancel"',
    'cancel.done': '✔ completed — the user did NOT cancel in time.',
    'cancel.cancelled': '✖ cancelled by the user ({erro})',
    'cancel.nothing': 'Nothing in flight to cancel.',
    'cancel.title': 'AbortController: cancel an in-flight request',
    'btn.start': 'Start simulation (3s)',
    'btn.cancel': 'Cancel',
    'cancel.note':
      'The same signal goes to fetch/sleep: a single .abort() ends the whole operation.',
    'retry.starting': 'retry — attempt 1 of up to 4…',
    'retry.fakeFailure': 'simulated failure on attempt {n}',
    'retry.attemptFailed': 'attempt {n} failed ({erro}) → new attempt',
    'retry.success': 'success on attempt {n}: {qtd} quotes',
    'retry.ok': 'retry ok after {n} attempts',
    'retry.exhausted': 'exhausted: {erro}',
    'retry.exhaustedAll': 'retry exhausted all attempts',
    'retry.title': 'attemptWithRetry: 2 failures then success',
    'btn.runRetry': 'Run retry',
    'retry.note':
      'Exponential backoff: 100 ms, 200 ms, 400 ms between attempts (instant here via injected sleep).',
  },
  'pt-BR': {
    'machine.title': 'Máquina de estados (fetch)',
    'state.initial': 'estado: ocioso',
    'state.line': 'estado: {estado} — {detalhe}',
    'state.history': '{estado}: {detalhe}',
    'state.ocioso': 'ocioso',
    'state.carregando': 'carregando',
    'state.sucesso': 'sucesso',
    'state.erro': 'erro',
    'state.vazio': 'vazio',
    'state.unknown': 'máquina de estados: estado desconhecido "{estado}".',
    'error.http': 'HTTP {status} ao buscar {arquivo}',
    'error.generic': 'erro',
    'detail.waiting': '{nome} — aguardando resposta…',
    'detail.noItems': '{nome} respondeu sem itens',
    'detail.loaded': '{nome}: {qtd} itens carregados',
    'items.none': 'Nenhum item para exibir (lista vazia).',
    'all.waiting': 'Promise.all — projects + quotes em paralelo…',
    'all.success': 'Promise.all ok — {total} itens no total',
    'empty.simulated': 'resposta simulada: 0 itens',
    'empty.note': 'Estado vazio ≠ erro: HTTP ok, só não há o que mostrar.',
    'btn.loadProjects': 'Carregar projects.json',
    'btn.loadQuotes': 'Carregar quotes.json',
    'btn.all': 'Promise.all (ambos)',
    'btn.allSettled': 'Promise.allSettled (3 cargas)',
    'btn.simulateEmpty': 'Simular resposta vazia',
    'fetch.note':
      'fetch usa new URL(..., import.meta.url): o caminho do JSON é resolvido relativo a este módulo.',
    'settled.waiting': 'Promise.allSettled — 3 cargas (uma vai falhar)…',
    'settled.ok': '✔ {rotulo}: fulfilled ({qtd} itens)',
    'settled.rejected': '✘ {rotulo}: rejected ({motivo})',
    'reason.failed': 'falhou',
    'settled.summary': 'allSettled: {sucessos}/3 fulfilled (nenhuma exceção escapou)',
    'race.success': 'race: requisição venceu em {ms} ms',
    'race.error': 'race: timeout venceu em {ms} ms ({nome}) — requisição descartada',
    'race.btnSlow': 'Race: lenta 1500ms × timeout 400ms',
    'race.btnFast': 'Race: rápida 200ms × timeout 600ms',
    'race.note':
      'O lado perdedor é abortado no finally: cancela o sleep e evita trabalho fantasma.',
    'cancel.inProgress': '⏳ em andamento (3000 ms)… clique em "Cancelar"',
    'cancel.done': '✔ concluído — o usuário NÃO cancelou a tempo.',
    'cancel.cancelled': '✖ cancelado pelo usuário ({erro})',
    'cancel.nothing': 'Nada em voo para cancelar.',
    'cancel.title': 'AbortController: cancelar requisição em voo',
    'btn.start': 'Iniciar simulação (3s)',
    'btn.cancel': 'Cancelar',
    'cancel.note':
      'O mesmo signal vai para fetch/sleep: um único .abort() encerra a operação inteira.',
    'retry.starting': 'retry — tentativa 1 de até 4…',
    'retry.fakeFailure': 'falha simulada na tentativa {n}',
    'retry.attemptFailed': 'tentativa {n} falhou ({erro}) → nova tentativa',
    'retry.success': 'sucesso na tentativa {n}: {qtd} citações',
    'retry.ok': 'retry ok após {n} tentativas',
    'retry.exhausted': 'esgotado: {erro}',
    'retry.exhaustedAll': 'retry esgotou as tentativas',
    'retry.title': 'attemptWithRetry: falha 2× e sucesso',
    'btn.runRetry': 'Executar retry',
    'retry.note':
      'Backoff exponencial: 100 ms, 200 ms, 400 ms entre tentativas (aqui instantâneos via sleep injetado).',
  },
};

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
  const atual = h('p', { class: 'nota', text: tr(STRINGS, 'state.initial') });
  const historico = h('ul', { class: 'nota' });
  const regiao = h(
    'div',
    { class: 'linha', role: 'status', 'aria-live': 'polite' },
    h('h3', { text: tr(STRINGS, 'machine.title') }),
    atual,
    historico,
  );

  function transicionar(estado, detalhe) {
    if (!ESTADOS.includes(estado)) {
      throw new RangeError(tr(STRINGS, 'state.unknown', { estado }));
    }
    const nome = tr(STRINGS, `state.${estado}`);
    atual.textContent = tr(STRINGS, 'state.line', { estado: nome, detalhe });
    // prepend + recorte mantém o histórico legível (máx. 5 entradas)
    historico.prepend(h('li', { text: tr(STRINGS, 'state.history', { estado: nome, detalhe }) }));
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
      const nomeArquivo = caminho.pathname.split('/').pop();
      throw new Error(tr(STRINGS, 'error.http', { status: resposta.status, arquivo: nomeArquivo }));
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
      destino.append(h('p', { class: 'nota', text: tr(STRINGS, 'items.none') }));
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
    maquina.transicionar('carregando', tr(STRINGS, 'detail.waiting', { nome }));
    try {
      const dados = await buscarJson(caminho, controller.signal);
      const itens = extrairItens(dados);
      if (itens.length === 0) {
        // estado vazio: resposta OK mas sem itens — ≠ de erro
        maquina.transicionar('vazio', tr(STRINGS, 'detail.noItems', { nome }));
      } else {
        maquina.transicionar('sucesso', tr(STRINGS, 'detail.loaded', { nome, qtd: itens.length }));
      }
      renderizarItens(destino, itens, formatoDe(nome));
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      maquina.transicionar('erro', `${nome}: ${mensagem}`);
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
    maquina.transicionar('carregando', tr(STRINGS, 'all.waiting'));
    try {
      const [projects, quotes] = await Promise.all([
        buscarJson(URL_PROJECTS, controller.signal),
        buscarJson(URL_QUOTES, controller.signal),
      ]);
      const total = extrairItens(projects).length + extrairItens(quotes).length;
      maquina.transicionar('sucesso', tr(STRINGS, 'all.success', { total }));
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
    maquina.transicionar('carregando', tr(STRINGS, 'settled.waiting'));
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
        saidaSettled.append(
          h('p', { text: tr(STRINGS, 'settled.ok', { rotulo: rotulos[i], qtd }) }),
        );
      } else {
        const bruto = resultado.reason;
        const motivo = bruto instanceof Error ? bruto.message : tr(STRINGS, 'reason.failed');
        saidaSettled.append(
          h('p', { text: tr(STRINGS, 'settled.rejected', { rotulo: rotulos[i], motivo }) }),
        );
      }
    });

    // 2 fulfilled + 1 rejected → sucesso parcial é esperado, não é erro
    maquina.transicionar(
      sucessos === 3 ? 'sucesso' : 'erro',
      tr(STRINGS, 'settled.summary', { sucessos }),
    );
  }

  /** Simula servidor respondendo JSON válido porém sem itens (estado "vazio"). */
  function simularVazio() {
    maquina.transicionar('vazio', tr(STRINGS, 'empty.simulated'));
    renderizarItens(saidaProjects, [], (p) => p.name);
    renderizarItens(saidaQuotes, [], (q) => q.text);
    saidaVazio.textContent = tr(STRINGS, 'empty.note');
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
        text: tr(STRINGS, 'btn.loadProjects'),
        on: { click: () => void carregarRecurso('projects.json', URL_PROJECTS, saidaProjects) },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.loadQuotes'),
        on: { click: () => void carregarRecurso('quotes.json', URL_QUOTES, saidaQuotes) },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.all'),
        on: { click: () => void carregarTudoComAll() },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.allSettled'),
        on: { click: () => void carregarComAllSettled() },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.simulateEmpty'),
        on: { click: simularVazio },
      }),
    ),
    saidaProjects,
    saidaQuotes,
    saidaSettled,
    saidaVazio,
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'fetch.note'),
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
      maquina.transicionar('sucesso', tr(STRINGS, 'race.success', { ms }));
    } catch (erro) {
      const ms = Math.round(performance.now() - t0);
      const nome = erro instanceof Error ? erro.name : tr(STRINGS, 'error.generic');
      maquina.transicionar('erro', tr(STRINGS, 'race.error', { ms, nome }));
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
        text: tr(STRINGS, 'race.btnSlow'),
        on: { click: () => void corridaComTimeout(1500, 400) },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'race.btnFast'),
        on: { click: () => void corridaComTimeout(200, 600) },
      }),
      saidaRace,
    ),
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'race.note'),
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
    saidaCancel.textContent = tr(STRINGS, 'cancel.inProgress');

    // sleep aceita signal: abort() rejeita a promise imediatamente com AbortError
    void sleep(3000, { signal: controller.signal }).then(
      () => {
        saidaCancel.textContent = tr(STRINGS, 'cancel.done');
        controllers.delete(controller);
        controllerSimulacao = null;
      },
      (erro) => {
        saidaCancel.textContent = tr(STRINGS, 'cancel.cancelled', {
          erro: erro?.name ?? 'AbortError',
        });
        controllers.delete(controller);
        controllerSimulacao = null;
      },
    );
  }

  function cancelarSimulacao() {
    if (!controllerSimulacao) {
      saidaCancel.textContent = tr(STRINGS, 'cancel.nothing');
      return;
    }
    controllerSimulacao.abort();
  }

  const painelCancel = h(
    'div',
    { class: 'linha' },
    h('h3', { text: tr(STRINGS, 'cancel.title') }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.start'),
        on: { click: iniciarSimulacao },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.cancel'),
        on: { click: cancelarSimulacao },
      }),
      saidaCancel,
    ),
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'cancel.note'),
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
    maquina.transicionar('carregando', tr(STRINGS, 'retry.starting'));
    let tentativas = 0;

    try {
      const dados = await attemptWithRetry(
        async () => {
          tentativas += 1;
          if (tentativas <= 2) {
            // falha simulada 2× — na 3ª o fetch de verdade acontece
            throw new Error(tr(STRINGS, 'retry.fakeFailure', { n: tentativas }));
          }
          return buscarJson(URL_QUOTES);
        },
        {
          retries: 3,
          baseDelay: 100,
          factor: 2,
          sleep: () => Promise.resolve(), // backoff instantâneo p/ demo snappy
          onRetry: (n, erro) =>
            registrarRetry(tr(STRINGS, 'retry.attemptFailed', { n, erro: erro.message })),
        },
      );
      const qtd = extrairItens(dados).length;
      registrarRetry(tr(STRINGS, 'retry.success', { n: tentativas, qtd }));
      maquina.transicionar('sucesso', tr(STRINGS, 'retry.ok', { n: tentativas }));
      renderizarItens(saidaQuotes, extrairItens(dados), (q) => `“${q.text}” — ${q.author}`);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      registrarRetry(tr(STRINGS, 'retry.exhausted', { erro: mensagem }));
      maquina.transicionar('erro', tr(STRINGS, 'retry.exhaustedAll'));
    }
  }

  const painelRetry = h(
    'div',
    { class: 'linha' },
    h('h3', { text: tr(STRINGS, 'retry.title') }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.runRetry'),
        on: { click: () => void executarRetry() },
      }),
    ),
    logRetry,
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'retry.note'),
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
