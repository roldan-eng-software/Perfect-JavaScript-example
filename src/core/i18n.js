// @ts-check
/**
 * ARQUIVO: i18n.js
 * PROPÓSITO: internacionalização da landing — idioma padrão en-US, alternância
 *   para pt-BR com persistência, dicionário do shell da página e helper `tr()`
 *   para as demos registrarem suas próprias strings.
 * CONCEITOS DEMONSTRADOS: dicionários por locale, pub/sub de mudança de idioma,
 *   textContent/innerHTML autoral (nunca dados de usuário), update do atributo
 *   lang do <html>, persistência via storage.js.
 * USADO EM: main.js (boot + botão de idioma), components (rótulos), demos (tr).
 * COMPLEXIDADE/OBSERVAÇÕES: o idioma default é en-US; pt-BR é opt-in pelo
 *   botão no topo. As demos são re-inicializadas pelo main.js a cada troca,
 *   então elas só precisam ler o idioma via tr() no init — sem subscription.
 */

import { createStorage } from './storage.js';

const storage = createStorage('local', 'i18n:');

/** Idiomas suportados pela landing. */
export const IDIOMAS = /** @type {const} */ (['en-US', 'pt-BR']);

/**
 * Dicionário do shell da página (títulos, navegação, textos estáticos).
 * Chaves com sufixo `(html)` aceitam marcacao autoral minima: <code>, <strong>,
 * <em>, <a> — nunca dados de usuario.
 */
