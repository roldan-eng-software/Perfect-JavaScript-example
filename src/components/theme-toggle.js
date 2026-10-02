// @ts-check
/**
 * ARQUIVO: theme-toggle.js
 * PROPÓSITO: controle de tema com prioridade no CLARO — visitante escolhe entre
 *   Light (padrão), Dark e System; persiste e sincroniza entre abas.
 * CONCEITOS DEMONSTRADOS: Custom Elements, matchMedia (modo sistema), storage.js
 *   (persistência), BroadcastChannel (sync entre abas), dataset, aria-pressed.
 * USADO EM: header da landing (topo).
 * COMPLEXIDADE/OBSERVAÇÕES: `data-tema` no <html> aceita 'light' | 'dark' |
 *   'system'. ClarO é o default SEMPRE — escuro só por escolha explícita;
 *   'system' só escurece quando o SO estiver escuro (CSS via media query).
 */

import { createStorage } from '../core/storage.js';
import { onLangChange, SHELL, tr } from '../core/i18n.js';

const storage = createStorage('local', 'tema:');

/** Canais de tema entre abas: o BroadcastChannel entrega só em outras abas. */
const canal = 'BroadcastChannel' in globalThis ? new BroadcastChannel('tema-troca') : null;

/** Modos válidos, em ordem de ciclo do botão. Light é sempre o default. */
const MODOS = /** @type {const} */ (['light', 'dark', 'system']);

/** Ícone por modo (rótulo vem do dicionário i18n). */
const ICONES = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
};

/**
 * Componente <theme-toggle>: botão que cicla Light → Dark → System → Light.
 *
 * Prioridade de tema: claro é o modo padrão da landing; escuro e sistema são
 * opções que o visitante escolhe explicitamente. Nada de dark automático só
 * porque o SO do visitante está escuro.
 */
export class ThemeToggle extends HTMLElement {
  /** @type {(() => void)|null} remove listener do matchMedia */
  #removerMedia = null;

  /** @type {(() => void)|null} cancela assinatura de mudança de idioma */
  #removerIdioma = null;

  /** @type {'light'|'dark'|'system'} modo vigente (para re-render no idioma) */
  #modo = 'light';

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
        <button type="button">
          <span class="icone" aria-hidden="true">☀️</span>
          <span class="rotulo">Light</span>
        </button>
      `;
      this.shadowRoot.querySelector('button')?.addEventListener('click', () => this.#ciclar());
    }

    // Default explícito: CLARO. Só sai do claro se houver escolha salva.
    const salvo = storage.get('modo');
    const modo = MODOS.includes(salvo) ? salvo : 'light';
    this.#aplicar(modo, { persistir: false });

    // Modo 'system': reage ao SO enquanto o visitante mantiver essa opção
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      const aoMudar = () => {
        if (storage.get('modo') === 'system') {
          // CSS já reage via media query; aqui só garantimos consistência
          this.#atualizarBotao('system');
        }
      };
      media.addEventListener('change', aoMudar);
      this.#removerMedia = () => media.removeEventListener('change', aoMudar);
    }

    // Sincroniza entre abas do mesmo navegador
    canal?.addEventListener('message', (evento) => {
      if (MODOS.includes(evento.data?.modo)) {
        this.#aplicar(evento.data.modo, { persistir: false });
      }
    });

    // Rótulos no idioma ativo (padrão en-US)
    this.#removerIdioma = onLangChange(() => this.#atualizarBotao(this.#modo));
    this.#atualizarBotao(this.#modo);
  }

  disconnectedCallback() {
    this.#removerMedia?.();
    this.#removerMedia = null;
    this.#removerIdioma?.();
    this.#removerIdioma = null;
  }

  /** Cicla Light → Dark → System → Light (padrão: light). */
  #ciclar() {
    const atual = storage.get('modo') ?? 'light';
    const proximo = MODOS[(MODOS.indexOf(atual) + 1) % MODOS.length];
    this.#aplicar(proximo, { persistir: true });
    canal?.postMessage({ modo: proximo });
  }

  /**
   * Aplica o modo no documento, atualiza o botão e persiste.
   * @param {'light'|'dark'|'system'} modo modo de tema escolhido
   * @param {{ persistir: boolean }} opcoes gravar no storage?
   */
  #aplicar(modo, { persistir }) {
    if (!MODOS.includes(modo)) return;
    this.#modo = modo;
    document.documentElement.dataset.tema = modo;
    if (persistir) storage.set('modo', modo);
    this.#atualizarBotao(modo);
  }

  /**
   * Sincroniza ícone/rótulo/aria do botão com o modo ativo.
   * @param {'light'|'dark'|'system'} modo modo vigente
   */
  #atualizarBotao(modo) {
    const botao = this.shadowRoot?.querySelector('button');
    const icone = this.shadowRoot?.querySelector('.icone');
    const rotulo = this.shadowRoot?.querySelector('.rotulo');
    const nome = tr(SHELL, `theme.${modo}`);
    if (botao) {
      botao.setAttribute('aria-label', `Theme: ${nome}. Click to change.`);
      botao.setAttribute('title', `Theme: ${nome}`);
    }
    if (icone) icone.textContent = ICONES[modo];
    if (rotulo) rotulo.textContent = nome;
  }
}

if (!customElements.get('theme-toggle')) {
  customElements.define('theme-toggle', ThemeToggle);
}
