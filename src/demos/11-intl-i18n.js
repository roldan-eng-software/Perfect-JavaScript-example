// @ts-check
/**
 * ARQUIVO: 11-intl-i18n.js
 * PROPÓSITO: demonstrar a API Intl nativa de ponta a ponta — números, datas,
 *   tempos relativos, listas, plurais e ordenação cultural, sem bibliotecas.
 * CONCEITOS DEMONSTRADOS: Intl.NumberFormat/DateTimeFormat/RelativeTimeFormat,
 *   ListFormat, PluralRules, Collator, feature detection, locale BCP-47.
 * USADO EM: seção 11 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: toda a formatação delega regras de língua ao motor
 *   (dados ICU do navegador) — os helpers puros vêm de utils/format.js; o
 *   cleanup remove os listeners criados com on().
 */
import { h, on } from '../core/dom.js';
import { tr } from '../core/i18n.js';
import {
  formatNumber,
  formatDate,
  formatRelativeTime,
  formatList,
  pluralize,
  collate,
} from '../utils/format.js';

/**
 * Textos de interface (chrome) da demo: títulos, rótulos e mensagens de status.
 * Os selects de locale e as amostras formatadas são CONTEÚDO da demo Intl —
 * continuam variando pelo locale escolhido no próprio painel.
 */
const STRINGS = {
  'en-US': {
    fallback: '{nome} unavailable in this browser — reduced demo.',
    'aria.number': 'Number to format',
    'aria.datetime': 'Date and time to format',
    'select.style': 'style',
    'select.format': 'format',
    'label.number': 'number: ',
    'label.result': 'result: ',
    'label.date': 'date: ',
    'label.formatted': 'formatted: ',
    'label.relative': 'relative: ',
    'err.number': '— (enter a valid number)',
    'err.date': 'invalid date',
    'out.compact': '{principal} · compact: {compacto}',
    'out.error': 'error: {erro}',
    intro:
      'Intl is the native internationalization API: the linguistic (ICU) data already ' +
      'ships with the browser — i18n with zero dependencies.',
  },
  'pt-BR': {
    fallback: '{nome} indisponível neste navegador — demo reduzida.',
    'aria.number': 'Número a formatar',
    'aria.datetime': 'Data e hora a formatar',
    'select.style': 'estilo',
    'select.format': 'formato',
    'label.number': 'número: ',
    'label.result': 'resultado: ',
    'label.date': 'data: ',
    'label.formatted': 'formatado: ',
    'label.relative': 'relativo: ',
    'err.number': '— (informe um número válido)',
    'err.date': 'data inválida',
    'out.compact': '{principal} · compacto: {compacto}',
    'out.error': 'erro: {erro}',
    intro:
      'Intl é a API nativa de internacionalização: os dados linguísticos (ICU) já ' +
      'vêm no navegador — i18n com zero dependências.',
  },
};

/** Moeda padrão por locale (BCP-47 → código ISO 4217). */
const MOEDAS = /** @type {Record<string, string>} */ ({
  'pt-BR': 'BRL',
  'en-US': 'USD',
  'de-DE': 'EUR',
  'ja-JP': 'JPY',
});

/** Feature detection por construtor — cada painel degrada se faltar. */
const SUPORTA = Object.freeze({
  numero: typeof Intl.NumberFormat === 'function',
  data: typeof Intl.DateTimeFormat === 'function',
  relativa: typeof Intl.RelativeTimeFormat === 'function',
  lista: typeof Intl.ListFormat === 'function',
  plural: typeof Intl.PluralRules === 'function',
  collator: typeof Intl.Collator === 'function',
});

/**
 * Cria um <select> com as opções dadas (a primeira vem marcada).
 *
 * @param {string} rotulo rótulo visível do campo
 * @param {string[]} opcoes valores/labels das opções
 * @param {string} [ariaLabel] rótulo para leitores de tela
 * @returns {{ campo: HTMLSelectElement, raiz: HTMLElement }} select e seu wrapper
 */
function criarSelect(rotulo, opcoes, ariaLabel) {
  const campo = h(
    'select',
    { 'aria-label': ariaLabel ?? rotulo },
    ...opcoes.map((valor, i) => h('option', { value: valor, text: valor, selected: i === 0 })),
  );
  const raiz = h('label', { class: 'nota' }, `${rotulo}: `, campo);
  return { campo, raiz };
}