export const SHELL = {
  'en-US': {
    'doc.title': 'Perfect JavaScript Example — Interactive technical portfolio',
    skip: 'Skip to content',
    'nav.aria': 'Main navigation',
    'menu.open': 'Open menu',
    'menu.close': 'Close menu',
    'nav.d01': '01 · Closures',
    'nav.d02': '02 · Async',
    'nav.d03': '03 · Event loop',
    'nav.d04': '04 · Observers',
    'nav.d05': '05 · State',
    'nav.d06': '06 · Classes',
    'nav.d07': '07 · Generators',
    'nav.d08': '08 · Worker',
    'nav.d09': '09 · Forms',
    'nav.d10': '10 · Drag & Drop',
    'nav.d11': '11 · i18n',
    'nav.d12': '12 · Performance',
    'nav.d13': '13 · APIs',
    'nav.tests': 'Tests',
    'nav.how': 'How it was built',
    'hero.lead':
      'Technical portfolio <strong>with no frameworks, no libraries, no build step</strong>: just modern JavaScript (ES2023+), semantic HTML and lean CSS. Every section below is a <em>real</em> demo — and shows the source code that implements it.',
    'hero.badge1': 'Zero runtime dependencies',
    'hero.badge2': 'Native ES Modules',
    'hero.badge3': 'Tests with <code>node:test</code>',
    'hero.counter': 'Modules loaded:',
    'hero.cta': 'See the demos ↓',
    'demo01.title': 'Closures and higher-order functions',
    'demo01.intro':
      'A closure is a function that keeps access to the scope where it was created, even after that scope leaves the stack — here a counter lives inside <code>criarContador()</code> with no global variable. I used closures because they encapsulate state without classes; compose/pipe/curry compose pure logic; memoize caches results and the comparison uses <code>performance.now()</code>.',
    'demo02.title': 'Asynchronous: async/await, fetch and cancellation',
    'demo02.intro':
      '<code>async/await</code> makes asynchronous code sequential and readable; <code>Promise.all</code> parallelizes, <code>allSettled</code> tolerates partial failures and <code>race</code> + timeout implement a deadline. I used <code>AbortController</code> because cancelling requests is mandatory in real UIs, and <code>retry</code> with backoff because networks fail — loading/error/empty/success states always show up.',
    'demo03.title': 'Event loop: microtasks, macrotasks and rAF',
    'demo03.intro':
      'Order in JS is not textual order: synchronous code runs first, then the microtask queue (<code>Promise.then</code>, <code>queueMicrotask</code>) drains completely, and only then come macrotasks (<code>setTimeout</code>) and <code>requestAnimationFrame</code>. I demonstrate this by running the sequence and numbering each step — handy for understanding concurrency bugs.',
    'demo04.title': 'Observers and efficient DOM',
    'demo04.intro':
      'Observers react to changes without listener pollution: IntersectionObserver does reveal/scroll-spy, ResizeObserver measures layout, MutationObserver watches mutations. I combined them with event delegation, <code>&lt;template&gt;</code> and <code>DocumentFragment</code> to render large lists in a single reflow — instead of N.',
    'demo05.title': 'State, pub/sub and reactivity',
    'demo05.intro':
      'A mini store with pub/sub keeps UI and data in sync. I used immutability (spread + <code>structuredClone</code>) for traceable changes, selectors for targeted reads, <code>Proxy</code> for reactivity and <code>localStorage</code> for persistence — with try/catch, because storage can be blocked.',
    'demo06.title': 'Classes and modern OOP',
    'demo06.intro':
      'Private fields <code>#</code> give real encapsulation (not a convention, syntax); getters/setters validate; <code>static</code> blocks configure the class at load time; inheritance and mixins cover reuse, and <code>WeakMap</code>/<code>Symbol</code> are the "old-school" alternatives compared side by side with a factory function.',
    'demo07.title': 'Generators and iterators',
    'demo07.intro':
      '<code>function*</code> produces values on demand — perfect for infinite sequences and pagination; <code>Symbol.iterator</code> makes any object iterable by <code>for…of</code>; async generators + <code>for await...of</code> consume paginated APIs elegantly. I included Map/Set/WeakSet and iterator-helper detection with a fallback.',
    'demo08.title': 'Web Worker: parallelism without freezing the UI',
    'demo08.intro':
      'Heavy code on the main thread freezes scrolling, clicks and animations. A <code>Worker</code> runs the calculation on another thread with <code>postMessage</code>, a progress bar and cancellation via <code>worker.terminate()</code>. The demo compares frames rendered with and without the worker — the difference is visible.',
    'demo09.title': 'Forms and accessible validation',
    'demo09.intro':
      'The Constraint Validation API (<code>setCustomValidity</code>, <code>checkValidity</code>, <code>reportValidity</code>) gives native validation with custom messages; hand-made CPF/CEP/phone masks, real-time validation with <code>debounce</code>, messages wired via <code>aria-describedby</code>/<code>aria-live</code>, and <code>FormData</code> + <code>Object.fromEntries</code> for clean collection.',
    'demo10.title': 'Accessible drag & drop',
    'demo10.intro':
      'The Kanban uses the HTML5 Drag and Drop API <em>and</em> a complete keyboard alternative (arrow keys move cards between columns) — dragging with the mouse cannot be the only path. The order is persisted in <code>localStorage</code>, and every move is announced in <code>aria-live</code>.',
    'demo11.title': 'Internationalization with Intl',
    'demo11.intro':
      'The native <code>Intl</code> API covers currency, dates, relative time, lists, plurals and collation — zero libraries. Switching between pt-BR/en-US/es updates the DOM instantly, without reloading, using JSON dictionaries and <code>textContent</code>.',
    'demo12.title': 'Performance: debounce, throttle, rAF and virtualization',
    'demo12.intro':
      'Real-time counters show the difference between debounce and throttle; <code>requestAnimationFrame</code> syncs with the frame; virtualization renders only the visible window of 10,000 items (~20 DOM nodes, not 10,000); <code>performance.mark/measure</code> measures with millisecond precision.',
    'demo13.title': 'Browser APIs',
    'demo13.intro':
      "Clipboard, Web Share, Geolocation, matchMedia, Page Visibility, Notification, URLSearchParams, History API, BroadcastChannel (across tabs!) and <code>&lt;dialog&gt;</code> — all with feature detection (<code>'x' in window</code>) and a friendly fallback. No permission is requested automatically: geolocation and notifications are opt-in.",
    'tests.title': 'Tests',
    'tests.p':
      "The utilities have unit tests with Node's native runner (<code>node:test</code> + <code>node:assert</code>) — no Jest, no Vitest. Run with <code>npm test</code>.",
    'tests.d1': '— timers with <code>mock.timers</code>',
    'tests.d2': '— leading/trailing/cancel',
    'tests.d3': '— cache, resolver, clear',
    'tests.d4': '— compose/pipe/curry and errors',
    'tests.d5': '— exponential backoff, cause, abort',
    'tests.d6': '— subscribe/unsubscribe/immutability',
    'tests.d7': '— CPF/CEP/e-mail/password',
    'tests.d8': '— Intl number/date/list/plural/collate',
    'tests.d9': '— pure tokenizer for <code>&lt;code-peek&gt;</code>',
    'tests.peek': 'package.json (test script)',
    'how.title': 'How it was built',
    'how.p':
      'Every module has a standard header (ARQUIVO / PROPÓSITO / CONCEITOS / USADO EM) and complete JSDoc on its exports. Start with the pure utilities — they are the testable foundation of everything.',
    'how.d1': '— <code>$</code>, <code>h()</code>, delegation helpers',
    'how.d2': '— immutable pub/sub mini store',
    'how.d3': '— EventTarget as a message bus',
    'how.d4': '— hash router + History API',
    'how.d5': '— safe localStorage with fallback',
    'how.d6': '— leveled logger toggled by flag',
    'how.d7': '— delay on inactivity',
    'how.d8': '— rate limit per interval',
    'how.d9': '— cache by arguments',
    'how.d10': '— compose/pipe/curry',
    'how.d11': '— retry with exponential backoff',
    'how.d12': '— cancellable sleep',
    'how.d13': '— deep clone with fallback',
    'how.d14': '— Intl formatting',
    'how.d15': '— pure validators',
    'how.d16': '— syntax tokenizer',
    'how.d17': '— renders the real source code',
    'how.d18': '— section card',
    'how.d19': '— notifications',
    'how.d20': '— light/dark/system theme',
    'how.d21': '— accessible ARIA tabs',
    'how.d22': '— diagram and demo lifecycle',
    'how.d23': '— techniques table',
    'how.d24': '— language dictionaries (en-US/pt-BR)',
    'foot.license': 'MIT License',
    'foot.note':
      'Built with pure JavaScript — <a href="https://github.com/roldan-eng-software/Perfect-JavaScript-example" target="_blank" rel="noopener noreferrer">source on GitHub</a>.',
    'code.view': 'view source',
    'lang.aria': 'Switch language to Portuguese',
    'lang.button': 'Português',
    'theme.aria': 'Theme',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
    'peek.loading': 'Loading code…',
    'peek.copy': 'Copy code',
    'peek.copied': 'Copied!',
    'peek.copyFail': 'Copy failed',
    'peek.error':
      'Could not load "{src}". If you opened the page via file://, run "npm run serve" or use GitHub Pages (the browser blocks fetching local files).',
    'error.demo':
      'Could not load this demo ({name}: {reason}). If you opened the page via file://, run "npm run serve" — modules and fetch do not work over file://.',
  },
  'pt-BR': {
    'doc.title': 'Perfect JavaScript Example — Portfólio técnico interativo',
    skip: 'Pular para o conteúdo',
    'nav.aria': 'Navegação principal',
    'menu.open': 'Abrir menu',
    'menu.close': 'Fechar menu',
    'nav.d01': '01 · Closures',
    'nav.d02': '02 · Assíncrono',
    'nav.d03': '03 · Event loop',
    'nav.d04': '04 · Observers',
    'nav.d05': '05 · Estado',
    'nav.d06': '06 · Classes',
    'nav.d07': '07 · Geradores',
    'nav.d08': '08 · Worker',
    'nav.d09': '09 · Formulários',
    'nav.d10': '10 · Drag & Drop',
    'nav.d11': '11 · i18n',
    'nav.d12': '12 · Performance',
    'nav.d13': '13 · APIs',
    'nav.tests': 'Testes',
    'nav.how': 'Como foi feito',
    'hero.lead':
      'Portfólio técnico <strong>sem frameworks, sem bibliotecas, sem build</strong>: apenas JavaScript moderno (ES2023+), HTML semântico e CSS enxuto. Cada seção abaixo é uma demonstração <em>real</em> — e mostra o código-fonte que a implementa.',
    'hero.badge1': 'Zero dependências de runtime',
    'hero.badge2': 'ES Modules nativos',
    'hero.badge3': 'Testes com <code>node:test</code>',
    'hero.counter': 'Módulos carregados:',
    'hero.cta': 'Ver demonstrações ↓',
    'demo01.title': 'Closures e funções de ordem superior',
    'demo01.intro':
      'Closure é uma função que mantém acesso ao escopo onde foi criada, mesmo depois de esse escopo sair da pilha — aqui um contador vive dentro de <code>criarContador()</code> sem variável global. Usei closures porque encapsulam estado sem classes; compose/pipe/curry compõem lógica pura; memoize cacheia resultados e a comparação usa <code>performance.now()</code>.',
    'demo02.title': 'Assíncrono: async/await, fetch e cancelamento',
    'demo02.intro':
      '<code>async/await</code> torna o código assíncrono sequencial e legível; <code>Promise.all</code> paraleliza, <code>allSettled</code> tolera falhas parciais e <code>race</code> + timeout implementam deadline. Usei <code>AbortController</code> porque cancelar requisição é obrigatório em UI real, e <code>retry</code> com backoff porque rede falha — os estados loading/erro/vazio/sucesso sempre aparecem.',
    'demo03.title': 'Event loop: microtasks, macrotasks e rAF',
    'demo03.intro':
      'A ordem no JS não é a ordem do texto: código síncrono roda primeiro, depois a fila de microtasks (<code>Promise.then</code>, <code>queueMicrotask</code>) esvazia por completo, e só então vêm macrotasks (<code>setTimeout</code>) e <code>requestAnimationFrame</code>. Demonstro isso executando a sequência e numerando cada passo — útil para entender bugs de concorrência.',
    'demo04.title': 'Observers e DOM eficiente',
    'demo04.intro':
      'Observers reagem a mudanças sem poluição de listeners: IntersectionObserver faz reveal/scroll-spy, ResizeObserver mede layout, MutationObserver observa alterações. Combinei com delegação de eventos, <code>&lt;template&gt;</code> e <code>DocumentFragment</code> para renderizar listas grandes com um único reflow — em vez de N.',
    'demo05.title': 'Estado, pub/sub e reatividade',
    'demo05.intro':
      'Uma mini store com pub/sub mantém UI e dados dessincronizados. Usei imutabilidade (spread + <code>structuredClone</code>) para mudanças rastreáveis, selectors para leituras pontuais, <code>Proxy</code> para reatividade reativa e <code>localStorage</code> para persistir — com try/catch, porque storage pode estar bloqueado.',
    'demo06.title': 'Classes e POO moderno',
    'demo06.intro':
      'Campos privados <code>#</code> dão encapsulamento real (não é convenção, é sintaxe); getters/setters validam; <code>static</code> blocks configuram a classe no carregamento; herança e mixins cobrem reuso, e <code>WeakMap</code>/<code>Symbol</code> são alternativas "à moda antiga" comparadas lado a lado com fábrica de funções.',
    'demo07.title': 'Geradores e iteradores',
    'demo07.intro':
      '<code>function*</code> produz valores sob demanda — perfeitos para sequências infinitas e paginação; <code>Symbol.iterator</code> torna qualquer objeto iterável por <code>for…of</code>; async generators + <code>for await...of</code> consomem APIs paginadas com elegância. Incluí Map/Set/WeakSet e detecção de iterator helpers com fallback.',
    'demo08.title': 'Web Worker: paralelismo sem travar a UI',
    'demo08.intro':
      'Código pesado na main thread congela rolagem, cliques e animações. Um <code>Worker</code> roda o cálculo em outra thread com <code>postMessage</code>, barra de progresso e cancelamento por <code>worker.terminate()</code>. A demo compara os frames renderizados com e sem o worker — a diferença é visível.',
    'demo09.title': 'Formulários e validação acessível',
    'demo09.intro':
      'Constraint Validation API (<code>setCustomValidity</code>, <code>checkValidity</code>, <code>reportValidity</code>) dá validação nativa com mensagens próprias; máscaras de CPF/CEP/telefone feitas à mão, validação em tempo real com <code>debounce</code>, mensagens ligadas por <code>aria-describedby</code>/<code>aria-live</code>, e <code>FormData</code> + <code>Object.fromEntries</code> para coleta limpa.',
    'demo10.title': 'Drag & drop acessível',
    'demo10.intro':
      'O Kanban usa a HTML5 Drag and Drop API <em>e</em> uma alternativa completa por teclado (setas movem cartões entre colunas) — arrastar com mouse não pode ser a única via. A ordem é persistida em <code>localStorage</code>, e cada movimento é anunciado em <code>aria-live</code>.',
    'demo11.title': 'Internacionalização com Intl',
    'demo11.intro':
      'A API <code>Intl</code> nativa cobre moeda, data, tempo relativo, listas, plurais e ordenação — zero bibliotecas. Trocar entre pt-BR/en-US/es atualiza o DOM na hora, sem recarregar, usando dicionários JSON e <code>textContent</code>.',
    'demo12.title': 'Performance: debounce, throttle, rAF e virtualização',
    'demo12.intro':
      'Contadores em tempo real mostram a diferença entre debounce e throttle; <code>requestAnimationFrame</code> sincroniza com o frame; virtualização renderiza só a janela visível de 10.000 itens (~20 nós no DOM, não 10.000); <code>performance.mark/measure</code> mede com precisão de milissegundos.',
    'demo13.title': 'APIs do navegador',
    'demo13.intro':
      "Clipboard, Web Share, Geolocation, matchMedia, Page Visibility, Notification, URLSearchParams, History API, BroadcastChannel (entre abas!) e <code>&lt;dialog&gt;</code> — todas com feature detection (<code>'x' in window</code>) e fallback amigável. Nenhuma permissão é pedida automaticamente: geolocation e notificação são opt-in.",
    'tests.title': 'Testes',
    'tests.p':
      'Os utilitários têm testes unitários com o runner nativo do Node (<code>node:test</code> + <code>node:assert</code>) — sem Jest, sem Vitest. Rode com <code>npm test</code>.',
    'tests.d1': '— timers com <code>mock.timers</code>',
    'tests.d2': '— leading/trailing/cancel',
    'tests.d3': '— cache, resolver, clear',
    'tests.d4': '— compose/pipe/curry e erros',
    'tests.d5': '— backoff exponencial, cause, abort',
    'tests.d6': '— subscribe/unsubscribe/imutabilidade',
    'tests.d7': '— CPF/CEP/e-mail/senha',
    'tests.d8': '— Intl number/date/list/plural/collate',
    'tests.d9': '— tokenizador puro do <code>&lt;code-peek&gt;</code>',
    'tests.peek': 'package.json (script de testes)',
    'how.title': 'Como foi feito',
    'how.p':
      'Cada módulo tem cabeçalho padronizado (ARQUIVO / PROPÓSITO / CONCEITOS / USADO EM) e JSDoc completo nas exportações. Comece pelos utilitários puros — são a base testável de tudo.',
    'how.d1': '— helpers <code>$</code>, <code>h()</code>, delegação',
    'how.d2': '— mini store pub/sub imutável',
    'how.d3': '— EventTarget como barramento',
    'how.d4': '— roteador por hash + History API',
    'how.d5': '— localStorage seguro com fallback',
    'how.d6': '— logger com níveis por flag',
    'how.d7': '— atraso por inatividade',
    'how.d8': '— limite por intervalo',
    'how.d9': '— cache por argumentos',
    'how.d10': '— compose/pipe/curry',
    'how.d11': '— retry com backoff exponencial',
    'how.d12': '— pausa cancelável',
    'how.d13': '— clone profundo com fallback',
    'how.d14': '— formatação Intl',
    'how.d15': '— validações puras',
    'how.d16': '— tokenizador de sintaxe',
    'how.d17': '— exibe o código real',
    'how.d18': '— cartão de seção',
    'how.d19': '— avisos',
    'how.d20': '— tema claro/escuro/sistema',
    'how.d21': '— abas ARIA',
    'how.d22': '— diagrama e ciclo de vida',
    'how.d23': '— tabela de técnicas',
    'how.d24': '— dicionários de idioma (en-US/pt-BR)',
    'foot.license': 'Licença MIT',
    'foot.note':
      'Feito com JavaScript puro — <a href="https://github.com/roldan-eng-software/Perfect-JavaScript-example" target="_blank" rel="noopener noreferrer">código no GitHub</a>.',
    'code.view': 'ver código',
    'lang.aria': 'Mudar idioma para inglês',
    'lang.button': 'English',
    'theme.aria': 'Tema',
    'theme.light': 'Claro',
    'theme.dark': 'Escuro',
    'theme.system': 'Sistema',
    'peek.loading': 'Carregando código…',
    'peek.copy': 'Copiar código',
    'peek.copied': 'Copiado!',
    'peek.copyFail': 'Falha ao copiar',
    'peek.error':
      'Não foi possível carregar "{src}". Se abriu a página via file://, rode "npm run serve" ou acesse pelo GitHub Pages (o navegador bloqueia fetch de arquivo local).',
    'error.demo':
      'Não foi possível carregar esta demo ({name}: {reason}). Se abriu a página via file://, rode "npm run serve" — módulos e fetch não funcionam por file://.',
  },
};

