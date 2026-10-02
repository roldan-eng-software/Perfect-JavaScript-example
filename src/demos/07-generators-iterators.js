// @ts-check
/**
 * ARQUIVO: 07-generators-iterators.js
 * PROPÓSITO: demonstrar geradores (function*), iteráveis customizados
 *   (Symbol.iterator), async generators com for await...of, scroll infinito
 *   sob demanda, coleções Set/Map/WeakSet com groupBy e iterator helpers.
 * CONCEITOS DEMONSTRADOS: function*, .next()/return, Symbol.iterator, spread,
 *   async function* + for await...of, AbortController + sleep cancelável,
 *   Set/Map/WeakSet, Object.groupBy/Map.groupBy (feature detection),
 *   Iterator.prototype.map (iterator helpers) com fallback manual.
 * USADO EM: seção 07 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: retorna cleanup que aborta sleeps pendentes,
 *   remove o listener de scroll e cancela timers (debounce).
 */
import { h, on, renderList } from '../core/dom.js';
import { sleep } from '../utils/sleep.js';

/**
 * Inicializa a demo de geradores e iteradores.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — aborta sleeps, remove listeners e cancela timers
 * @example
 * const cleanup = init(document.querySelector('#demo07'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];

  // O que é: AbortController sinaliza cancelamento; sleep({signal}) rejeita com
  // AbortError quando abortamos. Por que usei aqui: todo trabalho assíncrono da
  // demo (páginas, scroll) precisa morrer junto com o cleanup, sem vazar timers.
  const controlador = new AbortController();
  let timerScroll = 0;

  /**
   * Anexa uma linha de texto a um output/aria-live (textContent, nunca innerHTML).
   *
   * @param {HTMLElement} output elemento acumulador
   * @param {string} texto linha a acrescentar
   */
  function anexar(output, texto) {
    output.append(h('div', { class: 'saida-linha', text: texto }));
    output.scrollTop = output.scrollHeight;
  }

  /**
   * true quando o erro é de cancelamento (AbortError do signal).
   *
   * @param {unknown} erro erro capturado
   * @returns {boolean} true se o aborto causou o erro
   */
  function ehCancelamento(erro) {
    // DOMException (o tipo do aborto) NÃO herda de Error no navegador —
    // por isso checamos `name` em vez de `instanceof Error`.
    return (
      typeof erro === 'object' && erro !== null && 'name' in erro && erro.name === 'AbortError'
    );
  }

  // ── a) function*: gerador de Fibonacci consumido de duas formas ───────────
  // O que é: function* devolve um ITERADOR preguiçoso — cada .next() roda até
  // o próximo yield. Por que usei aqui: sequência (possivelmente longa) sem
  // alocar array inteiro de uma vez; o consumidor decide o ritmo.
  /**
   * Gera os `limite` primeiros números de Fibonacci.
   *
   * @param {number} limite quantidade de valores produzidos
   * @returns {Generator<number, void, void>} gerador de Fibonacci
   */
  function* fibonacci(limite) {
    let a = 0;
    let b = 1;
    for (let i = 0; i < limite; i++) {
      yield a;
      const proximo = a + b;
      a = b;
      b = proximo;
    }
  }

  const listaFib = h('ul', { class: 'lista-simples' });
  const saidaPassos = h('output', { class: 'saida', 'aria-live': 'polite' });
  let geradorManual = fibonacci(30);
  let geradorEsgotado = false;

  /** consome o gerador com for…of (iteração declarativa, até o fim). */
  function consumirComForOf() {
    const valores = [];
    for (const numero of fibonacci(15)) valores.push(numero);
    renderList(listaFib, valores, (numero) => h('li', { text: String(numero) }));
  }

  /** consome 5 passos com .next() manual — mostra {value, done} de cada um. */
  function gerarProximos5() {
    if (geradorEsgotado) {
      geradorManual = fibonacci(30);
      geradorEsgotado = false;
      anexar(saidaPassos, '— gerador esgotado, reiniciado —');
    }
    for (let i = 0; i < 5; i++) {
      const passo = geradorManual.next();
      anexar(saidaPassos, `{ value: ${String(passo.value)}, done: ${passo.done} }`);
      if (passo.done) {
        geradorEsgotado = true;
        break;
      }
    }
  }

  const painelGerador = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'a) function* — Fibonacci sob demanda' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: 'Consumir com for…of', on: { click: consumirComForOf } }),
      h('button', { type: 'button', text: 'Gerar próximos 5', on: { click: gerarProximos5 } }),
    ),
    listaFib,
    saidaPassos,
    h('p', {
      class: 'nota',
      text: 'for…of chama [Symbol.iterator]() e repete .next() até done:true; o botão faz exatamente isso na mão.',
    }),
  );

  consumirComForOf();

  // ── b) Iterável customizado: objeto com Symbol.iterator ───────────────────
  // O que é: qualquer objeto com [Symbol.iterator]() que devolve {value, done}
  // serve o for…of/…. Por que usei aqui: range sem criar array (lazy, 0 alocação
  // prévia) e compatível com spread/destructuring/promise all.
  /**
   * Cria um intervalo iterável de `inicio` a `fim` (inclusivo).
   *
   * @param {number} fim último valor do intervalo
   * @param {number} [inicio] primeiro valor (padrão 1)
   * @returns {object} objeto iterável com Symbol.iterator
   * @example
   * [...criarRange(4)]; // [1, 2, 3, 4]
   */
  function criarRange(fim, inicio = 1) {
    return {
      [Symbol.iterator]() {
        let atual = inicio;
        return {
          next() {
            if (atual > fim) return { value: undefined, done: true };
            const valor = atual;
            atual += 1;
            return { value: valor, done: false };
          },
        };
      },
    };
  }

  const listaRange = h('ul', { class: 'lista-simples' });
  const saidaRange = h('output', { class: 'saida', 'aria-live': 'polite' });

  function exercitarRange() {
    // for…of sobre o objeto customizado (sem array por trás)
    const percorridos = [];
    for (const n of criarRange(8)) percorridos.push(n);
    renderList(listaRange, percorridos, (n) => h('li', { text: String(n) }));
    // spread usa o MESMO protocolo de iteração
    const espalhado = [...criarRange(5)];
    saidaRange.textContent = `spread [...criarRange(5)] = ${JSON.stringify(espalhado)}`;
  }

  const painelRange = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'b) Iterável próprio: Symbol.iterator (range)' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: 'Percorrer range 1..8', on: { click: exercitarRange } }),
    ),
    listaRange,
    saidaRange,
    h('p', {
      class: 'nota',
      text: 'for…of e spread compartilham o mesmo protocolo: se o objeto itera, tudo do ecossistema funciona.',
    }),
  );

  // ── c) Async generator + for await...of: API paginada simulada ────────────
  // O que é: async function* dá valores que chegam como Promise — consumidos com
  // for await...of. Por que usei aqui: paginação é I/O; o consumidor espera cada
  // página chegar sem gerenciar estado de "próxima página" manualmente.
  let paginasEmAndamento = false;
  const caixaPaginas = h('div', {
    class: 'caixa-scroll',
    style:
      'max-height: 11rem; overflow: auto; border: 1px solid var(--cor-borda); ' +
      'border-radius: 7px; padding: 0.4rem;',
  });
  const statusPaginas = h('output', { class: 'nota', 'aria-live': 'polite' });

  /**
   * Simula uma API paginada: cada página "chega" após 150 ms.
   *
   * @param {number} totalPaginas quantas páginas a API devolve
   * @returns {AsyncGenerator<{pagina: number, itens: string[]}, void, void>} gerador assíncrono
   */
  async function* paginando(totalPaginas) {
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      await sleep(150, { signal: controlador.signal });
      yield {
        pagina,
        itens: Array.from({ length: 3 }, (_, i) => `P${pagina} · item ${i + 1}`),
      };
    }
  }

  async function consumirPaginas() {
    if (paginasEmAndamento) return;
    paginasEmAndamento = true;
    caixaPaginas.replaceChildren();
    statusPaginas.textContent = 'aguardando páginas…';
    try {
      for await (const pagina of paginando(4)) {
        caixaPaginas.append(
          h(
            'div',
            { class: 'pagina' },
            h('strong', { text: `Página ${pagina.pagina}` }),
            h(
              'ul',
              {},
              pagina.itens.map((item) => h('li', { text: item })),
            ),
          ),
        );
        statusPaginas.textContent = `página ${pagina.pagina} de 4 recebida`;
      }
      statusPaginas.textContent = '4 de 4 páginas recebidas — for await...of encerrou sozinho';
    } catch (erro) {
      statusPaginas.textContent = ehCancelamento(erro)
        ? 'carregamento cancelado (cleanup)'
        : `erro: ${erro instanceof Error ? erro.message : String(erro)}`;
    } finally {
      paginasEmAndamento = false;
    }
  }

  const painelPaginas = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'c) Async generator + for await...of (paginação)' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Carregar 4 páginas',
        on: { click: () => void consumirPaginas() },
      }),
    ),
    statusPaginas,
    caixaPaginas,
    h('p', {
      class: 'nota',
      text: 'sleep(150, {signal}) simula latência; abortar no cleanup rejeita a promise e o laço para com elegância.',
    }),
  );

  // ── d) Scroll infinito: loadMore alimentado por async generator ───────────
  // O que é: o gerador guarda o "ponteiro" entre chamadas — retomar de onde
  // parou é trivial. Por que usei aqui: scroll infinito sem guardas de índice
  // duplicado; .next() em lotes mantém o gerador vivo entre rolagens.
  const MAXIMO_ITENS = 60;
  const LOTE = 8;
  let totalItens = 0;
  let carregandoMais = false;

  /** Gerador assíncrono que produz números 1..60 com latência simulada. */
  async function* gerarItens() {
    let numero = 1;
    while (numero <= MAXIMO_ITENS) {
      await sleep(120, { signal: controlador.signal });
      yield numero;
      numero += 1;
    }
  }

  const geradorScroll = gerarItens();
  const listaScroll = h('ul', { class: 'lista-simples' });
  const statusScroll = h('output', { class: 'nota', 'aria-live': 'polite' });
  const caixaInfinite = h('div', {
    class: 'caixa-scroll',
    style:
      'max-height: 12rem; overflow-y: auto; border: 1px solid var(--cor-borda); ' +
      'border-radius: 7px; padding: 0.4rem;',
    tabindex: '0',
    'aria-label': 'Lista com rolagem infinita (role de item)',
  });

  /** Carrega o próximo lote via .next() (retoma o gerador de onde parou). */
  async function carregarMais() {
    if (carregandoMais) return;
    if (totalItens >= MAXIMO_ITENS) {
      statusScroll.textContent = `limite de ${MAXIMO_ITENS} itens atingido`;
      return;
    }
    carregandoMais = true;
    statusScroll.textContent = 'carregando…';
    try {
      for (let i = 0; i < LOTE && totalItens < MAXIMO_ITENS; i++) {
        const passo = await geradorScroll.next();
        if (passo.done) break;
        totalItens += 1;
        listaScroll.append(h('li', { text: `Item ${passo.value}` }));
      }
      statusScroll.textContent = `${totalItens} de ${MAXIMO_ITENS} itens exibidos`;
    } catch (erro) {
      statusScroll.textContent = ehCancelamento(erro)
        ? 'carregamento cancelado (cleanup)'
        : `erro: ${erro instanceof Error ? erro.message : String(erro)}`;
    } finally {
      carregandoMais = false;
    }
  }

  /** Debounce do scroll: só dispara depois de ~80 ms parado perto do fim. */
  function aoRolar() {
    const pertoDoFim =
      caixaInfinite.scrollTop + caixaInfinite.clientHeight >= caixaInfinite.scrollHeight - 40;
    if (!pertoDoFim || carregandoMais) return;
    clearTimeout(timerScroll);
    timerScroll = setTimeout(() => {
      void carregarMais();
    }, 80);
  }

  remocoes.push(on(caixaInfinite, 'scroll', aoRolar));

  const painelScroll = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'd) Scroll infinito com async generator' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Carregar mais',
        on: { click: () => void carregarMais() },
      }),
      statusScroll,
    ),
    caixaInfinite,
    h('p', {
      class: 'nota',
      text: 'Rolar perto do fim pede o próximo lote; o gerador retoma exatamente onde parou (máx. 60 itens).',
    }),
  );
  caixaInfinite.append(listaScroll);

  // Primeiro lote: senão a caixa não gera barra de rolagem e o scroll nunca dispara
  void carregarMais();

  // ── e) Set / WeakSet / Map + groupBy com feature detection ────────────────
  // O que é: Set elimina duplicatas; WeakSet guarda objetos (chaves fracas, sem
  // enumeração); Object.groupBy/Map.groupBy agrupam em O(n). Por que usei aqui:
  // comparar as estruturas na prática e proteger groupBy com detecção de suporte.
  const saidaColecoes = h('pre', {
    class: 'previa-estado',
    style: 'max-height: 16rem; overflow: auto;',
    'aria-live': 'polite',
  });

  function exercitarColecoes() {
    // Set: duplicatas somem na inserção — size mostra a unicidade
    const conjunto = new Set(['ana', 'bia', 'ana', 'caio', 'bia', 'ana']);
    const fracos = new WeakSet();
    const alvo1 = { id: 1 };
    const alvo2 = { id: 2 };
    fracos.add(alvo1);

    const pessoas = [
      { nome: 'ana', time: 'dev' },
      { nome: 'bia', time: 'qa' },
      { nome: 'caio', time: 'dev' },
      { nome: 'davi', time: 'qa' },
    ];

    // groupBy com fallback: suporte detectado em tempo de execução
    const objetoAgrupado =
      'Object.groupBy' in Object
        ? Object.groupBy(pessoas, (pessoa) => pessoa.time)
        : pessoas.reduce((acervo, pessoa) => {
            const lista = acervo[pessoa.time] ?? [];
            lista.push(pessoa);
            acervo[pessoa.time] = lista;
            return acervo;
          }, /** @type {Record<string, typeof pessoas>} */ ({}));

    const mapaAgrupado =
      'Map.groupBy' in Map
        ? Map.groupBy(pessoas, (pessoa) => pessoa.time)
        : pessoas.reduce((mapa, pessoa) => {
            const lista = mapa.get(pessoa.time) ?? [];
            lista.push(pessoa);
            mapa.set(pessoa.time, lista);
            return mapa;
          }, new Map());

    const resultado = {
      set: { size: conjunto.size, itens: [...conjunto] },
      weakSet: { temAlvo1: fracos.has(alvo1), temAlvo2: fracos.has(alvo2) },
      objectGroupBy: objetoAgrupado,
      mapGroupBy: Object.fromEntries(mapaAgrupado),
      suporte: {
        objectGroupBy: 'Object.groupBy' in Object,
        mapGroupBy: 'Map.groupBy' in Map,
      },
    };
    // JSON via textContent: dado dinâmico nunca passa por innerHTML
    saidaColecoes.textContent = JSON.stringify(resultado, null, 2);
  }

  const painelColecoes = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'e) Set / WeakSet / Map + Object.groupBy e Map.groupBy' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Agrupar e deduplicar',
        on: { click: exercitarColecoes },
      }),
    ),
    saidaColecoes,
    h('p', {
      class: 'nota',
      text: "Detecção: 'Object.groupBy' in Object ? Object.groupBy(...) : reduce manual — navegadores antigos não quebram.",
    }),
  );

  // ── f) Iterator helpers (ES2025) com fallback manual ──────────────────────
  // O que é: iterator helpers acrescentam map/filter/take/toArray ao próprio
  // Iterator (lazy, sem array intermediário). Por que usei aqui: feature
  // detection real — se não existir, um gerador manual faz a MESMA coisa.
  const ehSuporte =
    typeof Iterator !== 'undefined' && typeof Array.prototype.toSorted === 'function';
  const saidaHelpers = h('pre', {
    class: 'previa-estado',
    style: 'max-height: 16rem; overflow: auto;',
    'aria-live': 'polite',
  });

  /**
   * Fallback manual: aplica mapeamento + filtro sobre um iterável, devolvendo
   * um gerador lazy com o mesmo comportamento de Iterator.prototype.map/filter.
   *
   * @param {Iterable<number>} origem sequência de entrada
   * @param {(valor: number) => number} mapear transformação de cada valor
   * @param {(valor: number) => boolean} filtrar predicado de aceitação
   * @returns {Generator<number, void, void>} gerador lazy mapeado e filtrado
   */
  function* mapearFiltrar(origem, mapear, filtrar) {
    for (const valor of origem) {
      const transformado = mapear(valor);
      if (filtrar(transformado)) yield transformado;
    }
  }

  /** Pega os N primeiros valores de um iterável (equivalente a .take(n)). */
  function pegarN(iteravel, quantidade) {
    const valores = [];
    for (const valor of iteravel) {
      valores.push(valor);
      if (valores.length >= quantidade) break;
    }
    return valores;
  }

  function exercitarHelpers() {
    const ehQuadradoPar = (n) => n % 2 === 0;
    const aoQuadrado = (n) => n * n;
    let resultado;

    if (ehSuporte && typeof globalThis.Iterator?.from === 'function') {
      // Caminho moderno: helpers nativos, lazy (sem array intermediário)
      const IteratorGlobal = /** @type {any} */ (globalThis.Iterator);
      resultado = IteratorGlobal.from(criarRange(10))
        .map(aoQuadrado)
        .filter(ehQuadradoPar)
        .take(3)
        .toArray();
    } else {
      // Fallback: mesmo cálculo com gerador manual + laço de parada
      resultado = pegarN(mapearFiltrar(criarRange(10), aoQuadrado, ehQuadradoPar), 3);
    }

    saidaHelpers.textContent = JSON.stringify(
      {
        ehSuporte,
        suporteIteratorPrototypeMap:
          ehSuporte && typeof globalThis.Iterator?.prototype?.map === 'function',
        quadradosParadeImpar: resultado,
      },
      null,
      2,
    );
  }

  const painelHelpers = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'f) Iterator helpers — suporte + fallback' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: 'Detectar e executar', on: { click: exercitarHelpers } }),
    ),
    saidaHelpers,
    h('p', {
      class: 'nota',
      text: 'quadrados pares de 1..10 limitados a 3: [4, 16, 36] — com Iterator.map nativo ou gerador manual equivalente.',
    }),
  );

  container.append(
    painelGerador,
    painelRange,
    painelPaginas,
    painelScroll,
    painelColecoes,
    painelHelpers,
  );

  // Cleanup: aborta sleeps pendentes (rejeição tratada nos laços assíncronos),
  // cancela o debounce de scroll e remove o listener explícito do scroll.
  return () => {
    controlador.abort();
    clearTimeout(timerScroll);
    for (const remover of remocoes) remover();
  };
}
