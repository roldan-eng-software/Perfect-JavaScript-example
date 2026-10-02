// @ts-check
/**
 * ARQUIVO: 04-dom-observers.js
 * PROPÓSITO: demonstrar os observers do navegador (Intersection/Resize/Mutation)
 *   e rendering eficiente de listas grandes com DocumentFragment (renderList).
 * CONCEITOS DEMONSTRADOS: IntersectionObserver + scroll-spy, ResizeObserver,
 *   MutationObserver, DocumentFragment, performance.mark/measure, feature detection.
 * USADO EM: seção 04 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: o cleanup desconecta TODOS os observers (inclusive o
 *   2º IntersectionObserver do scroll-spy), cancela o rAF pendente e remove os
 *   listeners criados com on() — listeners só em document/window/componentes
 *   sobreviveriam ao container.
 */
import { h, on, renderList } from '../core/dom.js';
import { tr } from '../core/i18n.js';

/** Dicionário de strings da demo — tr() lê o idioma ativo em tempo de render. */
const STRINGS = {
  'en-US': {
    revealed: '{n}/{total} revealed',
    'revealed.noIO': '{n}/{total} revealed (no IO)',
    'section.t1': 'Introduction',
    'section.t2': 'How it works',
    'section.t3': 'Why it matters',
    'section.title': 'Section {n} — {titulo}',
    'card.text': 'Card {n} — role: {titulo}',
    'nav.aria': 'Box sections',
    'io.title': 'IntersectionObserver: reveal + scroll-spy',
    'io.note': 'IntersectionObserver unavailable: reveal/scroll-spy disabled.',
    'io.cardsNote':
      'Cards start with opacity:0 and gain .visivel + opacity:1 when crossing 50% of the box.',
    'resize.hint': 'drag the bottom-right corner ↘',
    'resize.unavailable': 'ResizeObserver unavailable in this browser.',
    'resize.title': 'ResizeObserver (no aria-live: high noise)',
    'size.label': 'size: ',
    'mutations.none': 'no mutations yet',
    'target.text': 'text in {tag}',
    'mutation.in': '{type} in {alvo}',
    'mutations.latest': 'latest: {lista}',
    'mutations.unavailable': 'MutationObserver unavailable in this browser.',
    'item.changed': 'Item 1 (changed {hora})',
    'btn.add': 'Add item',
    'btn.changeText': 'Change text',
    'render.none': 'nothing rendered yet',
    'render.result':
      '{qtd} items · performance.now(): {t1} ms · measure: {t2} ms (1 single DOM commit)',
    'fragment.title': 'DocumentFragment: renderList of 1000 items',
    'btn.render': 'Render 1000 items',
  },
  'pt-BR': {
    revealed: '{n}/{total} revelados',
    'revealed.noIO': '{n}/{total} revelados (sem IO)',
    'section.t1': 'Introdução',
    'section.t2': 'Como funciona',
    'section.t3': 'Por que importa',
    'section.title': 'Seção {n} — {titulo}',
    'card.text': 'Cartão {n} — role: {titulo}',
    'nav.aria': 'Seções da caixa',
    'io.title': 'IntersectionObserver: revelação + scroll-spy',
    'io.note': 'IntersectionObserver indisponível: revelação/scroll-spy desativados.',
    'io.cardsNote':
      'Cartões nascem com opacity:0 e ganham .visivel + opacity:1 ao cruzarem 50% da caixa.',
    'resize.hint': 'arraste a borda inferior direita ↘',
    'resize.unavailable': 'ResizeObserver indisponível neste navegador.',
    'resize.title': 'ResizeObserver (sem aria-live: alto ruído)',
    'size.label': 'tamanho: ',
    'mutations.none': 'sem mutações ainda',
    'target.text': 'text em {tag}',
    'mutation.in': '{type} em {alvo}',
    'mutations.latest': 'últimas: {lista}',
    'mutations.unavailable': 'MutationObserver indisponível neste navegador.',
    'item.changed': 'Item 1 (alterado {hora})',
    'btn.add': 'Adicionar item',
    'btn.changeText': 'Alterar texto',
    'render.none': 'nada renderizado ainda',
    'render.result':
      '{qtd} itens · performance.now(): {t1} ms · measure: {t2} ms (1 único commit de DOM)',
    'fragment.title': 'DocumentFragment: renderList de 1000 itens',
    'btn.render': 'Renderizar 1000 itens',
  },
};

