/**
 * ARQUIVO: i18n.test.js
 * PROPÓSITO: testar o módulo de idioma — tr(), setLang, fallbacks e notificação.
 * CONCEITOS DEMONSTRADOS: dicionários por locale, pub/sub de idioma, no-op sem DOM.
 * USADO EM: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDIOMAS,
  SHELL,
  aplicarTraducoes,
  getLang,
  onLangChange,
  setLang,
  toggleLang,
  tr,
} from '../src/core/i18n.js';

/** Dicionário de exemplo usado nos testes de tr(). */
const DIC = {
  'en-US': { saudacao: 'Hello {nome}!', apenas: 'Only EN' },
  'pt-BR': { saudacao: 'Olá {nome}!' },
};

describe('i18n — getLang/setLang/toggleLang', () => {
  it('começa em en-US (padrão da landing) ou no idioma salvo', () => {
    assert.ok(IDIOMAS.includes(getLang()));
    setLang('en-US'); // garante estado conhecido para os próximos testes
    assert.equal(getLang(), 'en-US');
  });

  it('setLang troca o idioma e notifica assinantes', () => {
    let notificado = null;
    const fora = onLangChange((lang) => (notificado = lang));
    setLang('pt-BR');
    assert.equal(getLang(), 'pt-BR');
    assert.equal(notificado, 'pt-BR');
    fora();
    setLang('en-US');
    assert.equal(notificado, 'pt-BR', 'assinatura cancelada não é notificada');
  });

  it('toggleLang alterna entre en-US e pt-BR', () => {
    setLang('en-US');
    toggleLang();
    assert.equal(getLang(), 'pt-BR');
    toggleLang();
    assert.equal(getLang(), 'en-US');
  });

  it('setLang lança TypeError para idioma não suportado', () => {
    assert.throws(() => setLang('es-ES'), TypeError);
  });

  it('setLang no mesmo idioma é no-op (não notifica)', () => {
    setLang('en-US');
    let chamadas = 0;
    const fora = onLangChange(() => (chamadas += 1));
    setLang('en-US');
    assert.equal(chamadas, 0);
    fora();
  });
});

describe('i18n — tr()', () => {
  it('traduz para o idioma ativo', () => {
    setLang('en-US');
    assert.equal(tr(DIC, 'saudacao', { nome: 'Ana' }), 'Hello Ana!');
    setLang('pt-BR');
    assert.equal(tr(DIC, 'saudacao', { nome: 'Ana' }), 'Olá Ana!');
    setLang('en-US');
  });

  it('cai para en-US quando a chave só existe no idioma ativo ausente', () => {
    setLang('pt-BR');
    // 'apenas' não existe em pt-BR → fallback para en-US
    assert.equal(tr(DIC, 'apenas'), 'Only EN');
    setLang('en-US');
  });

  it('retorna a própria chave quando não existe em nenhum idioma', () => {
    assert.equal(tr(DIC, 'inexistente'), 'inexistente');
  });

  it('faz substituição de múltiplos parâmetros {nome}', () => {
    const d = {
      'en-US': { msg: '{a} and {b}' },
      'pt-BR': { msg: '{a} e {b}' },
    };
    setLang('pt-BR');
    assert.equal(tr(d, 'msg', { a: 'x', b: 'y' }), 'x e y');
    setLang('en-US');
    assert.equal(tr(d, 'msg', { a: 'x', b: 'y' }), 'x and y');
  });
});

describe('i18n — SHELL e aplicarTraducoes', () => {
  it('SHELL cobre os dois idiomas com as mesmas chaves', () => {
    const en = Object.keys(SHELL['en-US']).sort();
    const pt = Object.keys(SHELL['pt-BR']).sort();
    assert.deepEqual(en, pt, 'chaves divergentes entre en-US e pt-BR');
    assert.ok(en.length > 50, 'dicionário do shell deve ser completo');
  });

  it('nenhuma tradução do shell é string vazia', () => {
    for (const [lang, dict] of Object.entries(SHELL)) {
      for (const [chave, valor] of Object.entries(dict)) {
        assert.ok(typeof valor === 'string' && valor.trim().length > 0, `${lang}.${chave} vazia`);
      }
    }
  });

  it('aplicarTraducoes é no-op seguro fora do navegador (Node)', () => {
    // Sem document: não deve lançar
    assert.doesNotThrow(() => aplicarTraducoes());
  });
});
