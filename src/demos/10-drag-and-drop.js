// @ts-check
/**
 * ARQUIVO: 10-drag-and-drop.js
 * PROPÓSITO: Kanban de 3 colunas com HTML5 Drag & Drop API e alternativa
 *   COMPLETA por teclado/botões (acessibilidade), anunciando cada movimento
 *   em aria-live e persistindo a ordem em localStorage.
 * CONCEITOS DEMONSTRADOS: Drag and Drop API (draggable/dragstart/dragover/drop),
 *   delegação de eventos, teclado como equalizador de acessibilidade,
 *   createStorage, feature detection, aria-live.
 * USADO EM: seção 10 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: drag não funciona em touch — os botões ◀/▶ e as
 *   setas cobrem teclado, leitores de tela e celular; cleanup persiste a ordem.
 */
import { h, on, delegate } from '../core/dom.js';
import { createStorage } from '../core/storage.js';

/**
 * @typedef {object} Cartao
 * @property {string} id identificador estável (sobrevive a re-render)
 * @property {string} titulo texto do cartão
 */

/** Colunas do quadro, na ordem das setas ←/→. */
const COLUNAS = [
  { id: 'fazer', titulo: 'A Fazer' },
  { id: 'fazendo', titulo: 'Fazendo' },
  { id: 'feito', titulo: 'Feito' },
];

/** Estado inicial (3–4 cartões por coluna) — usado na 1ª visita. */
const PADRAO = {
  fazer: /** @type {Cartao[]} */ ([
    { id: 'c1', titulo: 'Escrever README do portfólio' },
    { id: 'c2', titulo: 'Revisar contraste dos botões' },
    { id: 'c3', titulo: 'Adicionar testes das máscaras' },
    { id: 'c4', titulo: 'Publicar demo 10' },
  ]),
  fazendo: /** @type {Cartao[]} */ ([
    { id: 'c5', titulo: 'Estudar IntersectionObserver' },
    { id: 'c6', titulo: 'Refatorar debounce' },
    { id: 'c7', titulo: 'Demo 09 — validação de forms' },
  ]),
  feito: /** @type {Cartao[]} */ ([
    { id: 'c8', titulo: 'Setup do ESLint' },
    { id: 'c9', titulo: 'Demo 01 — closures e HOF' },
    { id: 'c10', titulo: 'Tema claro/escuro' },
  ]),
};