/** Idioma atual (lido do storage; default en-US). */
let idiomaAtual = IDIOMAS.includes(/** @type {any} */ (storage.get('lang')))
  ? /** @type {'en-US'|'pt-BR'} */ (storage.get('lang'))
  : 'en-US';

/** @type {Set<(lang: 'en-US'|'pt-BR') => void>} assinantes da troca de idioma */
const ouvintes = new Set();

/**
 * Retorna o idioma ativo.
 *
 * @returns {'en-US'|'pt-BR'} idioma atual (padrão 'en-US')
 * @example
 * getLang() === 'pt-BR' ? 'olá' : 'hello';
 */
export function getLang() {
  return idiomaAtual;
}

/**
 * Define o idioma, persiste, atualiza `<html lang>`, aplica o shell e notifica.
 *
 * @param {'en-US'|'pt-BR'} novo idioma a ativar
 * @throws {TypeError} se o idioma não for suportado
 * @example
 * setLang('pt-BR'); // botão no topo da landing
 */
export function setLang(novo) {
  if (!IDIOMAS.includes(novo)) {
    throw new TypeError(`setLang: idioma não suportado "${novo}".`);
  }
  if (novo === idiomaAtual) return;
  idiomaAtual = novo;
  storage.set('lang', novo);
  aplicarTraducoes();
  for (const cb of [...ouvintes]) {
    try {
      cb(novo);
    } catch (erro) {
      console.error('[i18n] erro em assinante de idioma:', erro);
    }
  }
}

