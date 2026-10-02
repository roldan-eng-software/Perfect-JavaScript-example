// @ts-check
/**
 * ARQUIVO: code-peek.js
 * PROPÓSITO: exibir o código-fonte REAL de um módulo do repositório, com realce
 *   próprio, numeração de linhas e botão copiar.
 * CONCEITOS DEMONSTRADOS: Custom Elements, Shadow DOM, <slot>, fetch + import.meta.url,
 *   Clipboard API, aria-live, estados loading/erro, tokenizador puro (utils/highlight).
 * USADO EM: todas as seções da landing page.
 * COMPLEXIDADE/OBSERVAÇÕES: o fetch usa caminho relativo ao módulo via import.meta.url,
 *   então funciona em qualquer profundidade de URL (GitHub Pages incluído). Se o
 *   arquivo foi aberto por file://, o fetch falha por política do navegador —
 *   exibimos orientação amigável em vez de erro crú.
 */
import { tokenizeJs, renderTokens } from '../utils/highlight.js';
import { onLangChange, SHELL, tr } from '../core/i18n.js';

/** Classes CSS por tipo de token (herdadas do :host via variáveis). */
const TOKEN_CLASSES = {
  comment: 'tk-comment',
  string: 'tk-string',
  template: 'tk-string',
  number: 'tk-number',
  keyword: 'tk-keyword',
  operator: 'tk-operator',
  ident: 'tk-ident',
};

/**
 * Resolve o `src` declarado em relação à raiz do projeto.
 * O componente vive em /src/components/, então a raiz é dois níveis acima.
 *
 * @param {string} src caminho relativo à raiz (ex.: 'src/demos/01-closures-hof.js')
 * @returns {string} URL absoluta do arquivo
 * @example
 * resolverSrc('src/core/dom.js'); // http://…/src/core/dom.js
 */
function resolverSrc(src) {
  return new URL(`../../${src}`, import.meta.url).href;
}

/**
 * Componente <code-peek src="…" title="…">.
 *
 * Atributos:
 * - `src`: caminho do arquivo (relativo à raiz do projeto)
 * - `title`: título exibido no cabeçalho
 * - `start`: número da primeira linha exibida (padrão 1)
 *
 * Estados acessíveis: região aria-live anuncia carregando/erro/copiado.
 */
export class CodePeek extends HTMLElement {
  /** @type {AbortController|null} cancela o fetch se o elemento for removido */
  #abortar = null;

  /** @type {IntersectionObserver|null} */
  #observer = null;

  /** @type {string|null} fonte carregada (para o botão copiar) */
  #fonte = null;

  /** @type {(() => void)|null} cancela a assinatura de mudança de idioma */
  #removerIdioma = null;

  constructor() {
    super();
    // Shadow DOM: estilos do código não vazam para a página e vice-versa
    this.attachShadow({ mode: 'open' });
  }

  /** Lê atributos observados. */
  static get observedAttributes() {
    return ['src', 'title', 'start'];
  }

  /** Renderiza a estrutura inicial + estilos. */
  connectedCallback() {
    this.#renderizarEstrutura();
    this.#carregar();
  }

  /** Cancela fetch, observers e assinatura de idioma (sem vazamento). */
  disconnectedCallback() {
    this.#abortar?.abort();
    this.#abortar = null;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#removerIdioma?.();
    this.#removerIdioma = null;
  }

  /**
   * Reage a mudanças de atributo (ex.: troca de código em demos dinâmicas).
   * @param {string} nome atributo alterado
   */
  attributeChangedCallback(nome) {
    if (nome === 'src' && this.isConnected) this.#carregar();
  }

