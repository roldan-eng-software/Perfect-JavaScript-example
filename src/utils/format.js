// @ts-check
/**
 * ARQUIVO: format.js
 * PROPÓSITO: formatar números, datas, listas e plurais com a API Intl nativa.
 * CONCEITOS DEMONSTRADOS: Intl.NumberFormat, DateTimeFormat, RelativeTimeFormat,
 *   ListFormat, PluralRules, Collator — i18n sem bibliotecas.
 * USADO EM: demo 11 (internacionalização), demo 02 (datas dos projetos).
 * COMPLEXIDADE/OBSERVAÇÕES: funções puras; recebem locale por parâmetro (padrão pt-BR)
 *   e evitam efeitos colaterais — testáveis com asserts de string fixos.
 */

/**
 * Formata um número como moeda/decimal/percentual.
 *
 * @param {number} valor número a formatar
 * @param {object} [opções]
 * @param {string} [opções.locale] tag BCP-47 (padrão 'pt-BR')
 * @param {string} [opções.style] 'decimal' | 'currency' | 'percent' (padrão 'decimal')
 * @param {string} [opções.currency] código ISO da moeda (padrão 'BRL')
 * @param {number} [opções.maximumFractionDigits] casas decimais máximas
 * @returns {string} texto formatado
 * @throws {RangeError} se `valor` não for número finito
 * @example
 * formatNumber(1234.5, { style: 'currency' }); // 'R$ 1.234,50'
 */
export function formatNumber(
  valor,
  { locale = 'pt-BR', style = 'decimal', currency = 'BRL', maximumFractionDigits } = {},
) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new RangeError('formatNumber: "valor" deve ser um número finito.');
  }
  return new Intl.NumberFormat(locale, {
    style,
    currency: style === 'currency' ? currency : undefined,
    maximumFractionDigits,
  }).format(valor);
}

/**
 * Formata uma data (Date ou timestamp) em texto localizado.
 *
 * @param {Date|number} data instância de Date ou timestamp em ms
 * @param {object} [opções]
 * @param {string} [opções.locale] tag BCP-47 (padrão 'pt-BR')
 * @param {'date'|'time'|'datetime'} [opções.formato] parte a exibir (padrão 'date')
 * @param {Intl.DateTimeFormatOptions} [opções.opções] opções extras repassadas ao Intl
 * @returns {string} data formatada
 * @throws {RangeError} se `data` for inválida
 * @example
 * formatDate(new Date('2026-01-15'), { formato: 'datetime' }); // '15/01/2026 00:00'
 */
export function formatDate(data, { locale = 'pt-BR', formato = 'date', opções = {} } = {}) {
  const date = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('formatDate: data inválida.');
  }
  const padrão = {
    date: { dateStyle: 'medium' },
    time: { timeStyle: 'short' },
    datetime: { dateStyle: 'medium', timeStyle: 'short' },
  }[formato];
  return new Intl.DateTimeFormat(locale, { ...padrão, ...opções }).format(date);
}

/**
 * Formata um tempo relativo ("há 3 dias", "em 2 horas").
 *
 * @param {number} valor quantidade (negativa = passado, positiva = futuro)
 * @param {Intl.RelativeTimeFormatUnit} unidade unidade: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'
 * @param {object} [opções]
 * @param {string} [opções.locale] tag BCP-47 (padrão 'pt-BR')
 * @param {Intl.RelativeTimeFormatStyle} [opções.numeric] 'always' | 'auto' (padrão 'auto')
 * @returns {string} texto relativo
 * @example
 * formatRelativeTime(-3, 'day'); // 'há 3 dias'
 */
export function formatRelativeTime(valor, unidade, { locale = 'pt-BR', numeric = 'auto' } = {}) {
  return new Intl.RelativeTimeFormat(locale, { numeric }).format(valor, unidade);
}

/**
 * Formata uma lista de itens ("a, b e c").
 *
 * @param {string[]} itens array de strings
 * @param {object} [opções]
 * @param {string} [opções.locale] tag BCP-47 (padrão 'pt-BR')
 * @param {'conjunction'|'disjunction'|'unit'} [opções.type] tipo de lista (padrão 'conjunction')
 * @returns {string} lista formatada
 * @throws {TypeError} se `itens` não for array
 * @example
 * formatList(['Ana', 'Bia', 'Caio']); // 'Ana, Bia e Caio'
 */
export function formatList(itens, { locale = 'pt-BR', type = 'conjunction' } = {}) {
  if (!Array.isArray(itens)) {
    throw new TypeError('formatList: "itens" deve ser um array.');
  }
  return new Intl.ListFormat(locale, { type, style: 'long' }).format(itens);
}

/**
 * Aplica a regra de plural do Intl.PluralRules ("1 item" / "2 itens").
 *
 * @param {number} quantidade número para decidir a forma plural
 * @param {Record<string, string>} formas mapa de formas: zero|one|two|few|many|other
 * @param {object} [opções]
 * @param {string} [opções.locale] tag BCP-47 (padrão 'pt-BR')
 * @returns {string} a forma adequada (cai em 'other' se a forma exata não existir)
 * @example
 * pluralize(1, { one: '1 item', other: '{n} itens' }).replace('{n}', '1'); // '1 item'
 */
export function pluralize(quantidade, formas, { locale = 'pt-BR' } = {}) {
  const categoria = new Intl.PluralRules(locale).select(quantidade);
  const texto = formas[categoria] ?? formas.other ?? String(quantidade);
  return texto.replaceAll('{n}', String(quantidade));
}

/**
 * Compara strings com regras de ordenação da língua (acentos, caixa).
 *
 * @param {string} a primeira string
 * @param {string} b segunda string
 * @param {object} [opções]
 * @param {string} [opções.locale] tag BCP-47 (padrão 'pt-BR')
 * @param {boolean} [opções.sensitivity] 'base' ignora acento/caixa (padrão true = 'accent')
 * @returns {number} -1, 0 ou 1 (comparador pronto para Array#sort)
 * @example
 * ['ola', 'Ovo', 'ação'].sort((x, y) => collate(x, y)); // ordena em pt-BR
 */
export function collate(a, b, { locale = 'pt-BR', sensitivity = 'base' } = {}) {
  return new Intl.Collator(locale, { sensitivity }).compare(a, b);
}
