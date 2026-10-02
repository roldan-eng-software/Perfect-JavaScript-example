// @ts-check
/**
 * ARQUIVO: storage.js
 * PROPÓSITO: wrapper seguro de localStorage/sessionStorage com fallback em memória.
 * CONCEITOS DEMONSTRADOS: try/catch defensivo, JSON, feature detection,
 *   tratamento de quota exceeded, storage events.
 * USADO EM: tema (demo hero), demo 05 (persistência da todo-list), demo 10/11.
 * COMPLEXIDADE/OBSERVAÇÕES: Safari private mode lança SecurityError ao ACCESSAR
 *   localStorage; por isso o try/catch envolve até a detecção, e o fallback
 *   em memória mantém a API idêntica (sem if espalhado pela aplicação).
 */

/**
 * Cria um cliente de storage. Usa o storage real quando disponível;
 * cai para um Map em memória quando o navegador bloqueia (private mode,
 * quota cheia, política de privacidade).
 *
 * @param {'local'|'session'} [tipo] 'local' (persiste) ou 'session' (só na aba)
 * @param {string} [prefixo] prefixo das chaves (padrão: 'pje:')
 * @returns {{
 *   get: <T>(chave: string, padrao?: T) => T,
 *   set: (chave: string, valor: any) => boolean,
 *   remove: (chave: string) => void,
 *   clear: () => void,
 *   usandoMemoria: () => boolean,
 * }} API do storage
 * @example
 * const storage = createStorage('local', 'tema:');
 * storage.set('modo', 'dark');
 * storage.get('modo', 'light'); // 'dark'
 */
export function createStorage(tipo = 'local', prefixo = 'pje:') {
  /** @type {Storage|null} */
  let backend = null;
  try {
    backend = tipo === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
    // Teste real de acesso: Safari privado lança aqui, não na escrita
    const chaveTeste = `${prefixo}__teste__`;
    backend.setItem(chaveTeste, '1');
    backend.removeItem(chaveTeste);
  } catch {
    backend = null; // sem storage real → fallback em memória
  }

  // Fallback: Map em memória com a mesma interface
  const memoria = new Map();

  /** @type {Map<string, (evento: StorageEvent) => void>} */
  const ouvintes = new Map();

  /** @type {(evento: StorageEvent) => void} */
  const noStorageEvent = (evento) => {
    if (evento.key === null || !evento.key.startsWith(prefixo)) return;
    const chave = evento.key.slice(prefixo.length);
    ouvintes.get(chave)?.(evento);
  };
  if (backend && typeof globalThis.addEventListener === 'function') {
    // Dispara em OUTRAS abas: útil para sincronizar tema/lista
    globalThis.addEventListener('storage', noStorageEvent);
  }

  return {
    /**
     * Lê e desserializa um valor; devolve `padrao` se ausente/corrompido.
     * @template T
     * @param {string} chave
     * @param {T} [padrao] valor de retorno quando não há dado
     * @returns {T}
     */
    get(chave, padrao = undefined) {
      const bruto = backend ? backend.getItem(prefixo + chave) : memoria.get(chave);
      if (bruto === null || bruto === undefined) return padrao;
      try {
        return JSON.parse(bruto);
      } catch {
        // Dado corrompido (escrito por versão antiga/outra pessoa): descarta
        return padrao;
      }
    },

    /**
     * Serializa e grava um valor.
     * @param {string} chave
     * @param {any} valor serializável em JSON
     * @returns {boolean} true se gravou; false se falhou (quota/cota)
     */
    set(chave, valor) {
      const bruto = JSON.stringify(valor);
      try {
        if (backend) backend.setItem(prefixo + chave, bruto);
        else memoria.set(chave, bruto);
        return true;
      } catch (erro) {
        // QuotaExceededError em disco cheio — app continua funcionando
        console.warn(`[storage] falha ao gravar "${chave}":`, erro);
        return false;
      }
    },

    /** Remove uma chave. */
    remove(chave) {
      try {
        if (backend) backend.removeItem(prefixo + chave);
        memoria.delete(chave);
      } catch (erro) {
        console.warn(`[storage] falha ao remover "${chave}":`, erro);
      }
    },

    /** Limpa apenas as chaves deste prefixo (não apaga dados de outros apps). */
    clear() {
      try {
        if (backend) {
          const alvos = [];
          for (let i = 0; i < backend.length; i++) {
            const chave = backend.key(i);
            if (chave?.startsWith(prefixo)) alvos.push(chave);
          }
          for (const chave of alvos) backend.removeItem(chave);
        }
        memoria.clear();
      } catch (erro) {
        console.warn('[storage] falha ao limpar:', erro);
      }
    },

    /** true quando rodando no fallback em memória (sem persistência real). */
    usandoMemoria() {
      return backend === null;
    },
  };
}
