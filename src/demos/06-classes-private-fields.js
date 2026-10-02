// @ts-check
/**
 * ARQUIVO: 06-classes-private-fields.js
 * PROPÓSITO: demonstrar OO moderno — campos privados #, getter/setter com
 *   validação, static block, herança, mixin vs fábrica, Symbol oculto e
 *   WeakMap como alternativa "à moda antiga" aos campos privados.
 * CONCEITOS DEMONSTRADOS: private fields (#), getters/setters, static + static
 *   block, extends/super/instanceof, mixin (ComLogavel), factory function,
 *   Symbol/Object.getOwnPropertySymbols, WeakMap.
 * USADO EM: seção 06 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: painéis interativos — cada botão acrescenta uma
 *   linha (textContent) num output com aria-live; cleanup remove listeners.
 */
import { h, on } from '../core/dom.js';

/**
 * Inicializa a demo de classes e OO moderno.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — remove listeners criados via on()
 * @example
 * const cleanup = init(document.querySelector('#demo06'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];

  // Anexa uma linha de resultado a um output (aria-live) — nunca innerHTML
  /**
   * @param {HTMLElement} output elemento que acumula resultados
   * @param {string} texto linha a acrescentar
   */
  function anexar(output, texto) {
    output.append(h('div', { class: 'saida-linha', text: texto }));
    output.scrollTop = output.scrollHeight;
  }

  /**
   * Executa uma função e devolve "resultado" ou "erro: msg" — os painéis usam
   * isso para mostrar validações que lançam exceção sem derrubar a demo.
   *
   * @param {() => any} fn função a executar
   * @returns {string} texto do resultado ou do erro capturado
   */
  function executar(fn) {
    try {
      const valor = fn();
      return typeof valor === 'string' ? valor : JSON.stringify(valor);
    } catch (erro) {
      return `erro: ${erro instanceof Error ? erro.message : String(erro)}`;
    }
  }

  // ── a) Classe com campos privados #, validação e static block ─────────────
  // O que é: # é encapsulamento REAL (sintaxe da linguagem), não convenção de
  // nome — nada fora da classe alcança o campo. Por que usei aqui: conta
  // bancária é o exemplo clássico de estado que não pode ser forjado de fora.
  class ContaBancaria {
    /** Registry estático: existe UMA vez por classe, compartilhado por todas. */
    static registros = [];

    static {
      // static block (ES2022): roda na DEFINIÇÃO da classe — boot/config limpos
      ContaBancaria.registros.push({ tipo: 'modelo', titular: 'sistema' });
    }

    #saldo;
    #titular;

    /**
     * @param {string} titular nome do dono
     * @param {number} [saldoInicial] saldo de abertura (>= 0)
     */
    constructor(titular, saldoInicial = 0) {
      if (typeof titular !== 'string' || titular.trim() === '') {
        throw new TypeError('titular é obrigatório');
      }
      if (saldoInicial < 0) throw new RangeError('saldo inicial não pode ser negativo');
      this.#titular = titular;
      this.#saldo = saldoInicial;
      ContaBancaria.registros.push({ tipo: 'conta', titular });
    }

    /** Getter valida invariantes: saldo negativo é corrompido, nunca válido. */
    get saldo() {
      if (this.#saldo < 0) throw new RangeError('saldo corrompido: negativo');
      return this.#saldo;
    }

    /** Setter rejeita escrita inválida — encapsulamento com validação. */
    set saldo(novo) {
      if (typeof novo !== 'number' || !Number.isFinite(novo) || novo < 0) {
        throw new RangeError('saldo deve ser um número finito >= 0');
      }
      this.#saldo = novo;
    }

    /**
     * @param {number} valor valor a depositar
     * @returns {number} novo saldo
     */
    depositar(valor) {
      if (valor <= 0) throw new RangeError('deposito deve ser positivo');
      this.#saldo += valor;
      return this.saldo;
    }

    /**
     * @param {number} valor valor a sacar
     * @returns {number} novo saldo
     */
    sacar(valor) {
      if (valor > this.#saldo) throw new Error('saldo insuficiente');
      this.#saldo -= valor;
      return this.saldo;
    }

    /** @returns {string} resumo legível (sobrescrito na subclasse) */
    resumir() {
      return `${this.#titular}: R$ ${this.saldo.toFixed(2)}`;
    }

    /** Método estático: pertence à CLASSE, não à instância. */
    static descreverRegistro() {
      return `${ContaBancaria.registros.length} registros no registry estático`;
    }
  }

  // ── b) Herança: ContaPoupanca extends + override + instanceof ─────────────
  class ContaPoupanca extends ContaBancaria {
    #taxaJuros;

    /**
     * @param {string} titular nome do dono
     * @param {number} [saldoInicial] saldo de abertura
     * @param {number} [taxaJuros] taxa por aplicação (ex.: 0.005 = 0,5%)
     */
    constructor(titular, saldoInicial = 0, taxaJuros = 0.005) {
      super(titular, saldoInicial); // herança: construtor da Base primeiro
      this.#taxaJuros = taxaJuros;
    }

    aplicaJuros() {
      return this.depositar(this.saldo * this.#taxaJuros);
    }

    /** Override: mesma assinatura, comportamento específico da poupança. */
    resumir() {
      return `Poupança de ${super.resumir()}`;
    }
  }

  const saidaContas = h('output', { class: 'saida', 'aria-live': 'polite' });
  const btnContas = h('button', {
    type: 'button',
    text: 'Executar conta bancária',
    on: {
      click: () => {
        anexar(
          saidaContas,
          executar(() => {
            const conta = new ContaBancaria('Ana', 100);
            conta.depositar(50);
            const linhas = [
              `deposito R$50 → ${conta.resumir()}`,
              `sacar R$30 → saldo ${conta.sacar(30).toFixed(2)}`,
              executar(() => {
                conta.saldo = -1;
                return 'saldo aceito?!';
              }),
              executar(() => new ContaBancaria('', 0)),
              `static: ${ContaBancaria.descreverRegistro()}`,
            ];
            return linhas.join(' · ');
          }),
        );
      },
    },
  });

  const btnHeranca = h('button', {
    type: 'button',
    text: 'Executar herança',
    on: {
      click: () => {
        anexar(
          saidaContas,
          executar(() => {
            const poupanca = new ContaPoupanca('Bia', 1000, 0.01);
            poupanca.aplicaJuros();
            const comum = new ContaBancaria('Caio', 10);
            return [
              poupanca.resumir(),
              `poupanca instanceof ContaBancaria: ${poupanca instanceof ContaBancaria}`,
              `poupanca instanceof ContaPoupanca: ${poupanca instanceof ContaPoupanca}`,
              `comum instanceof ContaPoupanca: ${comum instanceof ContaPoupanca}`,
              `override resumir(): base="${comum.resumir()}" sub="${poupanca.resumir()}"`,
            ].join(' · ');
          }),
        );
      },
    },
  });

  const painelClasses = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'a) Private fields # + validação + static block' }),
    h('div', { class: 'botoes' }, btnContas, btnHeranca),
    saidaContas,
    h('p', {
      class: 'nota',
      text: '#saldo/#titular são inacessíveis fora da classe; o static block popula o registry na definição (mostrado pelo método estático).',
    }),
  );

  // ── c) Mixin vs fábrica: dois caminhos de reuso ───────────────────────────
  // O que é: mixin é uma FUNÇÃO que recebe uma Base e devolve uma classe com
  // comportamento extra. Por que usei aqui: reuso sem herança múltipla (que o
  // JS não tem) — comparado lado a lado com factory, que devolve objeto puro.
  /**
   * @param {any} Base classe a estender
   * @returns {any} nova classe com log() e histórico
   */
  function ComLogavel(Base) {
    return class extends Base {
      #historico = [];
      /**
       * @param {string} mensagem texto do log
       * @returns {string} linha registrada
       */
      log(mensagem) {
        const linha = `[${new Date().toLocaleTimeString('pt-BR')}] ${mensagem}`;
        this.#historico.push(linha);
        return linha;
      }
      /** @returns {string[]} cópia do histórico (imutável por fora) */
      get historico() {
        return [...this.#historico];
      }
    };
  }

  /**
   * O que é: factory devolve um OBJETO pronto (sem prototype de classe). Por
   * que usei aqui: contraste — mesmo resultado, sem herança/instanceof.
   *
   * @param {string} titular nome do dono
   * @param {number} [saldoInicial] saldo de abertura
   * @returns {object} conta com depositar/saldo/resumir
   */
  function criarConta(titular, saldoInicial = 0) {
    let saldo = saldoInicial; // estado fechado na closure, privado de verdade
    return {
      titular,
      depositar(valor) {
        saldo += valor;
        return saldo;
      },
      get saldo() {
        return saldo;
      },
      resumir() {
        return `Fábrica — ${titular}: R$ ${saldo.toFixed(2)}`;
      },
    };
  }

  const saidaMix = h('div', { class: 'grade' });
  const saidaMixin = h('output', { class: 'saida', 'aria-live': 'polite' });
  const saidaFactory = h('output', { class: 'saida', 'aria-live': 'polite' });
  saidaMix.append(
    h('p', { class: 'nota', text: 'mixin (classe estendida):' }),
    saidaMixin,
    h('p', { class: 'nota', text: 'factory (objeto puro):' }),
    saidaFactory,
  );

  const btnMistura = h('button', { type: 'button', text: 'Comparar mixin vs fábrica' });
  // Listener explícito via on(): fica registrado em `remocoes` e é removido no cleanup
  remocoes.push(
    on(btnMistura, 'click', () => {
      const ContaLogavel = ComLogavel(ContaBancaria);
      const logavel = new ContaLogavel('Davi', 200);
      anexar(
        saidaMixin,
        executar(() => {
          logavel.depositar(20);
          logavel.log('deposito feito');
          return [
            logavel.resumir(),
            `log: ${logavel.log('segunda entrada')}`,
            `histórico: ${logavel.historico.length} linhas`,
            `instanceof ContaBancaria: ${logavel instanceof ContaBancaria}`,
          ].join(' · ');
        }),
      );
      const conta = criarConta('Eva', 200);
      anexar(
        saidaFactory,
        executar(() => {
          conta.depositar(20);
          return [
            conta.resumir(),
            `sem prototype de classe: ${Object.getPrototypeOf(conta) === Object.prototype}`,
            `Object.keys: ${Object.keys(conta).join(', ')}`,
          ].join(' · ');
        }),
      );
    }),
  );

  const painelMistura = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'c) Mixin (ComLogavel) vs factory (criarConta)' }),
    h('div', { class: 'botoes' }, btnMistura),
    saidaMix,
    h('p', {
      class: 'nota',
      text: 'Mesma capacidade de reuso: mixin herda via prototype (instanceof funciona); factory fecha o estado em closure (sem instanceof).',
    }),
  );

  // ── d) Symbol: chave única para "propriedade oculta" ──────────────────────
  // O que é: Symbol é um identificador único e imutável — não colide e não
  // aparece em Object.keys/JSON. Por que usei aqui: esconder um método
  // interno sem poluir a superfície pública do objeto.
  const METODO_INTERNO = Symbol('metodoInterno');

  const saidaSymbol = h('output', { class: 'saida', 'aria-live': 'polite' });
  const btnSymbol = h('button', {
    type: 'button',
    text: 'Mostrar Symbol oculto',
    on: {
      click: () => {
        anexar(
          saidaSymbol,
          executar(() => {
            const objeto = {
              nome: 'painel',
              [METODO_INTERNO]: () => 'segredo',
            };
            return [
              `Object.keys: ${Object.keys(objeto).join(', ')}`,
              `JSON: ${JSON.stringify(objeto)}`,
              `símbolos: ${Object.getOwnPropertySymbols(objeto).map(String).join(', ')}`,
              `chamada interna: ${objeto[METODO_INTERNO]()}`,
            ].join(' · ');
          }),
        );
      },
    },
  });

  const painelSymbol = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'd) Symbol como chave oculta' }),
    h('div', { class: 'botoes' }, btnSymbol),
    saidaSymbol,
    h('p', {
      class: 'nota',
      text: 'Object.getOwnPropertySymbols revela o que Object.keys e JSON escondem.',
    }),
  );

  // ── e) WeakMap: dados privados sem sintaxe de classe ──────────────────────
  const dadosContador = new WeakMap();

  class Contador {
    constructor() {
      dadosContador.set(this, { valor: 0 });
    }
    /** @returns {number} valor incrementado */
    inc() {
      const estado = dadosContador.get(this);
      if (!estado) throw new Error('contador não inicializado');
      estado.valor += 1;
      return estado.valor;
    }
    /** @returns {number} valor atual */
    get valor() {
      return dadosContador.get(this)?.valor ?? 0;
    }
  }

  const saidaWeak = h('output', { class: 'saida', 'aria-live': 'polite' });
  const btnWeak = h('button', {
    type: 'button',
    text: 'Executar contador WeakMap',
    on: {
      click: () => {
        anexar(
          saidaWeak,
          executar(() => {
            const contador = new Contador();
            contador.inc();
            contador.inc();
            contador.inc();
            return [
              `valor: ${contador.valor}`,
              `Object.keys: [${Object.keys(contador).join(', ')}] (nada vaza)`,
              `WeakMap tem o estado: ${dadosContador.has(contador)}`,
            ].join(' · ');
          }),
        );
      },
    },
  });

  const painelWeak = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'e) WeakMap: privacidade "à moda antiga"' }),
    h('div', { class: 'botoes' }, btnWeak),
    saidaWeak,
    h('p', {
      class: 'nota',
      text: 'Comparado com # na seção (a): mesmo resultado — mas aqui o estado vive FORA do objeto e não aparece em Object.keys.',
    }),
  );

  container.append(painelClasses, painelMistura, painelSymbol, painelWeak);

  // Cleanup: listeners criados via h({on}) morrem junto com o container removido;
  // o listener explícito de btnMistura (via on()) é removido aqui de propósito.
  return () => {
    for (const remover of remocoes) remover();
  };
}
