// @ts-check
/**
 * ARQUIVO: main.js
 * PROPÓSITO: ponto de entrada — inicializa app, tema, menu, scroll spy e,
 *   sobretudo, o carregamento LAZY das demos via import() dinâmico com ciclo
 *   de vida init → cleanup.
 * CONCEITOS DEMONSTRADOS: dynamic import(), import.meta.url, IntersectionObserver,
 *   closures (cleanup), padrão init/cleanup, feature detection, Error.cause.
 * USADO EM: index.html (<script type="module" src="src/main.js">)
 * COMPLEXIDADE/OBSERVAÇÕES: cada demo é um módulo separado que só é baixado
 *   quando sua seção se aproxima da viewport — reduz o JS inicial. O cleanup
 *   registrado ao sair impede vazamento de listeners/timers/observadores.
 */
import './components/code-peek.js';
import './components/demo-card.js';
import './components/toast-notification.js';
import './components/theme-toggle.js';
import './components/accessible-tabs.js';
import { $, $$, on } from './core/dom.js';
import { createRouter } from './core/router.js';
import { logger } from './core/logger.js';
import { aplicarTraducoes, getLang, onLangChange, SHELL, toggleLang, tr } from './core/i18n.js';

/** Erro customizado: marca falhas de carregamento de demo com causa original. */
export class DemoLoadError extends Error {
  /**
   * @param {string} nome identificador da demo (ex.: '05-state-store')
   * @param {{ cause: Error }} opcoes erro original preservado em `cause`
   */
  constructor(nome, opcoes) {
    super(`Falha ao carregar a demo "${nome}".`, opcoes);
    this.name = 'DemoLoadError';
  }
}

/**
 * @typedef {object} DemoState
 * @property {() => void} cleanup função de limpeza fornecida pela demo
 * @property {boolean} emAndamento se o init está em curso (evita dupla carga)
 * @property {HTMLElement} container onde a demo foi montada (para re-init no idioma)
 */

/** Registry de demos ativas: nome → estado (Map, não objeto global). */
const demosAtivas = new Map();

/** Módulos já importados alguma vez (contador do hero não duplica no re-init). */
const jaImportados = new Set();

/** Total de módulos de demo já importados (contador do hero). */
let modulosCarregados = 1; // main.js conta como o primeiro

/**
 * Carrega e inicializa uma demo sob demanda (lazy).
 * Idempotente: segunda chamada enquanto carrega ou depois de pronta é no-op.
 *
 * @param {string} nome chave em data-demo (ex.: '01-closures-hof')
 * @param {HTMLElement} container elemento onde a demo monta sua UI
 * @returns {Promise<(() => void)|null> cleanup da demo, ou null se já ativa/falhou graciosamente}
 * @throws {DemoLoadError} quando o import ou o init falha (cause preserva o original)
 * @example
 * await carregarDemo('02-async-fetch', document.querySelector('#area-demo02'));
 */
export async function carregarDemo(nome, container) {
  const estado = demosAtivas.get(nome);
  if (estado?.cleanup || estado?.emAndamento) return null;

  demosAtivas.set(nome, { cleanup: () => {}, emAndamento: true, container });

  try {
    // import() dinâmico: o bundler não existe, o navegador baixa só quando pede
    const modulo = await import(`./demos/${nome}.js`);
    if (typeof modulo.init !== 'function') {
      throw new DemoLoadError(nome, {
        cause: new Error('o módulo não exporta init(container)'),
      });
    }
    const cleanup = modulo.init(container);
    if (typeof cleanup !== 'function') {
      throw new DemoLoadError(nome, {
        cause: new Error('init() não retornou função de cleanup'),
      });
    }
    demosAtivas.set(nome, { cleanup, emAndamento: false, container });
    if (!jaImportados.has(nome)) {
      jaImportados.add(nome);
      modulosCarregados += 1;
      atualizarContador();
    }
    logger.debug(`demo "${nome}" carregada (total: ${modulosCarregados})`);
    return cleanup;
  } catch (erro) {
    demosAtivas.delete(nome);
    const erroEnvolvido =
      erro instanceof DemoLoadError ? erro : new DemoLoadError(nome, { cause: erro });
    logger.error(erroEnvolvido.message, erroEnvolvido.cause);
    mostrarFalhaNoContainer(container, nome, erroEnvolvido);
    return null;
  }
}

