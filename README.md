# Perfect JavaScript Example

[![Licença MIT](https://img.shields.io/badge/licença-MIT-blue.svg)](LICENSE)
[![JavaScript ES2023](https://img.shields.io/badge/JavaScript-ES2023-F7DF1E?logo=javascript&logoColor=black)](https://tc39.es/)
[![Zero dependências](https://img.shields.io/badge/dependências-runtime-0-brightgreen.svg)](#decisões-técnicas)
[![Testes](https://img.shields.io/badge/testes-node%3Atest-2080FF.svg)](#como-rodar-os-testes)

**🚀 Demo ao vivo (GitHub Pages):** `https://roldan-eng-software.github.io/Perfect-JavaScript-example/`

![Screenshot / GIF do projeto](docs/screenshot-placeholder.gif)

> Portfólio técnico interativo: uma landing page construída **do zero** com
> JavaScript puro (ES2023+), HTML semântico e CSS enxuto — **sem frameworks,
> sem bibliotecas em runtime, sem bundler**. Cada seção é uma demonstração
> funcional e mostra o **código-fonte real** que a implementa.

---

## O que este projeto demonstra

- **Arquitetura modular** com ES Modules nativos e separação em camadas
  (`core` / `utils` / `components` / `demos`), sem dependências circulares.
- **Assíncronismo**: `async/await`, todos os combinadores de `Promise`,
  `AbortController`, retry com backoff exponencial.
- **Ciclo de vida de UI**: cada demo exporta `init(container)` → `cleanup()`,
  com lazy loading por `import()` dinâmico e IntersectionObserver.
- **Web Components**: `<code-peek>` (com realce de sintaxe próprio, sem
  biblioteca), `<demo-card>`, `<toast-notification>`, `<theme-toggle>`,
  `<accessible-tabs>` — Custom Elements + Shadow DOM.
- **Desempenho**: debounce/throttle medidos, virtualização de lista com
  10.000 itens, Web Worker com barra de progresso e cancelamento,
  `performance.mark/measure`.
- **Acessibilidade (WCAG 2.2 AA)**: navegação por teclado completa, foco
  visível, `aria-live` nas atualizações dinâmicas, `prefers-reduced-motion`
  respeitado, abas no padrão WAI-ARIA.
- **Testes**: 80+ casos com o runner nativo do Node (`node:test`), incluindo
  `mock.timers` para debounce/throttle — suíte completa em < 1s.
- **i18n sem biblioteca**: `Intl.NumberFormat`, `DateTimeFormat`,
  `RelativeTimeFormat`, `ListFormat`, `PluralRules`, `Collator`.

## Arquitetura

```text
Perfect-JavaScript-example/
├── index.html              ← landing semântica e acessível (entrada)
├── package.json            ← scripts; "type": "module"; só devDependencies
├── eslint.config.js        ← lint (ESLint flat) + .prettierrc + .editorconfig
├── css/
│   └── styles.css          ← tema claro (padrão) / escuro / sistema (variáveis CSS), mobile-first
├── data/
│   ├── projects.json       ← dados para demos de fetch
│   └── quotes.json
├── src/
│   ├── main.js             ← bootstrap: i18n, router, scroll spy, LAZY loading das demos
│   ├── core/               ← infra: dom, store reativa, event-bus, router,
│   │                          storage seguro, logger com níveis, i18n (en-US/pt-BR)
│   ├── utils/              ← funções PURAS e testáveis: debounce, throttle,
│   │                          memoize, compose/pipe/curry, retry, sleep,
│   │                          deep-clone, format (Intl), validators, highlight
│   ├── components/         ← Web Components (Shadow DOM): code-peek,
│   │                          demo-card, toast, theme-toggle, accessible-tabs
│   └── demos/              ← 13 demonstrações; cada uma exporta init → cleanup
├── workers/
│   └── heavy-task.worker.js ← cálculo pesado fora da main thread
├── tests/                  ← node:test (10 arquivos, 90+ casos)
└── docs/
    ├── ARCHITECTURE.md     ← diagrama mermaid + ciclo de vida das demos
    └── JS-TECHNIQUES.md    ← tabela: técnica | arquivo | por quê | suporte
```

Detalhes no [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Decisões técnicas

| Decisão                                 | Por quê                                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ES Modules nativos**                  | O navegador já resolve imports — zero build significa menos ferramenta quebrando, deploy direto no GitHub Pages e código que é exatamente o que roda. |
| **Zero dependências de runtime**        | O que o projeto ensina (debounce, store, validação, i18n) não precisa de npm para existir; `npm install` traz apenas ESLint e Prettier (dev).         |
| **`init()` + cleanup em cada demo**     | Seções entram e saem da viewport; sem cleanup, listeners/timers/observers vazarão. O padrão torna o ciclo de vida explícito e testável.               |
| **en-US como padrão + botão pt-BR**     | Audiência internacional lê inglês; o toggle no topo persiste a escolha e as demos são re-inicializadas na troca (strings lidas no `init`).            |
| **Tema claro prioritário**              | Claro é o default da landing; escuro e "do sistema" são opt-in explícito do visitante — sem dark automático só porque o SO está escuro.               |
| **Web Components**                      | Componentes reutilizáveis com encapsulamento real (Shadow DOM) e compatibilidade com qualquer framework — sem escolher um.                            |
| **`<code-peek>` mostra o arquivo real** | O recrutador vê o mesmo código que roda (fetch do repositório), não uma cópia colada que pode divergir.                                               |
| **Tokenizador próprio de sintaxe**      | Um mini-tokenizador puro (~150 linhas) com testes demonstra mais do que adicionar `highlight.js`.                                                     |
| **`node:test` em vez de Jest/Vitest**   | Runner nativo, zero instalação, `mock.timers` cobre timers; alinhado à filosofia "sem dependências".                                                  |
| **Hash router + History API**           | GitHub Pages não permite rewrite de rotas; `#rota` dá deep links sem servidor configurado.                                                            |
| **storage com fallback em memória**     | Safari private mode e quota cheia lançam erro — a API única evita `try/catch` espalhado pela UI.                                                      |

## Compatibilidade de navegadores

| API                                                        | Suporte                                 | Fallback no projeto                                       |
| ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| ES Modules, optional chaining, `??`                        | Todos os atuais (2020+)                 | —                                                         |
| `structuredClone`, `Promise.allSettled`, `AbortController` | 2021+                                   | `deepClone` recursivo quando ausente                      |
| `Array.toSorted/toSpliced/with`, `findLast`                | 2023+                                   | Comentado nas demos; nada quebra sem elas                 |
| `Object.groupBy`/`Map.groupBy`                             | 2024+                                   | Reduce manual detectado por `'Object.groupBy' in Object`  |
| Iterator helpers                                           | 2025+                                   | Generator manual detectado por feature detection          |
| `requestIdleCallback`                                      | Chrome/FF; Safari 17+                   | `setTimeout(…, 1)` rotulado                               |
| `BroadcastChannel`                                         | Safari 15.4+                            | Canal nulo (`?? null`) — demos seguem sem sync entre abas |
| `<dialog>.showModal`                                       | Safari 15.4+                            | Atributo `open`                                           |
| Clipboard API                                              | Só em contexto seguro (HTTPS/localhost) | Mensagem orientando; `file://` mostra aviso               |
| Web Share / Notification                                   | Parciais (mobile / permissão)           | Sempre opt-in com mensagem de indisponibilidade           |
| **IE11**                                                   | ❌ Não suportado (não tem ES Modules)   | —                                                         |

## Como rodar

```bash
git clone https://github.com/roldan-eng-software/Perfect-JavaScript-example.git
cd Perfect-JavaScript-example
npm install        # só devDependencies (ESLint + Prettier)
npm run serve      # http://localhost:5173
```

> ⚠️ **Não abra via `file://`.** ES Modules e `fetch` são bloqueados pelo
> navegador em arquivos locais. Use `npm run serve` (ou o GitHub Pages).
> Se algum `<code-peek>` não carregar, a página mostra um aviso amigável com
> essa orientação.

## Como rodar os testes

```bash
npm test        # node --test tests/  (9 arquivos, 80+ casos)
npm run lint    # ESLint flat config
npm run format  # Prettier
```

Os testes cobrem, em casos normais, de borda e de erro: debounce e throttle
(com `mock.timers` — sem espera real), memoize, compose/pipe/curry, retry
(sucesso, falha total, backoff, abort), store (subscribe/unsubscribe),
validators (CPF com dígito verificador real), format (Intl) e o tokenizador
do `<code-peek>`.

## Checklist de qualidade

- [x] Zero dependências de runtime (`npm install` → só devDependencies)
- [x] `npm run lint` e `npm test` sem erros
- [x] Sem variáveis globais, sem `var`, sem `eval`, sem `innerHTML` dinâmico
- [x] Cabeçalho padronizado + JSDoc em todo arquivo JS
- [x] Toda demo: `init()` com cleanup funcional (listeners/timers/abort)
- [x] Toda demo com `<code-peek>` carregando o código real do arquivo
- [x] Estados de loading/erro/vazio tratados nas demos assíncronas
- [x] Teclado completo, foco visível, `aria-live`, `prefers-reduced-motion`
- [x] Feature detection + fallback em APIs novas
- [x] Responsivo de 320px a 1920px
- [x] Console limpo ao navegar por todas as seções
- [x] **en-US por padrão** com alternância para pt-BR (botão no topo, persistida)
- [x] **Tema claro é o padrão**; escuro e "do sistema" são opções do visitante

## Sobre o autor

**Roldan Eng Software** — Engenheiro de Software focado em Front-end.

- 🌐 Website: `https://chegounaweb.vercel.app/`
- 🔗 GitHub: `https://github.com/roldan-eng-software`
- 💼 LinkedIn: `https://www.linkedin.com/in/sandro-roldan-b8721a3b5`
- 📧 E-mail: `roldan.eng.software@gmail.com`

## Licença

Distribuído sob a licença [MIT](LICENSE).