/**
 * Inicializa o Kanban acessível com drag & drop.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — remove listeners e persiste a ordem
 * @example
 * const cleanup = init(document.querySelector('#demo10'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];

  // Feature detection: existe HTML5 Drag & Drop? Sem ela, o fallback é o
  // teclado/botões — que funcionam em qualquer navegador, inclusive touch.
  const suportaDnD =
    'draggable' in document.createElement('div') && 'ondragstart' in document.createElement('div');

  // Storage com prefixo próprio (fallback em memória se o localStorage falhar)
  const storage = createStorage('local', 'kanban:');

  /**
   * Valida o estado salvo — devolve null se vier corrompido/incompleto para
   * cair no PADRAO em vez de quebrar a renderização.
   *
   * @param {unknown} bruto valor lido do storage
   * @returns {Record<string, Cartao[]>|null} quadro saneado ou null
   */
  function sanitizar(bruto) {
    if (!bruto || typeof bruto !== 'object') return null;
    /** @type {Record<string, Cartao[]>} */
    const quadro = {};
    for (const def of COLUNAS) {
      const lista = /** @type {Record<string, unknown>} */ (bruto)[def.id];
      if (!Array.isArray(lista)) return null;
      quadro[def.id] = lista
        .filter((item) => {
          const cartao = /** @type {Cartao|null} */ (item);
          return Boolean(
            cartao && typeof cartao.id === 'string' && typeof cartao.titulo === 'string',
          );
        })
        .map((item) => {
          const cartao = /** @type {Cartao} */ (item);
          return { id: cartao.id, titulo: cartao.titulo };
        });
    }
    return quadro;
  }

  const quadro = sanitizar(storage.get('quadro')) ?? structuredClone(PADRAO);
  /** @type {string|null} id do cartão sendo arrastado (fallback p/ dataTransfer) */
  let arrastandoId = null;

  // ── DOM ────────────────────────────────────────────────────────────────────
  const status = h('p', {
    class: 'nota',
    role: 'status',
    'aria-live': 'polite',
    text: 'Pronto — Tab foca um cartão, ←/→ move entre colunas, ↑/↓ reordena.',
  });

  const quadroEl = h('div', { class: 'kanban' });
  /** @type {Map<string, { def: {id: string, titulo: string}, raiz: HTMLElement, lista: HTMLElement, contador: HTMLElement }>} */
  const colunasEl = new Map();

  for (const def of COLUNAS) {
    const contador = h('span', { class: 'nota' });
    const lista = h('div', { class: 'lista-cartoes', dataset: { coluna: def.id } });
    const raiz = h(
      'section',
      { class: 'coluna', dataset: { coluna: def.id }, 'aria-label': `Coluna ${def.titulo}` },
      h('h3', { text: def.titulo }),
      contador,
      lista,
    );
    quadroEl.append(raiz);
    colunasEl.set(def.id, { def, raiz, lista, contador });
  }

  // ── helpers de estado ──────────────────────────────────────────────────────
  /**
   * @param {string} colunaId id da coluna
   * @returns {string} título legível da coluna
   */
  function tituloColuna(colunaId) {
    return COLUNAS.find((def) => def.id === colunaId)?.titulo ?? colunaId;
  }

  /**
   * @param {string} id cartão procurado
   * @returns {{ colunaId: string, indice: number }|null} posição atual
   */
  function localizar(id) {
    for (const def of COLUNAS) {
      const indice = quadro[def.id].findIndex((cartao) => cartao.id === id);
      if (indice >= 0) return { colunaId: def.id, indice };
    }
    return null;
  }

  /** Grava o quadro inteiro no storage (uma chave, JSON puro). */
  function salvar() {
    storage.set('quadro', quadro);
  }

  /**
   * @param {string} texto mensagem para o leitor de tela
   */
  function anunciar(texto) {
    status.textContent = texto;
  }

  /**
   * Move o cartão para uma coluna/posição, re-renderiza e anuncia — o único
   * caminho de mutação (teclado, botões e drop passam por aqui).
   *
   * @param {string} id cartão
   * @param {string} destinoId coluna destino
   * @param {number} indice posição de inserção no destino
   */
  function moverCartao(id, destinoId, indice) {
    const atual = localizar(id);
    if (!atual) return;
    const [cartao] = quadro[atual.colunaId].splice(atual.indice, 1);
    const lista = quadro[destinoId];
    const posicao = Math.max(0, Math.min(indice, lista.length));
    lista.splice(posicao, 0, cartao);
    salvar();
    renderizar(id);
    // Texto exatamente no formato pedido: "Card X movido para Fazendo"
    anunciar(`Card ${cartao.titulo} movido para ${tituloColuna(destinoId)}`);
  }

  /**
   * Move uma coluna à esquerda/direita (setas ←/→ e botões ◀/▶).
   *
   * @param {string} id cartão
   * @param {number} deslocamento -1 ou +1
   */
  function moverEntreColunas(id, deslocamento) {
    const atual = localizar(id);
    if (!atual) return;
    const indiceColuna = COLUNAS.findIndex((def) => def.id === atual.colunaId);
    const destino = COLUNAS[indiceColuna + deslocamento];
    if (!destino) {
      const borda = deslocamento < 0 ? 'primeira' : 'última';
      anunciar(`Card já está na coluna ${borda} (${tituloColuna(atual.colunaId)}).`);
      return;
    }
    moverCartao(id, destino.id, quadro[destino.id].length);
  }

  /**
   * Reordena dentro da própria coluna (setas ↑/↓).
   *
   * @param {string} id cartão
   * @param {number} deslocamento -1 ou +1
   */
  function reordenar(id, deslocamento) {
    const atual = localizar(id);
    if (!atual) return;
    const lista = quadro[atual.colunaId];
    const destino = atual.indice + deslocamento;
    if (destino < 0 || destino >= lista.length) {
      anunciar(`Card já está nas bordas de ${tituloColuna(atual.colunaId)}.`);
      return;
    }
    const [cartao] = lista.splice(atual.indice, 1);
    lista.splice(destino, 0, cartao);
    salvar();
    renderizar(id);
    anunciar(
      `Card ${cartao.titulo} movido para a posição ${destino + 1} de ${tituloColuna(atual.colunaId)}`,
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  /**
   * Cria o nó de um cartão (focoável, arrastável e com botões de mover).
   *
   * @param {Cartao} cartão dado do cartão
   * @param {string} colunaId coluna atual
   * @param {number} indice posição na coluna
   * @param {number} total total de cartões na coluna
   * @returns {HTMLElement} elemento do cartão
   */
  function criarCartao(cartao, colunaId, indice, total) {
    const focar = (delta) => () => moverEntreColunas(cartao.id, delta);
    return h(
      'article',
      {
        class: 'cartao',
        // draggable só se a API existir; tabindex=0 dá foco de teclado
        draggable: suportaDnD ? 'true' : 'false',
        tabindex: '0',
        dataset: { id: cartao.id, coluna: colunaId },
        'aria-roledescription': 'cartão do kanban',
        'aria-label':
          `${cartao.titulo}. Coluna ${tituloColuna(colunaId)}, ` +
          `posição ${indice + 1} de ${total}. Use as setas para mover.`,
      },
      h('span', { class: 'cartao-titulo', text: cartao.titulo }),
      h(
        'div',
        { class: 'botoes' },
        h('button', {
          type: 'button',
          text: '◀',
          'aria-label': `Mover "${cartao.titulo}" para a esquerda`,
          on: { click: focar(-1) },
        }),
        h('button', {
          type: 'button',
          text: '▶',
          'aria-label': `Mover "${cartao.titulo}" para a direita`,
          on: { click: focar(1) },
        }),
      ),
    );
  }

  /**
   * Re-renderiza todas as colunas a partir do estado em memória.
   *
   * @param {string} [focoId] cartão a receber foco após o render (teclado)
   */
  function renderizar(focoId) {
    for (const def of COLUNAS) {
      const info = colunasEl.get(def.id);
      if (!info) continue;
      const cartoes = quadro[def.id];
      info.contador.textContent = `${cartoes.length} cartões`;
      info.lista.replaceChildren(
        ...cartoes.map((cartao, indice) => criarCartao(cartao, def.id, indice, cartoes.length)),
      );
    }
    if (focoId) {
      for (const no of quadroEl.querySelectorAll('.cartao')) {
        if (no instanceof HTMLElement && no.dataset.id === focoId) {
          no.focus();
          break;
        }
      }
    }
  }

  // ── HTML5 Drag & Drop ──────────────────────────────────────────────────────
  // dragover/drop nas colunas (elementos estáveis → on() devolve a remoção):
  // sem preventDefault no dragover o navegador NÃO dispara drop.
  for (const { def, raiz } of colunasEl.values()) {
    remocoes.push(
      on(raiz, 'dragover', (evento) => {
        if (!suportaDnD) return;
        evento.preventDefault();
        const dados = /** @type {{ dataTransfer?: DataTransfer|null }} */ (evento).dataTransfer;
        if (dados) dados.dropEffect = 'move';
        raiz.classList.add('alvo'); // feedback visual da coluna-alvo
      }),
      on(raiz, 'dragleave', (evento) => {
        const fora = /** @type {{ relatedTarget: EventTarget|null }} */ (evento).relatedTarget;
        if (fora === null || !raiz.contains(/** @type {Node} */ (fora))) {
          raiz.classList.remove('alvo');
        }
      }),
      on(raiz, 'drop', (evento) => {
        if (!suportaDnD) return;
        evento.preventDefault();
        raiz.classList.remove('alvo');
        const dados = /** @type {{ dataTransfer?: DataTransfer|null }} */ (evento).dataTransfer;
        const id = dados?.getData('text/plain') || arrastandoId;
        if (id) moverCartao(id, def.id, quadro[def.id].length);
      }),
    );
  }

  // Delegação: 2 listeners no quadro atendem TODOS os cartões — O(1) listeners
  // em vez de N (e os cartões são recriados a cada render sem reapontar nada).
  remocoes.push(
    delegate(quadroEl, 'dragstart', '.cartao', (evento, alvo) => {
      const id = alvo.dataset.id;
      if (!id) return;
      arrastandoId = id;
      const dados = /** @type {{ dataTransfer?: DataTransfer|null }} */ (evento).dataTransfer;
      dados?.setData('text/plain', id);
      if (dados) dados.effectAllowed = 'move';
      alvo.classList.add('arrastando'); // feedback visual do cartão arrastado
    }),
    delegate(quadroEl, 'dragend', '.cartao', (_evento, alvo) => {
      alvo.classList.remove('arrastando');
      arrastandoId = null;
      for (const { raiz } of colunasEl.values()) raiz.classList.remove('alvo');
    }),
    // ── teclado: alternativa real de acessibilidade (não "enfeite") ─────────
    delegate(quadroEl, 'keydown', '.cartao', (evento, alvo) => {
      const tecla = /** @type {KeyboardEvent} */ (evento).key;
      const id = alvo.dataset.id;
      if (!id) return;
      if (tecla === 'ArrowLeft') {
        evento.preventDefault();
        moverEntreColunas(id, -1);
      } else if (tecla === 'ArrowRight') {
        evento.preventDefault();
        moverEntreColunas(id, 1);
      } else if (tecla === 'ArrowUp') {
        evento.preventDefault();
        reordenar(id, -1);
      } else if (tecla === 'ArrowDown') {
        evento.preventDefault();
        reordenar(id, 1);
      }
    }),
  );

  // ── montagem ───────────────────────────────────────────────────────────────
  const instrucoes = h('p', {
    class: 'nota',
    text:
      'Teclado: Tab foca o cartão · ←/→ move entre colunas · ↑/↓ reordena · botões ◀/▶ também movem. ' +
      (suportaDnD
        ? 'Mouse: arraste o cartão até a coluna desejada.'
        : 'Seu navegador não tem HTML5 Drag & Drop — use as setas e os botões.'),
  });

  const avisoTouch = h('p', {
    class: 'nota',
    text: 'Toque: drag & drop nativo não dispara em telas de toque — em celular, use os botões ◀/▶ ou o teclado (teclado físico/VO).',
  });

  container.append(
    h(
      'div',
      { class: 'linha' },
      h('h3', { text: 'Kanban acessível (drag & drop + teclado)' }),
      instrucoes,
      avisoTouch,
    ),
    quadroEl,
    status,
  );

  renderizar();

  // Cleanup: remove TODOS os listeners (handles do on()/delegate) e grava a
  // ordem final — a próxima visita retoma exatamente daqui.
  return () => {
    for (const remover of remocoes) remover();
    salvar();
  };
}