/**
 * Encerra a demo, chamando seu cleanup e removendo do registry.
 *
 * @param {string} nome chave da demo
 * @example
 * finalizarDemo('03-event-loop'); // ao sair da viewport
 */
export function finalizarDemo(nome) {
  const estado = demosAtivas.get(nome);
  if (!estado || !estado.cleanup) return;
  try {
    estado.cleanup();
  } catch (erro) {
    logger.warn(`cleanup da demo "${nome}" lançou erro:`, erro);
  }
  demosAtivas.delete(nome);
  logger.debug(`demo "${nome}" finalizada`);
}

/**
 * Mostra mensagem amigável quando a demo não carrega (file://, offline…).
 *
 * @param {HTMLElement} container alvo
 * @param {Error} erro erro envolvido
 */
function mostrarFalhaNoContainer(container, nome, erro) {
  const aviso = document.createElement('div');
  aviso.className = 'nota erro';
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-live', 'polite');
  aviso.textContent = tr(SHELL, 'error.demo', {
    name: nome,
    reason: String(erro.cause?.message ?? erro.message),
  });
  container.replaceChildren(aviso);
}

/** Atualiza o contador "módulos carregados" do hero. */
function atualizarContador() {
  const saida = $('#contador-modulos');
  if (saida) saida.textContent = String(modulosCarregados);
}

/**
 * Configura o lazy loading: cada seção [data-demo] carrega ao entrar na
 * viewport (rootMargin 300px) e é finalizada ao sair por completo.
 *
 * @returns {() => void} cleanup que desconecta o observer
 * @example
 * const desconectar = configurarLazyLoading();
 */
export function configurarLazyLoading() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: carrega tudo de uma vez (sem observers)
    for (const secao of $$('[data-demo]')) {
      const area = secao.querySelector('.area-demo');
      const nome = secao.getAttribute('data-demo');
      if (area && nome) void carregarDemo(nome, area);
    }
    return () => {};
  }

  const carregador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        const nome = entrada.target.getAttribute('data-demo');
        const area = entrada.target.querySelector('.area-demo');
        if (!nome || !area) continue;
        if (entrada.isIntersecting) {
          // Cada seção é uma "rota" visível: init sob demanda
          void carregarDemo(nome, area);
        } else if (entrada.intersectionRatio === 0) {
          // Saiu totalmente da tela: cleanup evita vazamento
          finalizarDemo(nome);
        }
      }
    },
    { rootMargin: '300px 0px', threshold: [0, 1] },
  );

  for (const secao of $$('[data-demo]')) carregador.observe(secao);

  return () => carregador.disconnect();
}

/**
 * Menu mobile: alterna visibilidade da lista com aria-expanded correto.
 *
 * @returns {() => void} cleanup do listener
 */
function configurarMenu() {
  const botao = $('.botao-menu');
  const menu = $('#menu-principal');
  if (!(botao instanceof HTMLButtonElement) || !menu) return () => {};

  const alternar = () => {
    const aberto = botao.getAttribute('aria-expanded') === 'true';
    botao.setAttribute('aria-expanded', String(!aberto));
    // Rótulo no idioma ativo (aberto → oferece fechar, e vice-versa)
    botao.setAttribute('aria-label', tr(SHELL, aberto ? 'menu.open' : 'menu.close'));
    menu.classList.toggle('aberto', !aberto);
  };

  const removerClick = on(botao, 'click', alternar);
  // Fecha o menu ao navegar por um link (SPA-friendly)
  const removerNav = on(menu, 'click', (evento) => {
    if (evento.target instanceof HTMLAnchorElement && menu.classList.contains('aberto')) {
      alternar();
    }
  });

  return () => {
    removerClick();
    removerNav();
  };
}

/**
 * Scroll spy: destaca o link do menu correspondente à seção visível.
 * Usa IntersectionObserver (não polui o scroll com handlers).
 *
 * @returns {() => void} cleanup do observer
 */