/**
 * Alterna en-US ↔ pt-BR (atalho do botão do topo).
 *
 * @example
 * toggleLang(); // en-US → pt-BR
 */
export function toggleLang() {
  setLang(idiomaAtual === 'en-US' ? 'pt-BR' : 'en-US');
}

/**
 * Assina mudanças de idioma.
 *
 * @param {(lang: 'en-US'|'pt-BR') => void} cb callback notificado após a troca
 * @returns {() => void} função que cancela a assinatura
 * @example
 * const fora = onLangChange(() => re-render());
 */
export function onLangChange(cb) {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

/**
 * Traduz uma chave num dicionário local (padrão das demos).
 * Fallback: idioma atual → en-US → a própria chave (visível = bug de chave).
 *
 * @param {Record<string, Record<string, string>>} dicionario dicionário { lang: { chave: texto } }
 * @param {string} chave chave da string
 * @param {Record<string, string|number>} [params] substituições `{nome}`
 * @returns {string} texto no idioma ativo
 * @example
 * const STRINGS = { 'en-US': { add: 'Add item' }, 'pt-BR': { add: 'Adicionar item' } };
 * tr(STRINGS, 'add'); // 'Add item' (ou 'Adicionar item' em pt-BR)
 */
export function tr(dicionario, chave, params) {
  const texto = dicionario[idiomaAtual]?.[chave] ?? dicionario['en-US']?.[chave] ?? chave;
  if (!params) return texto;
  let saida = texto;
  for (const [nome, valor] of Object.entries(params)) {
    saida = saida.replaceAll(`{${nome}}`, String(valor));
  }
  return saida;
}

/**
 * Aplica o dicionário SHELL a todos os nós `[data-i18n]` da página.
 *
 * Atributos suportados:
 * - `data-i18n="chave"` → textContent (texto puro)
 * - `data-i18n-html="chave"` → HTML autoral do dicionário (só <code>, <strong>,
 *   <em>, <a> — conteúdo estático escrito por nós, nunca entrada de usuário)
 * - `data-i18n-attr="titulo:chave;aria-label:outra"` → atributos
 *
 * @param {Document|Element} [raiz] nó raiz da aplicação (padrão: document)
 * @example
 * aplicarTraducoes(); // na troca de idioma
 */
export function aplicarTraducoes(raiz) {
  // Node (testes) não tem document — função é no-op fora do navegador
  if (typeof document === 'undefined') return;
  const alvo = raiz ?? document;

  document.documentElement.lang = idiomaAtual === 'pt-BR' ? 'pt-BR' : 'en';
  document.title = SHELL[idiomaAtual]['doc.title'];

  for (const el of alvo.querySelectorAll('[data-i18n]')) {
    el.textContent = tr(SHELL, el.getAttribute('data-i18n') ?? '');
  }

  for (const el of alvo.querySelectorAll('[data-i18n-html]')) {
    const html = tr(SHELL, el.getAttribute('data-i18n-html') ?? '');
    // template + cloneNode: parseia o HTML autoral do dicionário de forma segura
    // (conteúdo estático do projeto — nenhum dado de usuário passa por aqui)
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    el.replaceChildren(tpl.content.cloneNode(true));
  }

  for (const el of alvo.querySelectorAll('[data-i18n-attr]')) {
    const pares = (el.getAttribute('data-i18n-attr') ?? '').split(';');
    for (const par of pares) {
      const [attr, chave] = par.split(':').map((p) => p.trim());
      if (attr && chave) el.setAttribute(attr, tr(SHELL, chave));
    }
  }
}
