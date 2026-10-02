// @ts-check
/**
 * ARQUIVO: accessible-tabs.js
 * PROPÓSITO: abas acessíveis seguindo o padrão WAI-ARIA Authoring Practices.
 * CONCEITOS DEMONSTRADOS: Custom Elements com Shadow DOM e <slot>, navegação por
 *   teclado (setas/Home/End), aria-selected/aria-controls, roles ARIA.
 * USADO EM: demos que alternam variantes (ex.: demo 07, demo 13).
 * COMPLEXIDADE/OBSERVAÇÕES: implementa o padrão "tabs com ativação automática"
 *   (roving tabindex): só a aba ativa tem tabindex=0, o Tab pula o conjunto.
 */

/**
 * Componente <accessible-tabs>.
 *
 * Uso:
 * ```html
 * <accessible-tabs>
 *   <button slot="tab" aria-controls="p1">Um</button>
 *   <button slot="tab" aria-controls="p2">Dois</button>
 *   <section slot="panel" id="p1">…</section>
 *   <section slot="panel" id="p2">…</section>
 * </accessible-tabs>
 * ```
 *
 * Teclado: ← → navegam, Home/End vão aos extremos, Tab sai do conjunto.
 */
export class AccessibleTabs extends HTMLElement {
  /** @type {number} índice da aba ativa */
  #ativo = 0;

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    if (!this.shadowRoot.childElementCount) {
      this.shadowRoot.innerHTML = `
        <style>
          .painel { display: none; padding-top: .75rem; }
          .painel[data-ativo] { display: block; }
          ::slotted([slot='tab']) {
            font: 500 .9rem/1 system-ui, sans-serif;
            padding: .5rem .9rem; cursor: pointer;
            border: 1px solid var(--cor-borda); background: var(--cor-fundo);
            color: var(--cor-texto);
          }
          ::slotted([slot='tab'][aria-selected='true']) {
            background: var(--cor-acento); color: #fff; border-color: var(--cor-acento);
          }
          ::slotted([slot='tab']:focus-visible) {
            outline: 2px solid var(--cor-foco); outline-offset: 2px;
          }
          .barra { display: flex; flex-wrap: wrap; gap: .35rem; }
        </style>
        <div role="tablist" aria-orientation="horizontal" class="barra">
          <slot name="tab"></slot>
        </div>
        <div class="conteudo">
          <slot name="panel"></slot>
        </div>
      `;

      // Delegação: um listener atende todas as abas (slot light-DOM)
      this.shadowRoot.addEventListener('click', (evento) => {
        const aba = this.#abaDoEvento(evento);
        if (aba) this.#ativar(this.#abas().indexOf(aba));
      });
      this.shadowRoot.addEventListener('keydown', (evento) => this.#tecla(evento));
    }

    // Inicializa roles/estados depois que o light DOM está pronto
    queueMicrotask(() => this.#ativar(0));
  }

  /** @returns {HTMLButtonElement[]} abas (filhos com slot=tab) */
  #abas() {
    return Array.from(this.querySelectorAll('[slot="tab"]'));
  }

  /** @returns {HTMLElement[]} painéis (filhos com slot=panel) */
  #paineis() {
    return Array.from(this.querySelectorAll('[slot="panel"]'));
  }

  /**
   * Resolve a aba clicada/teclada a partir do evento.
   * @param {Event} evento evento capturado
   * @returns {Element|null} nó da aba ou null
   */
  #abaDoEvento(evento) {
    const alvo = evento.target instanceof Element ? evento.target : null;
    return alvo?.closest('[slot="tab"]') ?? null;
  }

  /**
   * Ativa a aba `indice`, atualizando aria e roving tabindex.
   * @param {number} indice índice da aba
   */
  #ativar(indice) {
    const abas = this.#abas();
    const paineis = this.#paineis();
    if (abas.length === 0 || indice < 0 || indice >= abas.length) return;
    this.#ativo = indice;

    abas.forEach((aba, i) => {
      const selecionada = i === indice;
      aba.setAttribute('role', 'tab');
      aba.setAttribute('aria-selected', String(selecionada));
      // Roving tabindex: apenas a aba ativa participa do Tab do teclado
      aba.setAttribute('tabindex', selecionada ? '0' : '-1');
    });

    paineis.forEach((painel, i) => {
      painel.setAttribute('role', 'tabpanel');
      if (i === indice) painel.setAttribute('data-ativo', '');
      else painel.removeAttribute('data-ativo');
      // Painel inativo também sai da ordem de tabulação
      painel.setAttribute('tabindex', i === indice ? '0' : '-1');
    });
  }

  /**
   * Navegação por teclado dentro do tablist.
   * @param {KeyboardEvent} evento evento de tecla
   */
  #tecla(evento) {
    const aba = this.#abaDoEvento(evento);
    if (!aba) return;
    const total = this.#abas().length;
    const mapa = {
      ArrowRight: (this.#ativo + 1) % total,
      ArrowLeft: (this.#ativo - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    const proximo = mapa[/** @type {keyof typeof mapa} */ (evento.key)];
    if (proximo === undefined) return;
    evento.preventDefault();
    this.#ativar(proximo);
    // Foco acompanha a navegação (foco segue a seleção)
    this.#abas()[proximo]?.focus();
  }
}

if (!customElements.get('accessible-tabs')) {
  customElements.define('accessible-tabs', AccessibleTabs);
}
