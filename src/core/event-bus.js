// @ts-check
/**
 * ARQUIVO: event-bus.js
 * PROPÓSITO: barramento de eventos desacoplado entre módulos (padrão pub/sub sobre EventTarget).
 * CONCEITOS DEMONSTRADOS: EventTarget, CustomEvent, desacoplamento, clean-up.
 * USADO EM: demo 03/05 para acoplar store ↔ UI sem imports circulares.
 * COMPLEXIDADE/OBSERVAÇÕES: estende EventTarget nativo — em vez de reinventar
 *   dispatch/subscribe, aproveitamos a infra do navegador (uma vez testada).
 */

/**
 * Barramento de eventos tipado por nome de string.
 *
 * @example
 * const bus = createEventBus();
 * const remover = bus.on('pedido:criado', (e) => console.log(e.detail));
 * bus.emit('pedido:criado', { id: 1 }); // { id: 1 }
 * remover();
 */
export function createEventBus() {
  const alvo = new EventTarget();

  return {
    /**
     * Escuta um evento do barramento.
     * @param {string} tipo nome do evento
     * @param {(evento: CustomEvent) => void} handler callback (recebe `evento.detail`)
     * @param {AddEventListenerOptions} [opcoes] opções (ex.: { once: true })
     * @returns {() => void} função que remove o listener
     */
    on(tipo, handler, opcoes) {
      /** @type {EventListener} */
      const adaptador = (evento) => handler(/** @type {CustomEvent} */ (evento));
      alvo.addEventListener(tipo, adaptador, opcoes);
      return () => alvo.removeEventListener(tipo, adaptador, opcoes);
    },

    /**
     * Emite um evento com payload (sempre via `detail`).
     * @param {string} tipo nome do evento
     * @param {any} [dados] payload acessível em `evento.detail`
     */
    emit(tipo, dados) {
      alvo.dispatchEvent(new CustomEvent(tipo, { detail: dados }));
    },

    /**
     * Escuta uma vez só (atalho de `on` com { once: true }).
     * @param {string} tipo nome do evento
     * @param {(evento: CustomEvent) => void} handler callback
     */
    once(tipo, handler) {
      this.on(tipo, handler, { once: true });
    },
  };
}
