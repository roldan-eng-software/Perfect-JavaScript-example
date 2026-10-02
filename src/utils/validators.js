// @ts-check
/**
 * ARQUIVO: validators.js
 * PROPÓSITO: validar dados de formulários com funções puras e reutilizáveis.
 * CONCEITOS DEMONSTRADOS: regex, funções puras, composição de validações,
 *   optional chaining, programação defensiva.
 * USADO EM: demo 09 (Constraint Validation API), testes automatizados.
 * COMPLEXIDADE/OBSERVAÇÕES: todas as funções são puras e devolvem boolean —
 *   a UI decide como exibir a mensagem; validações BR (CPF/CEP/telefone)
 *   checam formato + dígitos verificadores reais.
 */

/**
 * Resultado padronizado de validação.
 *
 * @typedef {object} ValidationResult
 * @property {boolean} valido se os dados passaram na validação
 * @property {string} mensagem mensagem pronta para exibir ao usuário
 */

/**
 * Valida e-mail no formato básico (sem validar existência da caixa).
 *
 * @param {string} valor texto a validar
 * @returns {boolean} true se for e-mail válido
 * @example
 * isEmail('ana@exemplo.com'); // true
 */
export function isEmail(valor) {
  if (typeof valor !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());
}

/**
 * Valida CPF brasileiro: formato 000.000.000-00 + dígitos verificadores.
 *
 * @param {string} valor CPF com ou sem máscara
 * @returns {boolean} true se o CPF for estruturalmente válido
 * @example
 * isCPF('529.982.247-25'); // true (dígitos verificadores conferem)
 */
export function isCPF(valor) {
  if (typeof valor !== 'string') return false;
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDV = (base, pesos) => {
    const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calcularDV(digitos.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcularDV(digitos.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digitos === `${digitos.slice(0, 9)}${dv1}${dv2}`;
}

/**
 * Valida CEP brasileiro (formato 00000-000 ou 8 dígitos).
 *
 * @param {string} valor CEP com ou sem máscara
 * @returns {boolean} true se o formato for válido
 * @example
 * isCEP('01310-100'); // true
 */
export function isCEP(valor) {
  if (typeof valor !== 'string') return false;
  return /^\d{5}-?\d{3}$/.test(valor.trim());
}

/**
 * Valida telefone BR: 10 ou 11 dígitos (com DDD), com ou sem máscara.
 *
 * @param {string} valor telefone com ou sem formatação
 * @returns {boolean} true se for um número BR plausível
 * @example
 * isPhoneBR('(11) 91234-5678'); // true
 */
export function isPhoneBR(valor) {
  if (typeof valor !== 'string') return false;
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 11) return false;
  const ddd = Number(digitos.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

/**
 * Valida URL absoluta (http/https).
 *
 * @param {string} valor texto a validar
 * @returns {boolean} true se for URL absoluta válida
 * @example
 * isURL('https://example.com'); // true
 */
export function isURL(valor) {
  if (typeof valor !== 'string') return false;
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Verifica tamanho mínimo de string (após trim opcional).
 *
 * @param {string} valor texto
 * @param {number} min tamanho mínimo
 * @param {boolean} [ignorarEspacos] se true, mede sem espaços nas bordas (padrão true)
 * @returns {boolean} true se atender ao mínimo
 */
export function minLength(valor, min, ignorarEspacos = true) {
  if (typeof valor !== 'string' || !Number.isInteger(min) || min < 0) return false;
  const texto = ignorarEspacos ? valor.trim() : valor;
  return texto.length >= min;
}

/**
 * Valida senha "forte": 8+ chars, 1 maiúscula, 1 minúscula, 1 dígito, 1 símbolo.
 *
 * @param {string} valor senha a validar
 * @returns {ValidationResult} objeto com `valido` e `mensagem` explicando a falha
 * @example
 * isStrongPassword('Abc@1234').valido; // true
 */
export function isStrongPassword(valor) {
  if (typeof valor !== 'string') {
    return { valido: false, mensagem: 'Senha inválida.' };
  }
  const regras = [
    { ok: valor.length >= 8, msg: 'use pelo menos 8 caracteres' },
    { ok: /[A-Z]/.test(valor), msg: 'inclua 1 letra maiúscula' },
    { ok: /[a-z]/.test(valor), msg: 'inclua 1 letra minúscula' },
    { ok: /\d/.test(valor), msg: 'inclua 1 número' },
    { ok: /[^A-Za-z0-9]/.test(valor), msg: 'inclua 1 símbolo' },
  ];
  const falhas = regras.filter((r) => !r.ok).map((r) => r.msg);
  if (falhas.length === 0) return { valido: true, mensagem: 'Senha forte.' };
  return { valido: false, mensagem: `Senha fraca: ${falhas.join(', ')}.` };
}

/**
 * Valida um campo com a regra indicada — dispatcher usado pela demo de formulários.
 *
 * @param {string} tipo chave da regra: 'email' | 'cpf' | 'cep' | 'phone' | 'url' | 'required' | 'password'
 * @param {string} valor valor do campo
 * @returns {ValidationResult} resultado padronizado
 * @throws {TypeError} se `tipo` não for uma regra conhecida
 */
export function validateField(tipo, valor) {
  const vazio = typeof valor !== 'string' || valor.trim() === '';
  const mapa = {
    required: () =>
      vazio
        ? { valido: false, mensagem: 'Este campo é obrigatório.' }
        : { valido: true, mensagem: '' },
    email: () =>
      isEmail(valor)
        ? { valido: true, mensagem: '' }
        : { valido: false, mensagem: 'Informe um e-mail válido (ex.: ana@exemplo.com).' },
    cpf: () =>
      isCPF(valor)
        ? { valido: true, mensagem: '' }
        : { valido: false, mensagem: 'CPF inválido — confira os 11 dígitos.' },
    cep: () =>
      isCEP(valor)
        ? { valido: true, mensagem: '' }
        : { valido: false, mensagem: 'CEP inválido (formato 00000-000).' },
    phone: () =>
      isPhoneBR(valor)
        ? { valido: true, mensagem: '' }
        : { valido: false, mensagem: 'Telefone BR inválido (DDD + número).' },
    url: () =>
      isURL(valor)
        ? { valido: true, mensagem: '' }
        : { valido: false, mensagem: 'URL deve começar com http:// ou https://' },
    password: () => isStrongPassword(valor),
  };

  const regra = mapa[tipo];
  if (!regra) {
    throw new TypeError(`validateField: regra desconhecida "${tipo}".`);
  }
  return regra();
}
