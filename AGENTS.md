# AGENTS.md — Perfect JavaScript Example

Guia para assistentes de código (e revisores humanos) que trabalham neste repositório.

## O que é este projeto

Portfólio técnico: landing page interativa em **JavaScript puro** (ES2023+),
HTML semântico e CSS enxuto. **Zero dependências de runtime, zero build.**
Conteúdo visível e comentários em **português do Brasil**; identificadores em
**inglês**.

## Comandos

```bash
npm test        # node --test tests/ (suíte inteira deve passar)
npm run lint    # ESLint flat — deve sair sem erros
npm run format  # Prettier
npm run serve   # servidor estático em http://localhost:5173
```

Nunca adicione dependências de runtime. Ferramentas só como devDependencies
(atualmente: eslint, @eslint/js, prettier).

## Estrutura e regras de camada

- `src/utils/` — funções **puras**, sem import de DOM/storage; tudo testado.
- `src/core/` — infra (dom, store, event-bus, router, storage, logger).
- `src/components/` — Web Components (Custom Elements + Shadow DOM).
- `src/demos/` — uma demo por arquivo; importa apenas `core/` e `utils/`.
- Dependência sempre "para baixo"; **nunca** imports circulares nem demos
  importando outras demos.

## Contrato de toda demo

```js
// @ts-check
/**
 * ARQUIVO: nome.js
 * PROPÓSITO: …
 * CONCEITOS DEMONSTRADOS: …
 * USADO EM: …
 * COMPLEXIDADE/OBSERVAÇÕES: …
 */
export function init(container) {
  // monta UI, registra listeners/observers/timers
  return () => {
    // cleanup OBRIGATÓRIO: remover listeners, cancelar timers,
    // abortar fetches, desconectar observers
  };
}
```

`main.js` chama `init` via `import()` dinâmico quando a seção entra na
viewport e `cleanup` quando sai. `init` sem retorno de função = `DemoLoadError`.

## Regras de código (o lint pune a maioria)

- `const` por padrão, `let` quando reatribuir, **nunca `var`**, sem `eval`.
- Sem variáveis globais (estado vive em closures/`Map`).
- **Nunca** `innerHTML` com dados dinâmicos → `textContent`, `h()` (dom.js) ou
  `<template>`. Strings HTML estáticas são aceitáveis.
- JSDoc completo em toda exportação (`@param`, `@returns`, `@example`,
  `@throws` quando aplicável) + cabeçalho padronizado do arquivo.
- APIs novas: feature detection (`'x' in window`) + fallback + mensagem
  amigável.
- Assíncrono: estados loading/erro/vazio/sucesso visíveis; `AbortController`
  para cancelar; erros com `cause`.
- Acessibilidade: `aria-live` em atualizações dinâmicas, foco visível,
  navegação por teclado, `prefers-reduced-motion`.

## Testes

- Runner: `node:test` + `node:assert/strict` (nunca Jest/Vitest).
- Timers: `mock.timers.enable({ apis: ['setTimeout'] })` — sem espera real.
- `retry` recebe `sleep` por parâmetro (injeção de dependência) — mantenha assim.
- Nomes de teste descritivos em português.
- Casos obrigatórios: normal, borda, erro/lançamento.

## Ao terminar qualquer alteração

1. `npm test` — 100% passando.
2. `npm run lint` — zero erros.
3. Navegar as seções no navegador: console sem erros/warnings.
