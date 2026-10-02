// @ts-check
/**
 * ARQUIVO: dom.js
 * PROPÓSITO: helpers de DOM seguros e concisos — seleção, criação e delegação.
 * CONCEITOS DEMONSTRADOS: template literals, delegação de eventos, DocumentFragment,
 *   document.querySelector, spread/rest.
 * USADO EM: todas as demos e componentes.
 * COMPLEXIDADE/OBSERVAÇÕES: `h()` nunca aceita `innerHTML` — atributos e filhos
 *   são construídos programaticamente, impedindo injeção de dados não confiáveis.
 */

/**
 * Seleciona um elemento pelo seletor CSS.
 *
 * @template {Element} T
 * @param {string} seletor seletor CSS
 * @param {ParentNode} [escopo] nó raiz da busca (padrão: document)
 * @returns {T|null} elemento encontrado ou null
 * @example
 * const btn = $('button#enviar');
 */
export function $(seletor, escopo = document) {
  return escopo.querySelector(seletor);
}

/**
 * Seleciona todos os elementos que casam com o setor — retorna array real
 * (compatível com map/filter/for…of, diferente de NodeList).
 *
 * @template {Element} T
 * @param {string} seletor seletor CSS
 * @param {ParentNode} [escopo] nó raiz da busca (padrão: document)
 * @returns {T[]} array (possivelmente vazio)
 * @example
 * $$('.card').forEach((card) => card.remove());
 */
export function $$(seletor, escopo = document) {
  return Array.from(escopo.querySelectorAll(seletor));
}

/**
 * Hiperscript: cria um elemento de forma declarativa e segura.
 *
 * - `props.class` / `props.className`: classe CSS
 * - `props.dataset`: { chave: valor } → data-*
 * - `props.on`: { click: fn } → addEventListener por item
 * - demais props: atributos (textContent se for `text`)
 * - `children`: strings viram nós de texto (NUNCA innerHTML)
 *
 * @param {string} tag nome da tag (aceita 'div.classe#id')
 * @param {object} [props] atributos, dataset e handlers
 * @param {...(Node|string|null|undefined)} children filhos anexados
 * @returns {HTMLElement} elemento criado
 * @throws {TypeError} se `tag` não for string válida
 * @example
 * const li = h('li.card', { dataset: { id: '3' }, text: 'Item 3' },
 *   h('button', { on: { click: remover }, text: '✕' }));
 */
export function h(tag, props = {}, ...children) {
  if (typeof tag !== 'string' || tag.trim() === '') {
    throw new TypeError('h: "tag" deve ser uma string não vazia.');
  }

  // Extrai .classe e #id embutidos na tag: h('li.card#item-3')
  const match = tag.match(/^([a-zA-Z][\w-]*)?(?:\.([\w-]+))?(?:#([\w-]+))?$/);
  const nomeTag = match?.[1] ?? 'div';
  const elemento = document.createElement(nomeTag);
  if (match?.[2]) elemento.classList.add(...match[2].split('.'));
  if (match?.[3]) elemento.id = match[3];

  const { class: classe, className, dataset, on, text, ...atributos } = props ?? {};

  if (classe ?? className) {
    elemento.classList.add(
      ...String(classe ?? className)
        .split(/\s+/)
        .filter(Boolean),
    );
  }
  if (dataset) {
    // Object.assign evita setter do dataset quebrar com chaves dinâmicas
    Object.assign(elemento.dataset, dataset);
  }
  if (on) {
    for (const [evento, handler] of Object.entries(on)) {
      elemento.addEventListener(evento, handler);
    }
  }
  if (text !== undefined && text !== null) {
    // textContent: dado dinâmico NUNCA passa por innerHTML
    elemento.textContent = String(text);
  }
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    elemento.setAttribute(nome, valor === true ? '' : String(valor));
  }

  for (const filho of children.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }

  return elemento;
}

/**
 * Adiciona um listener com opções e devolve função de remoção —
 * já pensando no cleanup das demos.
 *
 * @param {EventTarget} alvo elemento ou objeto-alvo
 * @param {string} tipo tipo do evento ('click', 'input'…)
 * @param {EventListenerOrEventListenerObject} handler callback
 * @param {AddEventListenerOptions} [opcoes] opções repassadas ao addEventListener
 * @returns {() => void} função que remove o listener
 * @example
 * const remover = on(lista, 'click', delegarClick);
 * remover(); // no cleanup da demo
 */
export function on(alvo, tipo, handler, opcoes) {
  alvo.addEventListener(tipo, handler, opcoes);
  return () => alvo.removeEventListener(tipo, handler, opcoes);
}

/**
 * Delegação de eventos: um único listener no ancestral atende seletores filhos.
 * Evita N listeners em listas grandes — desempenho + menos vazamento.
 *
 * @param {EventTarget} ancestral nó que recebe o evento (bubbling)
 * @param {string} tipo tipo do evento
 * @param {string} seletor seletor CSS do alvo desejado
 * @param {(evento: Event, alvo: Element) => void} handler chamado com o elemento casado
 * @param {AddEventListenerOptions} [opcoes] opções do listener
 * @returns {() => void} função que remove o listener
 * @example
 * const remover = delegate(ul, 'click', 'button[data-act]', (e, btn) => {
 *   btn.closest('li')?.remove();
 * });
 */
export function delegate(ancestral, tipo, seletor, handler, opcoes) {
  return on(
    ancestral,
    tipo,
    (evento) => {
      const alvo = evento.target instanceof Element ? evento.target.closest(seletor) : null;
      if (alvo && ancestral.contains(alvo)) handler(evento, alvo);
    },
    opcoes,
  );
}

/**
 * Renderiza uma lista grande em um único commit de DOM usando DocumentFragment:
 * monta tudo fora da árvore e anexa uma vez (1 reflow em vez de N).
 *
 * @param {HTMLElement} container destino
 * @param {Iterable<any>} itens dados a renderizar
 * @param {(item: any, indice: number) => Node} criadorItem função que devolve o nó de cada item
 * @returns {number} quantidade de itens renderizados
 * @example
 * renderList(ul, 10000, (n) => h('li', { text: String(n) }));
 */
export function renderList(container, itens, criadorItem) {
  const fragmento = document.createDocumentFragment();
  let quantidade = 0;
  for (const [indice, item] of [...itens].entries()) {
    fragmento.append(criadorItem(item, indice));
    quantidade += 1;
  }
  container.replaceChildren(fragmento);
  return quantidade;
}

/**
 * Cria um elemento a partir de um <template> do HTML — markup declarativo
 * sem innerHTML (o template já é parsed pelo navegador de forma segura).
 *
 * @param {string|HTMLTemplateElement} template seletor do template ou o próprio nó
 * @returns {DocumentFragment} cópia do conteúdo do template
 * @throws {TypeError} se o template não existir/não for <template>
 * @example
 * const no = cloneTemplate('#tpl-card');
 */
export function cloneTemplate(template) {
  const nó = typeof template === 'string' ? $(template) : template;
  if (!(nó instanceof HTMLTemplateElement)) {
    throw new TypeError('cloneTemplate: alvo não é um <template> válido.');
  }
  return nó.content.cloneNode(true);
}
