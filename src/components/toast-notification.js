// @ts-check
/**
 * ARQUIVO: toast-notification.js
 * PROPÓSITO: notificação flotante acessível (aria-live) para feedback de ações.
 * CONCEITOS DEMONSTRADOS: Custom Elements, aria-live, Shadow DOM, timers com cleanup.
 * USADO EM: demos (sucesso/erro), main.js (avisos globais).
 * COMPLEXIDADE/OBSERVAÇÕES: fila única — novos toasts substituem o anterior,
 *   evitando acúmulo de banners que tapem o conteúdo.
 */

/**
 * Componente <toast-notification message="…" tone="info|success|error">.
 *
 * - `message`: texto exibido (sempre via textContent — seguro contra XSS)
 * - `tone`: tom visual (info | success | error)
 * - `duration`: ms antes de auto-ocultar (0 = permanece; padrão 4000)
 *
 * A região inteira é aria-live="polite" — leitores de tela anunciam o aviso
 * sem roubar o foco de quem está digitando.
 */
export class ToastNotification extends HTMLElement {
  /** @type {number|null} timer de auto-ocultação */
  #timer = null;

  static get observedAttributes() {
    return ['message', 'tone', 'duration'];
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    if (!this.shadowRoot.childElementCount) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            position: fixed; inset-block-start: 1rem; inset-inline: 0;
            display: flex; justify-content: center; z-index: 1000;
            pointer-events: none;
          }
          .toast {
            pointer-events: auto;
            max-width: min(92vw, 28rem);
            padding: .7rem 1.1rem; border-radius: 8px;
            font: 500 .9rem/1.45 system-ui, sans-serif;
            color: #fff; background: var(--toast-bg, #1f6feb);
            box-shadow: 0 4px 16px rgb(0 0 0 / .25);
            animation: entrar .18s ease-out;
          }
          .toast[data-tone='success'] { background: var(--toast-ok, #1a7f37); }
          .toast[data-tone='error']   { background: var(--toast-erro, #b62324); }
          @keyframes entrar { from { opacity: 0; transform: translateY(-8px); } }
          /* Respeita quem pediu menos animação */
          @media (prefers-reduced-motion: reduce) {
            .toast { animation: none; }
          }
        </style>
        <div class="toast" role="status" aria-live="polite"></div>
      `;
    }
    this.#atualizar();
  }

  disconnectedCallback() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#atualizar();
  }

  /** Aplica atributos ao nó interno e agenda o auto-ocultar. */
  #atualizar() {
    const no = this.shadowRoot?.querySelector('.toast');
    if (!no) return;

    no.setAttribute('data-tone', this.getAttribute('tone') ?? 'info');
    // textContent: mensagem vinda do atributo nunca é interpretada como HTML
    no.textContent = this.getAttribute('message') ?? '';

    if (this.#timer !== null) clearTimeout(this.#timer);
    const duracao = Number(this.getAttribute('duration') ?? '4000');
    if (duracao > 0) {
      this.#timer = setTimeout(() => this.remove(), duracao);
    }
  }
}

/**
 * Atalho para mostrar um toast sem montar elemento manualmente.
 * Cria, anexa ao body e remove após a duração.
 *
 * @param {string} message mensagem exibida
 * @param {'info'|'success'|'error'} [tone] tom visual
 * @param {number} [duration] ms visível (0 = não some)
 * @returns {ToastNotification} o elemento criado (pode ser removido manualmente)
 * @example
 * showToast('Item salvo!', 'success');
 */
export function showToast(message, tone = 'info', duration = 4000) {
  // Remove toasts anteriores para não empilhar
  document.querySelectorAll('toast-notification').forEach((t) => t.remove());
  const toast = document.createElement('toast-notification');
  toast.setAttribute('message', message);
  toast.setAttribute('tone', tone);
  toast.setAttribute('duration', String(duration));
  document.body.append(toast);
  return toast;
}

if (!customElements.get('toast-notification')) {
  customElements.define('toast-notification', ToastNotification);
}
