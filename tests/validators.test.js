/**
 * ARQUIVO: validators.test.js
 * PROPÓSITO: testar validadores puros — casos normais, borda e erro.
 * CONCEITOS DEMONSTRADOS: funções puras, regex, dígitos verificadores.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEmail,
  isCPF,
  isCEP,
  isPhoneBR,
  isURL,
  minLength,
  isStrongPassword,
  validateField,
} from '../src/utils/validators.js';

describe('isEmail', () => {
  it('aceita e-mails bem formados', () => {
    assert.equal(isEmail('ana@exemplo.com'), true);
    assert.equal(isEmail('a.b+tag@sub.dominio.com.br'), true);
    assert.equal(isEmail('  com.espacos@ok.com  '), true, 'trim antes de validar');
  });

  it('rejeita formatos inválidos', () => {
    assert.equal(isEmail('sem-arroba.com'), false);
    assert.equal(isEmail('a@b'), false, 'tld precisa de 2+ chars');
    assert.equal(isEmail('a @b.com'), false, 'espaço no local');
    assert.equal(isEmail(''), false);
    assert.equal(isEmail(/** @type {any} */ (42)), false, 'não-string');
  });
});

describe('isCPF', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    assert.equal(isCPF('529.982.247-25'), true);
    assert.equal(isCPF('52998224725'), true, 'sem máscara');
  });

  it('rejeita CPFs malformados ou repetidos', () => {
    assert.equal(isCPF('111.111.111-11'), false, 'sequência repetida');
    assert.equal(isCPF('529.982.247-26'), false, 'dv errado');
    assert.equal(isCPF('123'), false, 'curto demais');
    assert.equal(isCPF(''), false);
    assert.equal(isCPF(/** @type {any} */ (null)), false);
  });
});

describe('isCEP', () => {
  it('aceita CEP com e sem hífen', () => {
    assert.equal(isCEP('01310-100'), true);
    assert.equal(isCEP('01310100'), true);
  });

  it('rejeita CEPs inválidos', () => {
    assert.equal(isCEP('01310-10'), false);
    assert.equal(isCEP('abc-def'), false);
    assert.equal(isCEP(/** @type {any} */ (undefined)), false);
  });
});

describe('isPhoneBR', () => {
  it('aceita fixo (10) e celular (11) com DDD válido', () => {
    assert.equal(isPhoneBR('(11) 3456-7890'), true);
    assert.equal(isPhoneBR('11912345678'), true);
  });

  it('rejeita números impossíveis', () => {
    assert.equal(isPhoneBR('91234-5678'), false, 'sem DDD');
    assert.equal(isPhoneBR('11 91234-56789'), false, '12 dígitos');
    assert.equal(isPhoneBR('00 91234-5678'), false, 'DDD começa em 0');
  });
});

describe('isURL', () => {
  it('aceita apenas http/https absolutos', () => {
    assert.equal(isURL('https://example.com'), true);
    assert.equal(isURL('http://localhost:3000/x'), true);
    assert.equal(isURL('ftp://example.com'), false, 'outro protocolo');
    assert.equal(isURL('/caminho/relativo'), false, 'relativa');
    assert.equal(isURL('não é url'), false);
  });
});

describe('minLength', () => {
  it('mede o tamanho com trim por padrão', () => {
    assert.equal(minLength('  abc  ', 3), true);
    assert.equal(minLength('  a  ', 3), false);
    assert.equal(minLength('    ', 2), false, 'só espaços não conta');
    assert.equal(minLength('ab', 2, false), true, 'ignorarEspacos=false conta espaços');
  });

  it('rejeita entradas inválidas', () => {
    assert.equal(minLength(/** @type {any} */ (5), 2), false);
    assert.equal(minLength('abc', -1), false);
  });
});

describe('isStrongPassword', () => {
  it('aceita senha que cumpre todas as regras', () => {
    assert.equal(isStrongPassword('Abc@1234').valido, true);
  });

  it('explica exatamente o que falta', () => {
    const r = isStrongPassword('abc');
    assert.equal(r.valido, false);
    assert.match(r.mensagem, /8 caracteres/);
    assert.match(r.mensagem, /maiúscula/);
    assert.match(r.mensagem, /número/);
    assert.match(r.mensagem, /símbolo/);
  });
});

describe('validateField', () => {
  it('valida cada regra conhecida', () => {
    assert.equal(validateField('email', 'a@b.co').valido, true);
    assert.equal(validateField('cpf', '529.982.247-25').valido, true);
    assert.equal(validateField('cep', '01310-100').valido, true);
    assert.equal(validateField('phone', '(11) 91234-5678').valido, true);
    assert.equal(validateField('url', 'https://x.dev').valido, true);
    assert.equal(validateField('required', 'algo').valido, true);
  });

  it('required falha para vazio', () => {
    assert.equal(validateField('required', '   ').valido, false);
    assert.equal(validateField('required', '').mensagem, 'Este campo é obrigatório.');
  });

  it('lança TypeError para regra desconhecida', () => {
    assert.throws(() => validateField('inexistente', 'x'), TypeError);
  });
});