function configurarScrollSpy() {
  const links = $$('.menu a[href^="#"]');
  if (links.length === 0 || !('IntersectionObserver' in window)) return () => {};

  const visiveis = new Map();
  const spy = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        visiveis.set(entrada.target.id, entrada.isIntersecting);
      }
      // Escolhe a primeira seção visível na ordem do menu
      for (const link of links) {
        const id = link.getAttribute('href')?.slice(1);
        if (id && visiveis.get(id)) {
          for (const l of links) l.removeAttribute('aria-current');
          link.setAttribute('aria-current', 'true');
          break;
        }
      }
    },
    { rootMargin: '-40% 0px -50% 0px' },
  );

  for (const link of links) {
    const id = link.getAttribute('href')?.slice(1);
    const secao = id ? document.getElementById(id) : null;
    if (secao) spy.observe(secao);
  }

  return () => spy.disconnect();
}

/**
 * Inicializa o roteador por hash (deep links #demo05 etc.).
 *
 * @returns {() => void} cleanup do roteador
 */
function configurarRouter() {
  const router = createRouter({
    onRota: (rota) => {
      if (rota === '/') return;
      const alvo = document.getElementById(rota.replace(/^\//, ''));
      if (alvo) {
        alvo.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
        logger.debug(`rota → ${rota}`);
      }
    },
  });
  router.iniciar();
  return () => router.destroy();
}

/**
 * Detecta a preferência por menos movimento.
 *
 * @returns {boolean} true se o usuário pediu menos animação
 * @example
 * if (reducedMotion()) usarTransicaoInstantanea();
 */
export function reducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Configura o botão de idioma do topo (en-US ↔ pt-BR) e a re-inicialização
 * das demos ativas quando o idioma muda (as demos renderizam no init).
 *
 * @returns {() => void} cleanup dos listeners
 */
function configurarIdioma() {
  const botao = $('#btn-idioma');
  const remocoes = [];

  if (botao) {
    remocoes.push(on(botao, 'click', () => toggleLang()));
  }

  // Troca de idioma: shell já é aplicado por setLang; demos re-init para
  // renderizarem suas strings no novo idioma.
  remocoes.push(
    onLangChange(() => {
      logger.debug(`idioma → ${getLang()}`);
      for (const [nome, estado] of [...demosAtivas]) {
        if (!estado.cleanup || !estado.container) continue;
        try {
          estado.cleanup();
        } catch (erro) {
          logger.warn(`cleanup da demo "${nome}" na troca de idioma:`, erro);
        }
        demosAtivas.delete(nome);
        if (estado.container.isConnected) {
          void carregarDemo(nome, estado.container);
        }
      }
    }),
  );

  return () => remocoes.forEach((fn) => fn());
}

/**
 * Inicialização da aplicação. Executa quando o DOM está pronto.
 *
 * @returns {() => void} cleanup geral (usado nos testes/e2e)
 * @example
 * const cleanup = bootstrap();
 */
export function bootstrap() {
  logger.info('Perfect JavaScript Example starting');

  // i18n: aplica o idioma salvo (default en-US) ao shell estático
  aplicarTraducoes();

  const cleanups = [
    configurarLazyLoading(),
    configurarMenu(),
    configurarScrollSpy(),
    configurarRouter(),
    configurarIdioma(),
  ];

  // Log de desempenho da carga inicial (performance API)
  performance.mark('app:pronto');
  try {
    performance.measure('app:carga-inicial', 'navigationStart', 'app:pronto');
    const medida = performance.getEntriesByName('app:carga-inicial').at(-1);
    logger.debug(`carga inicial: ${medida?.duration?.toFixed(1)} ms`);
  } catch (erro) {
    // navigationStart pode não existir em navegadores antigos — não é crítico
    logger.debug('medição de carga inicial indisponível:', erro);
  }

  return () => cleanups.forEach((fn) => fn());
}

// Só executa no navegador (não quebra se importado em teste Node)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootstrap(), { once: true });
  } else {
    bootstrap();
  }
}
