// @ts-check
/**
 * ARQUIVO: demo-card.js
 * PROPÓSITO: cartão de seção com título, descrição, link de código e slot de conteúdo.
 * CONCEITOS DEMONSTRADOS: Custom Elements com <slot>, parts/estilos externos,
 *   semântica acessível (article + heading).
 * USADO EM: index.html — encapsula cada seção/demo da landing.
 * COMPLEXIDADE/OBSERVAÇÕES: estilizado por variáveis CSS globais via :host,
 *   mantendo o tema claro/escuro coerente com o resto da página.
 */

/**
 * Componente <demo-card title="…" id="…" code="caminho/do/arquivo.js">.
 *
 * Atributos:
 * - `title`: título da seção (vira <h2> interno)
 * - `code`: caminho do módulo exibido no link "ver código"
 * - `number`: numeral da demo (ex.: "01")
 *
 * Slots:
 * - default: explicação/texto introdutório
 * - `demo`: área da demonstração interativa
 */
export class DemoCard extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'code', 'number'];
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    if (!this.shadowRoot.childElementCount) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            background: var(--cor-cartao, #fff);
            border: 1px solid var(--cor-borda, #d0d7de);
            border-radius: 12px;
            padding: clamp(1rem, 3vw, 1.75rem);
            margin-block: 1.5rem;
            box-shadow: 0 1px 3px rgb(0 0 0 / .06);
          }
          .cabecalho {
            display: flex; align-items: baseline; gap: .75rem;
            flex-wrap: wrap; margin-block-end: .75rem;
          }
          .numeral {
            font: 700 .85rem/1 ui-monospace, monospace;
            color: var(--cor-acento, #0969da);
            background: var(--cor-acento-fundo, #ddf4ff);
            padding: .3rem .55rem; border-radius: 999px;
          }
          h2 { font-size: clamp(1.1rem, 2.5vw, 1.4rem); margin: 0; }
          .codigo {
            margin-inline-start: auto; font: 500 .8rem/1 ui-monospace, monospace;
            color: var(--cor-acento, #0969da); text-decoration: none;
          }
          .codigo:hover { text-decoration: underline; }
          .codigo:focus-visible { outline: 2px solid var(--cor-foco, #0969da); outline-offset: 3px; }
          .intro { color: var(--cor-texto-sec, #57606a); font-size: .95rem; }
          .demo { margin-block-start: 1rem; }
          @media (prefers-color-scheme: dark) {
            :host([data-tema='dark']) h2 { color: #e6edf3; }
          }
        </style>
        <article>
          <header class="cabecalho">
            <span class="numeral" aria-hidden="true"></span>
            <h2></h2>
            <a class="codigo" target="_blank" rel="noopener noreferrer">ver código ↗</a>
          </header>
          <div class="intro"><slot></slot></div>
          <div class="demo"><slot name="demo"></slot></div>
        </article>
      `;
    }
    this.#atualizar();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#atualizar();
  }

  /** Sincroniza atributos → nós internos (nunca via innerHTML dinâmico). */
  #atualizar() {
    const raiz = this.shadowRoot;
    if (!raiz) return;

    const numeral = raiz.querySelector('.numeral');
    const titulo = raiz.querySelector('h2');
    const link = raiz.querySelector('.codigo');
    const numero = this.getAttribute('number');

    if (numeral) {
      numeral.textContent = numero ?? '';
      numeral.style.display = numero ? '' : 'none';
    }
    if (titulo) titulo.textContent = this.getAttribute('title') ?? '';

    const code = this.getAttribute('code');
    if (link) {
      if (code) {
        // link correto relativo ao index.html na raiz
        link.setAttribute('href', code);
        link.style.display = '';
      } else {
        link.style.display = 'none';
      }
    }
  }
}

if (!customElements.get('demo-card')) {
  customElements.define('demo-card', DemoCard);
}