  /** Monta o Shadow DOM com estilos encapsulados. */
  #renderizarEstrutura() {
    if (!this.shadowRoot || this.shadowRoot.childElementCount > 0) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; margin-block: 1rem; }
        * { box-sizing: border-box; }
        .caixa {
          border: 1px solid var(--cor-borda, #d0d7de);
          border-radius: 8px;
          overflow: hidden;
          background: var(--cor-fundo-codigo, #f6f8fa);
        }
        header {
          display: flex; align-items: center; justify-content: space-between;
          gap: .5rem; padding: .5rem .75rem;
          background: var(--cor-cabecalho, #eaeef2);
          font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
          border-bottom: 1px solid var(--cor-borda, #d0d7de);
        }
        .caminho { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        button {
          font: inherit; cursor: pointer; padding: .25rem .6rem;
          border: 1px solid var(--cor-borda, #d0d7de); border-radius: 6px;
          background: var(--cor-fundo, #fff);
          color: inherit;
        }
        button:focus-visible { outline: 2px solid var(--cor-foco, #0969da); outline-offset: 2px; }
        .corpo { position: relative; max-height: 26rem; overflow: auto; }
        pre {
          margin: 0; padding: .75rem; overflow-x: auto;
          font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        code { display: block; }
        .linha { display: block; }
        .num {
          display: inline-block; width: 3ch; margin-right: 1ch;
          text-align: right; color: var(--cor-num, #8b949e);
          user-select: none;
        }
        .tk-comment { color: var(--tk-comentario, #6e7781); font-style: italic; }
        .tk-string  { color: var(--tk-string, #0a3069); }
        .tk-number  { color: var(--tk-numero, #0550ae); }
        .tk-keyword { color: var(--tk-palavra, #cf222e); font-weight: 600; }
        .tk-operator{ color: var(--tk-operador, #0550ae); }
        .tk-ident   { color: var(--tk-ident, #1f2328); }
        .status { padding: 1.5rem .75rem; text-align: center; font-size: .875rem; }
        .erro { color: var(--cor-erro, #b62324); }
        /* Tema: só via variáveis --tk-* do documento (light é padrão;
           dark/sistema aplicados por data-tema no <html>) */
      </style>
      <div class="caixa">
        <header>
          <span class="caminho" title=""></span>
          <button type="button" part="botao" aria-label="Copy code">Copy</button>
        </header>
        <div class="corpo" role="region" aria-label="Source code" tabindex="0">
          <div class="status" role="status" aria-live="polite">Loading code…</div>
        </div>
      </div>
    `;

    // Título via textContent: dado do atributo nunca entra como HTML
    const caminho = this.shadowRoot.querySelector('.caminho');
    const titulo = this.getAttribute('title') ?? 'code';
    if (caminho) {
      caminho.textContent = titulo;
      caminho.title = this.getAttribute('src') ?? titulo;
    }

    // Listener único do botão copiar (carregamento pode repetir sem duplicar)
    this.shadowRoot.querySelector('button')?.addEventListener('click', () => {
      if (this.#fonte !== null) void this.#copiar(this.#fonte);
    });

    // Idioma: atualiza rótulos do cabeçalho quando en-US ↔ pt-BR
    this.#removerIdioma = onLangChange(() => this.#atualizarRotulos());
    // Rótulos já nascem no idioma salvo (aplicarTraducoes não penetra shadowRoot)
    this.#atualizarRotulos();
    this.#observer = new IntersectionObserver(
      (entradas) => {
        // Lazy: só busca o código quando a seção se aproxima da viewport
        if (entradas.some((e) => e.isIntersecting)) {
          this.#carregar();
          this.#observer?.disconnect();
          this.#observer = null;
        }
      },
      { rootMargin: '200px' },
    );
    this.#observer.observe(this);
  }

  /** Busca o código-fonte (com abort) e o renderiza. */
  async #carregar() {
    const src = this.getAttribute('src');
    if (!src) return;
    const corpo = this.shadowRoot?.querySelector('.corpo');
    if (!corpo) return;

    // Evita dupla carga (connectedCallback + attributeChangedCallback)
    this.#abortar?.abort();
    this.#abortar = new AbortController();
    const { signal } = this.#abortar;

    corpo.innerHTML = `<div class="status" role="status" aria-live="polite">${tr(SHELL, 'peek.loading')}</div>`;

    try {
      const resposta = await fetch(resolverSrc(src), { signal });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const fonte = await resposta.text();
      if (signal.aborted) return;
      this.#montarCodigo(fonte, corpo);
    } catch (erro) {
      if (signal.aborted || erro?.name === 'AbortError') return;
      this.#montarErro(src, corpo);
    }
  }

  /**
   * Renderiza o código tokenizado com linhas numeradas.
   * @param {string} fonte código completo do arquivo
   * @param {HTMLElement} corpo elemento de destino
   */
  #montarCodigo(fonte, corpo) {
    const tokens = tokenizeJs(fonte);
    const htmlCodigo = renderTokens(tokens, TOKEN_CLASSES);
    const inicio = Number(this.getAttribute('start') ?? '1');
    const linhas = htmlCodigo.split('\n');

    // Construção via template + textContent nos números: sem innerHTML com dados
    // dinâmicos — o HTML do realce só contém entidades já escapadas pelo renderTokens.
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    linhas.forEach((linhaHtml, i) => {
      const span = document.createElement('span');
      span.className = 'linha';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(inicio + i);
      span.append(num);
      // linhaHtml é HTML seguro gerado por renderTokens (escapado)
      span.insertAdjacentHTML('beforeend', linhaHtml || ' ');
      code.append(span);
    });
    pre.append(code);

    corpo.replaceChildren(pre);
    this.#fonte = fonte;
  }

  /**
   * Monta o estado de erro amigável (file://, 404, offline).
   * @param {string} src caminho que falhou
   * @param {HTMLElement} corpo elemento de destino
   */
  #montarErro(src, corpo) {
    const aviso = document.createElement('div');
    aviso.className = 'status erro';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    // textContent com chave i18n: mensagem amigável no idioma ativo
    aviso.textContent = tr(SHELL, 'peek.error', { src });
    corpo.replaceChildren(aviso);
  }

  /**
   * Copia o código para a área de transferência com feedback aria-live.
   * @param {string} fonte código completo
   */
  async #copiar(fonte) {
    const botao = this.shadowRoot?.querySelector('button');
    try {
      await navigator.clipboard.writeText(fonte);
      if (botao) botao.textContent = tr(SHELL, 'peek.copied');
    } catch {
      // Clipboard API exige contexto seguro; fallback: seleção manual
      if (botao) botao.textContent = tr(SHELL, 'peek.copyFail');
    }
    setTimeout(() => {
      if (botao) botao.textContent = tr(SHELL, 'peek.copy');
    }, 2000);
  }

  /** Reaplica rótulos (botão, aria, status) após troca de idioma. */
  #atualizarRotulos() {
    const botao = this.shadowRoot?.querySelector('button');
    const corpo = this.shadowRoot?.querySelector('.corpo');
    if (botao && !/^Cop|Copy/i.test(botao.textContent ?? '')) {
      // botão em estado de feedback ('Copiado!') — só o aria-label muda
      botao.setAttribute('aria-label', tr(SHELL, 'peek.copy'));
    } else if (botao) {
      botao.textContent = tr(SHELL, 'peek.copy');
      botao.setAttribute('aria-label', tr(SHELL, 'peek.copy'));
    }
    // Status de loading/erro visível: re-renderiza no novo idioma
    const status = corpo?.querySelector('.status');
    if (status && this.#fonte === null) {
      if (status.classList.contains('erro')) {
        const src = this.getAttribute('src');
        if (src) status.textContent = tr(SHELL, 'peek.error', { src });
      } else {
        status.textContent = tr(SHELL, 'peek.loading');
      }
    }
  }
}

// Registra o elemento apenas uma vez (import dinâmico pode repetir o módulo)
if (!customElements.get('code-peek')) {
  customElements.define('code-peek', CodePeek);
}
