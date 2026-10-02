// @ts-check
/**
 * ARQUIVO: theme-toggle.js
 * PROPÓSITO: botão que alterna tema claro/escuro com persistência e sync entre abas.
 * CONCEITOS DEMONSTRADOS: Custom Elements, matchMedia (preferência do sistema),
 *   storage.js (persistência), BroadcastChannel (sync entre abas), dataset.
 * USADO EM: header da landing (seção Hero).
 * COMPLEXIDADE/OBSERVAÇÕES: aplica `data-tema` no <html> para o CSS global
 *   reagir via atributo — Shadow DOM dos outros componentes lê as mesmas variáveis.
 */

import { createStorage } from '../core/storage.js';

const storage = createStorage('local', 'tema:');

/** Canais de tema entre abas: o BroadcastChannel entrega só em outras abas. */
const canal = 'BroadcastChannel' in globalThis ? new BroadcastChannel('tema-troca') : null;

/**
 * Componente <theme-toggle>.
 *
 * Fluxo:
 * 1. Prioridade: valor salvo > prefers-color-scheme do sistema > 'light'.
 * 2. Clique alterna, grava no storage e aplica em `document.documentElement.dataset.tema`.
 * 3. Outras abas recebem o evento e aplicam sem salvar de novo (sem loop).
 */
export class ThemeToggle extends HTMLElement {
  /** @type {(() => void)|null} remove listener do matchMedia */
  #removerMedia = null;

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    if (!this.shadowRoot.childElementCount) {
      this.shadowRoot.innerHTML = `
        <style>
          button {
            display: inline-flex; align-items: center; gap: .45rem;
            font: 500 .875rem/1 system-ui, sans-serif;
            padding: .5rem .8rem; border-radius: 999px; cursor: pointer;
            border: 1px solid var(--cor-borda); background: var(--cor-fundo);
            color: var(--cor-texto);
          }
          button:hover { border-color: var(--cor-acento); }
          button:focus-visible { outline: 2px solid var(--cor-foco); outline-offset: 2px; }
          .icone { font-size: 1rem; }
        </style>
        <button type="button" aria-pressed="false">
          <span class="icone" aria-hidden="true">🌙</span>
          <span class="rotulo">Escuro</span>
        </button>
      `;
      this.shadowRoot.querySelector('button')?.addEventListener('click', () => this.#alternar());
    }

    // 1ª carga: storage → sistema
    const salvo = storage.get('modo');
    const sistema = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    this.#aplicar(salvo ?? sistema, { persistir: false });

    // Reage a mudanças do sistema enquanto não houver escolha manual
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      const aoMudar = (evento) => {
        if (storage.get('modo') === null) {
          this.#aplicar(evento.matches ? 'dark' : 'light', { persistir: false });
        }
      };
      media.addEventListener('change', aoMudar);
      this.#removerMedia = () => media.removeEventListener('change', aoMudar);
    }

    // Sincroniza entre abas do mesmo navegador
    canal?.addEventListener('message', (evento) => {
      this.#aplicar(evento.data?.modo, { persistir: false });
    });
  }

  disconnectedCallback() {
    this.#removerMedia?.();
    this.#removerMedia = null;
  }

  /** Alterna entre claro e escuro. */
  #alternar() {
    const atual = document.documentElement.dataset.tema === 'dark' ? 'light' : 'dark';
    this.#aplicar(atual, { persistir: true });
    canal?.postMessage({ modo: atual });
  }

  /**
   * Aplica o tema no documento, atualiza o botão e persiste.
   * @param {'light'|'dark'} modo tema a aplicar
   * @param {{ persistir: boolean }} opcoes gravar no storage?
   */
  #aplicar(modo, { persistir }) {
    if (modo !== 'light' && modo !== 'dark') return;
    document.documentElement.dataset.tema = modo;
    if (persistir) storage.set('modo', modo);

    const botao = this.shadowRoot?.querySelector('button');
    const icone = this.shadowRoot?.querySelector('.icone');
    const rotulo = this.shadowRoot?.querySelector('.rotulo');
    const escuro = modo === 'dark';
    if (botao) {
      botao.setAttribute('aria-pressed', String(escuro));
      botao.setAttribute('aria-label', escuro ? 'Ativar tema claro' : 'Ativar tema escuro');
    }
    if (icone) icone.textContent = escuro ? '☀️' : '🌙';
    if (rotulo) rotulo.textContent = escuro ? 'Claro' : 'Escuro';
  }
}

if (!customElements.get('theme-toggle')) {
  customElements.define('theme-toggle', ThemeToggle);
}