/**
 * Inicializa a demo de observers e DOM eficiente.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — desconecta observers, cancela rAF
 *   e remove listeners criados com on()
 * @example
 * const cleanup = init(document.querySelector('#demo04'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];
  /** id do rAF que coalesce as atualizações de tamanho (cancelado no cleanup). */
  let rafTamanho = 0;

  // ── a) IntersectionObserver: revelação + scroll-spy ─────────────────────────
  // Feature detection: sem IO, degradamos revelando tudo e avisando o usuário.
  const temIO = 'IntersectionObserver' in window;
  const saidaRevelados = h('output', {
    'aria-live': 'polite',
    text: tr(STRINGS, 'revealed', { n: 0, total: 0 }),
  });

  // Caixa com rolagem própria (~200px) — o IO usa ela como "viewport raiz"
  const caixa = h('div', {
    style: 'height:200px;overflow:auto;border:1px solid #555;border-radius:6px;padding:.5rem',
  });

  const TITULOS = [tr(STRINGS, 'section.t1'), tr(STRINGS, 'section.t2'), tr(STRINGS, 'section.t3')];
  /** @type {HTMLElement[]} seções dentro da caixa (alvos do scroll-spy) */
  const secoes = [];
  /** @type {HTMLElement[]} cartões observados (alvos da revelação) */
  const cartoes = [];
  /** @type {HTMLElement[]} links da nav (destaque do scroll-spy) */
  const linksNav = [];
  /** Conjunto das seções atualmente na faixa do spy (DOM order decide o atual). */
  const secoesAtivas = new Set();

  TITULOS.forEach((titulo, i) => {
    const id = `secao-${i + 1}`;
    const link = h('a', { href: `#${id}`, text: titulo, class: 'nota' });
    linksNav.push(link);

    const secao = h(
      'section',
      { id },
      h('h4', { text: tr(STRINGS, 'section.title', { n: i + 1, titulo }) }),
      ...Array.from({ length: 5 }, (_, j) => {
        const cartao = h('div', {
          class: 'cartao',
          // opacity inicial 0: o .visivel (futuro no CSS) + inline garantem o efeito já
          style:
            'opacity:0;transition:opacity .25s;padding:.35rem;margin:.35rem 0;' +
            'border:1px dashed #666;border-radius:4px',
          text: tr(STRINGS, 'card.text', { n: i * 5 + j + 1, titulo }),
        });
        cartoes.push(cartao);
        return cartao;
      }),
    );
    secoes.push(secao);
    caixa.append(secao);
  });

  const nav = h('nav', { class: 'botoes', 'aria-label': tr(STRINGS, 'nav.aria') }, ...linksNav);

  /** Destaca o link da primeira seção ativa (ordem do DOM = ordem de leitura). */
  function destacarSecaoAtual() {
    const atual = secoes.find((secao) => secoesAtivas.has(secao));
    if (!atual) return; // entre faixas: mantém o último destaque
    linksNav.forEach((link, i) => {
      const ativo = secoes[i] === atual;
      // aria-current p/ leitor de tela; inline style p/ destaque visual sem CSS
      if (ativo) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      link.style.fontWeight = ativo ? '700' : '';
      link.style.color = ativo ? '#1f6feb' : '';
    });
  }

  const revelados = new Set();
  /** @type {IntersectionObserver|null} revela cartões conforme entram na caixa */
  let obsRevelacao = null;
  /** @type {IntersectionObserver|null} spy: qual seção está na faixa superior */
  let obsSpy = null;

  if (temIO) {
    // O que é: observa interseção com o root (aqui: a caixa rolável) sem
    // scroll listeners; por que usei aqui: revelação reativa e barata, sem
    // recalcular getBoundingClientRect a cada evento de scroll.
    obsRevelacao = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const cartao = /** @type {HTMLElement} */ (entrada.target);
          if (entrada.isIntersecting) {
            cartao.classList.add('visivel');
            cartao.style.opacity = '1';
            revelados.add(cartao);
          } else {
            cartao.classList.remove('visivel');
            cartao.style.opacity = '0';
            revelados.delete(cartao);
          }
        }
        saidaRevelados.textContent = tr(STRINGS, 'revealed', {
          n: revelados.size,
          total: cartoes.length,
        });
      },
      { root: caixa, threshold: 0.5 },
    );
    for (const cartao of cartoes) obsRevelacao.observe(cartao);

    // Scroll-spy: 2ª instância do IO — faixa estreita no terço superior do root
    obsSpy = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) secoesAtivas.add(/** @type {HTMLElement} */ (entrada.target));
          else secoesAtivas.delete(/** @type {HTMLElement} */ (entrada.target));
        }
        destacarSecaoAtual();
      },
      { root: caixa, rootMargin: '-10% 0px -65% 0px', threshold: 0 },
    );
    for (const secao of secoes) obsSpy.observe(secao);
  } else {
    // Fallback: sem IO o scroll não observa nada — revela tudo e avisa.
    for (const cartao of cartoes) {
      cartao.classList.add('visivel');
      cartao.style.opacity = '1';
    }
    saidaRevelados.textContent = tr(STRINGS, 'revealed.noIO', {
      n: cartoes.length,
      total: cartoes.length,
    });
    caixa.append(
      h('p', {
        class: 'nota',
        text: tr(STRINGS, 'io.note'),
      }),
    );
  }

  // Nav do spy: rolagem INTERNAMENTE da caixa (não "escapa" para a página)
  remocoes.push(
    ...linksNav.map((link, i) =>
      on(link, 'click', (evento) => {
        evento.preventDefault();
        const secao = secoes[i];
        const topo =
          caixa.scrollTop + secao.getBoundingClientRect().top - caixa.getBoundingClientRect().top;
        caixa.scrollTo({ top: topo, behavior: 'smooth' });
      }),
    ),
  );

  const painelIO = h(
    'div',
    { class: 'linha' },
    h('h3', { text: tr(STRINGS, 'io.title') }),
    nav,
    caixa,
    h('p', { class: 'nota' }, 'status: ', saidaRevelados),
    h('p', {
      class: 'nota',
      text: tr(STRINGS, 'io.cardsNote'),
    }),
  );

  // ── b) ResizeObserver: tamanho ao vivo de uma caixa redimensionável ─────────
  const caixaRedim = h(
    'div',
    {
      style:
        'width:180px;height:110px;resize:both;overflow:hidden;min-width:90px;' +
        'min-height:70px;border:1px solid #555;border-radius:6px;padding:.4rem',
    },
    h('p', { class: 'nota', text: tr(STRINGS, 'resize.hint') }),
  );
  // Sem aria-live de propósito: resize dispara ~60×/s e announceria sem parar
  const saidaTamanho = h('output', { text: '—' });

  function atualizarTamanho() {
    if (rafTamanho !== 0) return; // já há um rAF agendado: coalesce (1 update/quadro)
    rafTamanho = requestAnimationFrame(() => {
      rafTamanho = 0;
      const retangulo = caixaRedim.getBoundingClientRect();
      saidaTamanho.textContent = `${Math.round(retangulo.width)} × ${Math.round(retangulo.height)} px`;
    });
  }

  /** @type {ResizeObserver|null} observer da caixa redimensionável */
  let obsResize = null;
  if ('ResizeObserver' in window) {
    // O que é: observa mudanças de layout de um elemento (aqui a caixa com
    // resize:both); por que usei aqui: lê o tamanho SEM polling e sem ouvir
    // window.resize — o rAF de cima garante no máx. 1 update por quadro.
    obsResize = new ResizeObserver(atualizarTamanho);
    obsResize.observe(caixaRedim);
  } else {
    saidaTamanho.textContent = tr(STRINGS, 'resize.unavailable');
  }

  const painelRO = h(
    'div',
    { class: 'linha' },
    h('h3', { text: tr(STRINGS, 'resize.title') }),
    h('div', { class: 'grade' }, caixaRedim, h('p', {}, tr(STRINGS, 'size.label'), saidaTamanho)),
  );

  // ── c) MutationObserver: o que muda na lista (e como) ───────────────────────
  const listaMutacoes = h(
    'ul',
    { class: 'nota' },
    h('li', { text: 'Item 1' }),
    h('li', { text: 'Item 2' }),
  );
  const saidaMutacoes = h('output', {
    'aria-live': 'polite',
    text: tr(STRINGS, 'mutations.none'),
  });
  let contadorItem = 2;
  /** Histórico curto das últimas mutações descritas. */
  const historico = [];

  /**
   * Descreve o alvo de uma MutationRecord (tag; para texto, a tag do pai).
   *
   * @param {Node} alvo nó atingido pela mutação
   * @returns {string} rótulo legível ("UL", "text em LI")
   */
  function descreverAlvo(alvo) {
    // Text node não tem tag própria — usamos o nodeName/parent (sem `instanceof Text`,
    // que não é global padrão em todos os ambientes)
    if (alvo.nodeName === '#text') {
      return tr(STRINGS, 'target.text', { tag: alvo.parentElement?.tagName ?? '?' });
    }
    return alvo.nodeName;
  }

  /**
   * Registra uma mutação na linha de status (typo + alvo).
   *
   * @param {MutationRecord} registro observado
   */
  function registrarMutacao(registro) {
    const alvo = descreverAlvo(registro.target);
    historico.push(tr(STRINGS, 'mutation.in', { type: registro.type, alvo }));
    if (historico.length > 4) historico.shift();
    saidaMutacoes.textContent = tr(STRINGS, 'mutations.latest', { lista: historico.join(' · ') });
  }

  /** @type {MutationObserver|null} observer da lista */
  let obsMutacoes = null;
  if ('MutationObserver' in window) {
    // O que é: observa inserções/remoções (childList) e mudanças de texto
    // (characterData) na subárvore; por que usei aqui: mostra O QUE o nosso
    // próprio código está fazendo no DOM, em tempo real.
    obsMutacoes = new MutationObserver((registros) => registros.forEach(registrarMutacao));
    obsMutacoes.observe(listaMutacoes, { childList: true, subtree: true, characterData: true });
  } else {
    saidaMutacoes.textContent = tr(STRINGS, 'mutations.unavailable');
  }

  function adicionarItem() {
    contadorItem += 1;
    // append direto → MutationRecord { type: 'childList', target: UL }
    listaMutacoes.append(h('li', { text: `Item ${contadorItem}` }));
  }

  function alterarTexto() {
    const primeiroTexto = listaMutacoes.firstElementChild?.firstChild;
    if (!primeiroTexto) return;
    // nodeValue em um nó de texto EXISTENTE → MutationRecord { type: 'characterData' }
    // (trocar textContent do <li> seria childList — texto novo no lugar do velho)
    primeiroTexto.nodeValue = tr(STRINGS, 'item.changed', {
      hora: new Date().toLocaleTimeString('pt-BR'),
    });
  }

  const painelMO = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'MutationObserver' }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.add'),
        on: { click: adicionarItem },
      }),
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.changeText'),
        on: { click: alterarTexto },
      }),
      saidaMutacoes,
    ),
    listaMutacoes,
  );

  // ── d) DocumentFragment via renderList: 1000 itens em 1 commit ──────────────
  const listaGrande = h('ul', {
    class: 'nota',
    style: 'max-height:140px;overflow:auto;border:1px solid #555;border-radius:6px;padding:.4rem',
  });
  const saidaRender = h('output', {
    'aria-live': 'polite',
    text: tr(STRINGS, 'render.none'),
  });

  function renderizarMilItens() {
    const itens = Array.from({ length: 1000 }, (_, i) => i + 1);
    performance.clearMarks('demo04:inicio');
    performance.clearMarks('demo04:fim');
    performance.clearMeasures('demo04:render');

    performance.mark('demo04:inicio');
    const t0 = performance.now();
    // O que é: DocumentFragment é um "container fantasma" — tudo é montado FORA
    // da árvore e anexado de uma vez (1 reflow, não 1000); por que usei aqui:
    // medir o ganho de rendering eficiente com números de verdade.
    const quantidade = renderList(listaGrande, itens, (n) => h('li', { text: `Item ${n}` }));
    const t1 = performance.now();
    performance.mark('demo04:fim');
    const medida = performance.measure('demo04:render', 'demo04:inicio', 'demo04:fim');

    saidaRender.textContent = tr(STRINGS, 'render.result', {
      qtd: quantidade,
      t1: (t1 - t0).toFixed(2),
      t2: medida.duration.toFixed(2),
    });
  }

  const painelFragmento = h(
    'div',
    { class: 'linha' },
    h('h3', { text: tr(STRINGS, 'fragment.title') }),
    h(
      'div',
      { class: 'botoes' },
      h('button', {
        type: 'button',
        text: tr(STRINGS, 'btn.render'),
        on: { click: renderizarMilItens },
      }),
      saidaRender,
    ),
    listaGrande,
  );

  container.append(painelIO, painelRO, painelMO, painelFragmento);

  // Primeira medição de tamanho (rAF força leitura com layout atual)
  if (obsResize) atualizarTamanho();

  // Cleanup: observers vivem além do DOM removido — desconectar é obrigatório;
  // o rAF de resize e os listeners criados com on() também são cancelados.
  return () => {
    obsRevelacao?.disconnect();
    obsSpy?.disconnect();
    obsResize?.disconnect();
    obsMutacoes?.disconnect();
    if (rafTamanho !== 0) cancelAnimationFrame(rafTamanho);
    rafTamanho = 0;
    for (const remover of remocoes) remover();
  };
}