/**
 * Inicializa a demo de internacionalização com a API Intl.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — remove os listeners criados com on()
 * @example
 * const cleanup = init(document.querySelector('#demo11'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];

  /** Nota de fallback exibida quando o navegador não suporta uma sub-API. */
  function semSuporte(nome) {
    return h('p', { class: 'nota', text: tr(STRINGS, 'fallback', { nome }) });
  }

  // ── 1. Intl.NumberFormat: moeda/decimal/percentual + notation compact ──────
  const painelNumeros = h('div', { class: 'linha' }, h('h3', { text: 'Intl.NumberFormat' }));
  if (SUPORTA.numero) {
    const entrada = h('input', {
      type: 'number',
      step: 'any',
      value: '1234567.89',
      'aria-label': tr(STRINGS, 'aria.number'),
    });
    const selLocale = criarSelect('locale', ['pt-BR', 'en-US', 'de-DE', 'ja-JP']);
    const selEstilo = criarSelect(tr(STRINGS, 'select.style'), ['decimal', 'currency', 'percent']);
    const saida = h('output', { 'aria-live': 'polite' });

    function atualizarNumero() {
      const valor = Number(entrada.value);
      if (!Number.isFinite(valor)) {
        saida.textContent = tr(STRINGS, 'err.number');
        return;
      }
      const locale = selLocale.campo.value;
      try {
        // O que é: Intl aplica separador de milhar, decimal e símbolo de moeda
        // conforme a língua — por que usei aqui: regras da ICU sem lib externa.
        const principal = formatNumber(valor, {
          locale,
          style: selEstilo.campo.value,
          currency: MOEDAS[locale] ?? 'BRL',
        });
        // notation: 'compact' encurta grandeza ("1,2 mi" / "1.2M") por língua
        const compacto = new Intl.NumberFormat(locale, {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(valor);
        saida.textContent = tr(STRINGS, 'out.compact', { principal, compacto });
      } catch (erro) {
        saida.textContent = tr(STRINGS, 'out.error', {
          erro: erro instanceof Error ? erro.message : String(erro),
        });
      }
    }

    remocoes.push(
      on(entrada, 'input', atualizarNumero),
      on(selLocale.campo, 'change', atualizarNumero),
      on(selEstilo.campo, 'change', atualizarNumero),
    );
    atualizarNumero();

    painelNumeros.append(
      h(
        'div',
        { class: 'botoes' },
        h('label', { class: 'nota' }, tr(STRINGS, 'label.number'), entrada),
        selLocale.raiz,
        selEstilo.raiz,
      ),
      h('p', { class: 'nota' }, tr(STRINGS, 'label.result'), saida),
    );
  } else {
    painelNumeros.append(semSuporte('Intl.NumberFormat'));
  }

  // ── 2. Intl.DateTimeFormat + Intl.RelativeTimeFormat ────────────────────────
  const painelDatas = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Intl.DateTimeFormat + RelativeTimeFormat' }),
  );
  if (SUPORTA.data) {
    const entradaData = h('input', {
      type: 'datetime-local',
      value: '2026-10-02T15:45',
      'aria-label': tr(STRINGS, 'aria.datetime'),
    });
    const selLocaleData = criarSelect('locale', ['pt-BR', 'en-US', 'ja-JP']);
    const selFormato = criarSelect(tr(STRINGS, 'select.format'), ['datetime', 'date', 'time']);
    const selZona = criarSelect('timeZone', ['America/Sao_Paulo', 'UTC', 'Asia/Tokyo']);
    const saidaData = h('output', { 'aria-live': 'polite' });

    function atualizarData() {
      const data = new Date(entradaData.value);
      if (Number.isNaN(data.getTime())) {
        saidaData.textContent = tr(STRINGS, 'err.date');
        return;
      }
      // timeZone demonstra que a MESMA data renderiza diferente conforme o fuso
      saidaData.textContent = formatDate(data, {
        locale: selLocaleData.campo.value,
        formato: /** @type {'date'|'time'|'datetime'} */ (selFormato.campo.value),
        opções: { timeZone: selZona.campo.value },
      });
    }

    remocoes.push(
      on(entradaData, 'input', atualizarData),
      on(selLocaleData.campo, 'change', atualizarData),
      on(selFormato.campo, 'change', atualizarData),
      on(selZona.campo, 'change', atualizarData),
    );
    atualizarData();

    painelDatas.append(
      h(
        'div',
        { class: 'botoes' },
        h('label', { class: 'nota' }, tr(STRINGS, 'label.date'), entradaData),
        selLocaleData.raiz,
        selFormato.raiz,
        selZona.raiz,
      ),
      h('p', { class: 'nota' }, tr(STRINGS, 'label.formatted'), saidaData),
    );
  } else {
    painelDatas.append(semSuporte('Intl.DateTimeFormat'));
  }

  if (SUPORTA.relativa) {
    const saidaRelativa = h('output', { 'aria-live': 'polite' });

    function atualizarRelativa() {
      const locale = SUPORTA.data
        ? (painelDatas.querySelector('select')?.value ?? 'pt-BR')
        : 'pt-BR';
      // O que é: RelativeTimeFormat vira número+unidade em frase ("há 3 dias")
      // com ordem/gênero da língua — por que usei aqui: sem ele, string manual
      // quebra em plural/futuro de outros idiomas.
      saidaRelativa.textContent = [
        formatRelativeTime(-3, 'day', { locale }),
        formatRelativeTime(-45, 'minute', { locale }),
        formatRelativeTime(2, 'month', { locale }),
      ].join(' · ');
    }

    // Re-renderiza junto com o select de locale do painel de datas (mesmo locale)
    const primeiroSelect = painelDatas.querySelector('select');
    if (primeiroSelect) remocoes.push(on(primeiroSelect, 'change', atualizarRelativa));
    atualizarRelativa();

    painelDatas.append(h('p', { class: 'nota' }, tr(STRINGS, 'label.relative'), saidaRelativa));
  }

  // ── 3. ListFormat + PluralRules + Collator ──────────────────────────────────
  const painelTextos = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Intl.ListFormat + PluralRules + Collator' }),
  );
  if (SUPORTA.lista && SUPORTA.plural && SUPORTA.collator) {
    const selLocaleTexto = criarSelect('locale', ['pt-BR', 'en-US', 'de-DE']);
    const saidaLista = h('output', { 'aria-live': 'polite' });
    const saidaPlural = h('output', { 'aria-live': 'polite' });
    const saidaOrdem = h('output', { 'aria-live': 'polite' });

    function atualizarTextos() {
      const locale = selLocaleTexto.campo.value;

      // ListFormat: junção cultural ("Ana, Bruno e Carla" vs "Ana, Bruno, and Carla")
      saidaLista.textContent = formatList(['Ana', 'Bruno', 'Carla'], { locale });

      // PluralRules: a categoria (one/other/…) decide a forma — nunca concatenação
      saidaPlural.textContent = [0, 1, 2, 5]
        .map((n) => pluralize(n, { one: '{n} item', other: '{n} itens' }, { locale }))
        .join(' · ');

      // Collator: ordena por regras da língua; sem ele, o sort compara code units
      const base = ['Zebra', 'abacaxi', 'Água'];
      const semRegras = [...base].sort();
      const comRegras = [...base].sort((a, b) => collate(a, b, { locale }));
      saidaOrdem.textContent = `code units: ${semRegras.join(', ')} | ${locale}: ${comRegras.join(', ')}`;
    }

    remocoes.push(on(selLocaleTexto.campo, 'change', atualizarTextos));
    atualizarTextos();

    painelTextos.append(
      h('div', { class: 'botoes' }, selLocaleTexto.raiz),
      h(
        'div',
        { class: 'grade' },
        h('p', {}, h('code', { text: 'ListFormat' }), ' → ', saidaLista),
        h('p', {}, h('code', { text: 'PluralRules' }), ' → ', saidaPlural),
        h('p', {}, h('code', { text: 'Collator' }), ' → ', saidaOrdem),
      ),
    );
  } else {
    painelTextos.append(semSuporte('Intl.ListFormat/PluralRules/Collator'));
  }

  const painelIntro = h(
    'div',
    { class: 'linha' },
    h('p', { class: 'nota', text: tr(STRINGS, 'intro') }),
  );

  container.append(painelIntro, painelNumeros, painelDatas, painelTextos);

  // Cleanup: os listeners ficaram em remocoes; os criados via h({ on }) morrem
  // com o DOM do container.
  return () => {
    for (const remover of remocoes) remover();
  };
}
