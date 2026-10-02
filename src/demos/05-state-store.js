// @ts-check
/**
 * ARQUIVO: 05-state-store.js
 * PROPÓSITO: gerenciar estado de uma todo-list com mini store (pub/sub),
 *   imutabilidade (spread + deepClone), persistência em localStorage com
 *   fallback e um painel extra de reatividade com Proxy + WeakMap.
 * CONCEITOS DEMONSTRADOS: createStore (subscribe/update/select), imutabilidade,
 *   structuredClone/deepClone, createStorage com try/catch, Proxy com
 *   Reflect.get/Reflect.set, WeakMap para dados privados, delegação de eventos.
 * USADO EM: seção 05 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: retorna cleanup que cancela a assinatura do store,
 *   limpa timers de feedback e remove listeners.
 */
import { h, delegate, renderList } from '../core/dom.js';
import { createStore } from '../core/store.js';
import { createStorage } from '../core/storage.js';
import { deepClone } from '../utils/deep-clone.js';

/**
 * Inicializa a demo de estado, pub/sub e reatividade (todo-list).
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — cancela assinatura, timers e listeners
 * @example
 * const cleanup = init(document.querySelector('#demo05'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];

  /**
   * @typedef {object} ItemTodo
   * @property {number} id identificador único (sobrevive à persistência)
   * @property {string} texto rótulo do item
   * @property {boolean} feito true quando concluído
   */

  // ── 1. Store: estado único com pub/sub ─────────────────────────────────────
  // O que é: store guarda um estado imutável e notifica assinantes (padrão
  // Observer). Por que usei aqui: a UI inteira deriva do estado — sem sincronizar
  // variáveis soltas entre input, lista, contador e JSON preview.
  const store = createStore(/** @type {{ itens: ItemTodo[] }} */ ({ itens: [] }));

  // ── 2. Persistência: storage com fallback em memória ──────────────────────
  // O que é: wrapper de localStorage com try/catch (Safari privado/quota cheia
  // lançam erro). Por que usei aqui: a lista sobrevive ao reload sem quebrar a
  // demo quando o navegador bloqueia o storage.
  const storage = createStorage('local', 'todo:');
  let proximoId = 1;

  /**
   * Carrega os itens salvos com try/catch e fallback vazio — dado corrompido
   * ou storage bloqueado nunca derruba a inicialização.
   *
   * @returns {ItemTodo[]} itens válidos encontrados no storage (ou [])
   */
  function carregarItensSalvos() {
    try {
      const brutos = storage.get('itens', []);
      if (!Array.isArray(brutos)) return [];
      const validos = brutos.filter(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.id === 'number' &&
          typeof item.texto === 'string' &&
          typeof item.feito === 'boolean',
      );
      // Próximo id nunca reutiliza um id já existente (evita colisão de chave)
      proximoId = validos.reduce((maior, item) => Math.max(maior, item.id + 1), 1);
      return validos;
    } catch (erro) {
      console.warn('[demo05] falha ao carregar itens salvos:', erro);
      return [];
    }
  }

  store.set({ itens: carregarItensSalvos() });

  // ── 3. UI: input + botão para adicionar ───────────────────────────────────
  const entradaTexto = h('input', {
    type: 'text',
    placeholder: 'O que precisa ser feito?',
    'aria-label': 'Texto da nova tarefa',
    autocomplete: 'off',
  });

  const lista = h('ul', { class: 'lista-tarefas', 'aria-label': 'Tarefas' });
  const contador = h('output', { 'aria-live': 'polite' });
  const previaEstado = h('pre', {
    class: 'previa-estado',
    style: 'max-height: 16rem; overflow: auto;',
    'aria-live': 'off',
  });
  const statusPersistencia = h('output', { class: 'nota', 'aria-live': 'polite' });

  const formulario = h(
    'form',
    {
      class: 'linha',
      on: {
        submit: (evento) => {
          evento.preventDefault();
          adicionarItem();
        },
      },
    },
    entradaTexto,
    h('button', { type: 'submit', text: 'Adicionar' }),
  );

  /**
   * Adiciona um novo item ao store — sempre via update imutável (spread).
   * Imutabilidade: devolvemos um NOVO estado; nunca mutamos o anterior.
   */
  function adicionarItem() {
    const texto = entradaTexto.value.trim();
    if (texto === '') return;
    store.update((estado) => ({
      ...estado,
      itens: [...estado.itens, { id: proximoId++, texto, feito: false }],
    }));
    entradaTexto.value = '';
    entradaTexto.focus();
  }

  // ── 4. Ações imutáveis: alternar e remover ────────────────────────────────
  /** Alterna `feito` com map (cria novo array só com o item alterado). */
  function alternarItem(id) {
    store.update((estado) => ({
      ...estado,
      itens: estado.itens.map((item) => (item.id === id ? { ...item, feito: !item.feito } : item)),
    }));
  }

  /** Remove o item filtrando-o para fora do novo array. */
  function removerItem(id) {
    store.update((estado) => ({
      ...estado,
      itens: estado.itens.filter((item) => item.id !== id),
    }));
  }

  /**
   * Duplica a lista com deepClone (cópia profunda) e re-identifica cada cópia:
   * sem deepClone, cópias de estruturas aninhadas compartilhariam referências.
   */
  function duplicarLista() {
    store.update((estado) => {
      const copia = deepClone(estado.itens);
      const copias = copia.map((item) => ({
        ...item,
        id: proximoId++,
        texto: `${item.texto} (cópia)`,
      }));
      return { ...estado, itens: [...estado.itens, ...copias] };
    });
  }

  // ── 5. Render: assinante único re-renderiza tudo a cada mudança ───────────
  /** Seletores: leituras pontuais do estado (memória de leitura clara). */
  const selecionarConclusao = (estado) => ({
    feitos: estado.itens.filter((item) => item.feito).length,
    total: estado.itens.length,
  });

  let timerStatus = 0;

  /**
   * Renderiza lista + contador + preview JSON e persiste o estado.
   * Roda a cada notificação do store (pub/sub) — a UI nunca "adivinha" o estado.
   *
   * @param {{ itens: ItemTodo[] }} estado estado atual (congelado) do store
   */
  function renderizar(estado) {
    // DocumentFragment: monta fora da árvore e anexa uma vez (1 reflow)
    renderList(lista, estado.itens, (item) =>
      h(
        'li',
        { class: item.feito ? 'item feito' : 'item', dataset: { id: String(item.id) } },
        h('input', {
          type: 'checkbox',
          checked: item.feito || undefined,
          'aria-label': `Concluir: ${item.texto}`,
        }),
        h('span', { text: item.texto }),
        h('button', {
          type: 'button',
          class: 'remover',
          dataset: { act: 'remover' },
          'aria-label': `Remover: ${item.texto}`,
          text: '✕',
        }),
      ),
    );

    const { feitos, total } = store.select(selecionarConclusao);
    contador.textContent = `${feitos} de ${total} concluídos`;

    // textContent: dado dinâmico NUNCA passa por innerHTML
    previaEstado.textContent = JSON.stringify(estado, null, 2);

    // Persistência: salva a cada mudança; feedback "✓ salvo" expira sozinho
    storage.set('itens', estado.itens);
    statusPersistencia.textContent = storage.usandoMemoria()
      ? 'storage bloqueado — usando memória (não persiste entre reloads)'
      : `✓ salvo às ${new Date().toLocaleTimeString('pt-BR')}`;
    clearTimeout(timerStatus);
    timerStatus = setTimeout(() => {
      statusPersistencia.textContent = '';
    }, 2500);
  }

  // subscribe: um único ponto reativo notifica render + persistência
  const cancelarInscricao = store.subscribe(renderizar);

  // Delegação: 1 listener no <ul> atende checkboxes/botões mesmo após re-render
  remocoes.push(
    delegate(lista, 'change', 'input[type="checkbox"]', (_evento, alvo) => {
      const id = alvo.closest('[data-id]')?.getAttribute('data-id');
      if (id) alternarItem(Number(id));
    }),
  );
  remocoes.push(
    delegate(lista, 'click', 'button[data-act="remover"]', (_evento, alvo) => {
      const id = alvo.closest('[data-id]')?.getAttribute('data-id');
      if (id) removerItem(Number(id));
    }),
  );

  /** Limpa apenas as chaves do prefixo 'todo:' (a lista atual segue na tela). */
  function limparDadosSalvos() {
    storage.clear();
    statusPersistencia.textContent =
      'dados salvos removidos — a lista atual continua até a próxima alteração';
  }

  const painelLista = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Todo-list com store (pub/sub + imutabilidade)' }),
    formulario,
    lista,
    h('div', { class: 'botoes' }, contador),
    h(
      'div',
      { class: 'botoes' },
      h('button', { type: 'button', text: 'Duplicar lista', on: { click: duplicarLista } }),
      h('button', {
        type: 'button',
        text: 'Limpar dados salvos',
        on: { click: limparDadosSalvos },
      }),
      statusPersistencia,
    ),
    h('p', {
      class: 'nota',
      text: 'Toda mutação usa spread/map/filter (estado novo, nunca editado) e o assinante do store re-renderiza a lista.',
    }),
  );

  const painelEstado = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Estado atual (JSON via textContent)' }),
    previaEstado,
    h('p', {
      class: 'nota',
      text: 'O store congela o estado (Object.freeze) antes de notificar: assinantes leem, mas não alteram por acidente.',
    }),
  );

  // ── 6. Painel Proxy: reatividade interceptando get/set ────────────────────
  // O que é: Proxy intercepta operações em um objeto (get/set) e o Reflect
  // executa a operação original preservando prototype/receiver. Por que usei
  // aqui: mostrar a base da reatividade de frameworks (Vue 3 usa Proxy assim).
  const saidaProxy = h('ul', { class: 'lista-proxy', 'aria-live': 'polite' });
  const alvo = { contador: 0, ultimo: null };

  /** @type {(linha: string) => void} */
  let registrar = () => {};

  const reativo = new Proxy(alvo, {
    get(objeto, prop, receptor) {
      const valor = Reflect.get(objeto, prop, receptor);
      registrar(`get ${String(prop)} → ${JSON.stringify(valor)}`);
      return valor;
    },
    set(objeto, prop, valor, receptor) {
      const ok = Reflect.set(objeto, prop, valor, receptor);
      registrar(`set ${String(prop)} = ${JSON.stringify(valor)}`);
      return ok;
    },
  });

  /**
   * O que é: WeakMap guarda pares chave→valor só com chaves OBJETO, e elas são
   * fracas (coletadas pelo GC quando sem referência). Por que usei aqui: é a
   * forma "à moda antiga" de dados privados, comparada com os campos #.
   */
  const dadosPrivados = new WeakMap();
  const sujeito = { nome: 'contador-fraco' };
  dadosPrivados.set(sujeito, { flag: true });

  registrar = (linha) => {
    saidaProxy.append(h('li', { text: linha }));
  };

  function exercitarProxy() {
    // Cada leitura/escrita passa pelos traps e vira uma linha no log
    reativo.contador = reativo.contador + 1;
    reativo.ultimo = `acesso em ${new Date().toLocaleTimeString('pt-BR')}`;
    const temPrivado = dadosPrivados.has(sujeito);
    const privado = dadosPrivados.get(sujeito);
    registrar(
      `WeakMap: tem=${temPrivado} flag=${String(privado?.flag)} · ` +
        `Object.keys não expõe: ${JSON.stringify(Object.keys(dadosPrivados.get(sujeito) ?? {}))}`,
    );
  }

  const painelProxy = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Proxy: traps de get/set + WeakMap privado' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: 'Ler/escrever via Proxy',
        on: { click: exercitarProxy },
      }),
    ),
    saidaProxy,
    h('p', {
      class: 'nota',
      text: 'Reflect.get/Reflect.set mantêm o comportamento original; o WeakMap guarda a flag sem vazar nas chaves do objeto.',
    }),
  );

  container.append(painelLista, painelEstado, painelProxy);

  // Render inicial (o store já notificou no set() acima, mas garantimos estado)
  renderizar(store.getState());

  // Cleanup: assinante removido (update posterior não re-renderiza),
  // timers de feedback limpos e listeners de delegação removidos.
  return () => {
    cancelarInscricao();
    clearTimeout(timerStatus);
    for (const remover of remocoes) remover();
  };
}
