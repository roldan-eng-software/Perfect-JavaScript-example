// @ts-check
/**
 * ARQUIVO: store.js
 * PROPÓSITO: mini store reativa com pub/sub — estado central, previsível e testável.
 * CONCEITOS DEMONSTRADOS: closures, imutabilidade (spread/structuredClone),
 *   padrão Observer, selectors, separação estado/efeitos.
 * USADO EM: demo 05 (todo-list), persistência via storage.js, testes.
 * COMPLEXIDADE/OBSERVAÇÕES: sem Proxy aqui de propósito — a API explícita
 *   (getState/update/set/subscribe) torna os fluxos fáceis de depurar e testar;
 *   o Proxy reativo aparece na demo 05 como experimento separado.
 */

/**
 * Cria um store minimalista de estado único.
 *
 * Regras de imutabilidade: `update` recebe o estado atual e DEVE devolver um
 * novo objeto (nunca mutar); o store congela em profundidade antes de notificar,
 * garantindo que assinantes não alterem o estado por acidente.
 *
 * @param {object} estadoInicial valor inicial do estado
 * @returns {{
 *   getState: () => object,
 *   set: (novoEstado: object) => void,
 *   update: (mutacao: (estado: object) => object) => void,
 *   subscribe: (assinante: (estado: object) => void) => () => void,
 *   select: <T>(seletor: (estado: object) => T) => T,
 * }} API do store
 * @throws {TypeError} se `estadoInicial` não for objeto
 * @example
 * const store = createStore({ contador: 0 });
 * const remover = store.subscribe((s) => console.log(s.contador));
 * store.update((s) => ({ ...s, contador: s.contador + 1 })); // loga 1
 * remover(); // cancela assinatura
 */
export function createStore(estadoInicial) {
  if (estadoInicial === null || typeof estadoInicial !== 'object') {
    throw new TypeError('createStore: "estadoInicial" deve ser um objeto.');
  }

  let estado = estadoInicial;
  /** @type {Set<(estado: object) => void>} */
  const assinantes = new Set();

  /** Notifica todos os assinantes; um erro em um não derruba os demais. */
  function notificar() {
    for (const assinante of [...assinantes]) {
      try {
        assinante(estado);
      } catch (erro) {
        // Erro de UI não pode corromper o ciclo de notificação
        console.error('[store] erro em assinante:', erro);
      }
    }
  }

  return {
    /** Retorna o estado atual (congelado). */
    getState() {
      return estado;
    },

    /** Substitui o estado inteiro e notifica. */
    set(novoEstado) {
      if (novoEstado === null || typeof novoEstado !== 'object') {
        throw new TypeError('store.set: o novo estado deve ser um objeto.');
      }
      estado = Object.freeze({ ...novoEstado });
      notificar();
    },

    /**
     * Aplica uma mutação pura: recebe o estado e devolve um novo estado.
     * @param {(estado: object) => object} mutacao
     */
    update(mutacao) {
      if (typeof mutacao !== 'function') {
        throw new TypeError('store.update: "mutacao" deve ser uma função.');
      }
      const proximo = mutacao(estado);
      if (proximo === undefined || proximo === null || typeof proximo !== 'object') {
        throw new TypeError('store.update: a mutação deve retornar um novo objeto de estado.');
      }
      estado = Object.freeze({ ...proximo });
      notificar();
    },

    /**
     * Assina mudanças. Retorna função que cancela a assinatura.
     * @param {(estado: object) => void} assinante
     * @returns {() => void} cancelar
     */
    subscribe(assinante) {
      if (typeof assinante !== 'function') {
        throw new TypeError('store.subscribe: "assinante" deve ser uma função.');
      }
      assinantes.add(assinante);
      return () => assinantes.delete(assinante);
    },

    /**
     * Lê uma fatia do estado com um seletor (memória de leitura clara).
     * @template T
     * @param {(estado: object) => T} seletor
     * @returns {T}
     */
    select(seletor) {
      return seletor(estado);
    },
  };
}
