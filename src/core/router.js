// @ts-check
/**
 * ARQUIVO: router.js
 * PROPÓSITO: roteamento leve por hash (#/secao) com suporte opcional à History API.
 * CONCEITOS DEMONSTRADOS: hashchange, pushState/popstate, pub/sub, feature detection.
 * USADO EM: main.js — navegação entre seções da landing, scroll spy e deep links.
 * COMPLEXIDADE/OBSERVAÇÕES: hash-first porque o GitHub Pages não permite rewrite
 *   de rotas no servidor; History API fica disponível via `navigate()` para
 *   atualizar a URL sem recarregar (demonstrado na demo 13).
 */

/**
 * Cria um roteador por hash.
 *
 * @param {object} [opcoes]
 * @param {(rota: string, info: { hash: string }) => void} [opcoes.onRota] callback a cada rota
 * @param {string} [opcoes.rotaPadrao] rota usada quando não há hash (padrão '/')
 * @returns {{
 *   iniciar: () => string,
 *   navigate: (rota: string, opcoes?: { replace?: boolean }) => void,
 *   getRota: () => string,
 *   destroy: () => void,
 * }} API do roteador
 * @example
 * const router = createRouter({ onRota: (rota) => mostrarSecao(rota) });
 * router.iniciar();          // dispara rota atual
 * router.navigate('/demo01'); // URL vira #/demo01
 */
export function createRouter({ onRota, rotaPadrao = '/' } = {}) {
  let rotaAtual = rotaPadrao;

  /** Normaliza o hash para rota: '#/demo01?x' → '/demo01'. */
  function lerRotaDoHash() {
    const bruto = location.hash.replace(/^#/, '');
    if (bruto === '' || bruto === '/') return rotaPadrao;
    // Remove query string da rota, mantendo-a disponível via URLSearchParams na demo 13
    return bruto.split('?')[0] || rotaPadrao;
  }

  function aoMudarHash() {
    rotaAtual = lerRotaDoHash();
    onRota?.(rotaAtual, { hash: location.hash });
  }

  return {
    /** Liga os listeners e dispara a rota atual. @returns {string} rota inicial */
    iniciar() {
      globalThis.addEventListener('hashchange', aoMudarHash);
      aoMudarHash();
      return rotaAtual;
    },

    /**
     * Navega para uma rota.
     * @param {string} rota ex.: '/demo04'
     * @param {{ replace?: boolean }} [opcoes] replace não empilha no histórico
     */
    navigate(rota, { replace = false } = {}) {
      const destino = rota.startsWith('/') ? rota : `/${rota}`;
      const hash = `#${destino}`;
      if (replace && 'history' in globalThis) {
        // replaceState não dispara hashchange → notificamos manualmente
        history.replaceState(null, '', hash);
        rotaAtual = destino;
        onRota?.(rotaAtual, { hash });
      } else {
        location.hash = hash; // dispara hashchange naturalmente
      }
    },

    /** @returns {string} rota atual */
    getRota() {
      return rotaAtual;
    },

    /** Remove listeners (cleanup). */
    destroy() {
      globalThis.removeEventListener('hashchange', aoMudarHash);
    },
  };
}
