// @ts-check
/* global self */
/**
 * ARQUIVO: heavy-task.worker.js
 * PROPÓSITO: executar cálculos pesados (primos até um limite e ordenação de
 *   1 milhão de inteiros) FORA da main thread, reportando progresso por mensagens.
 * CONCEITOS DEMONSTRADOS: Web Worker, postMessage/onmessage, structured clone,
 *   trial division, merge sort bottom-up com progresso, performance.now.
 * USADO EM: demo 08 (src/demos/08-web-worker.js) — instanciada com new Worker(
 *   new URL('../../workers/heavy-task.worker.js', import.meta.url)).
 * COMPLEXIDADE/OBSERVAÇÕES: o worker não importa nada do app e não toca em DOM —
 *   ele só fala por mensagens, o que mantém os algoritmos puros e reutilizáveis.
 */

/**
 * @typedef {{ tipo: 'progresso', tarefa: 'primos'|'ordenar', pct: number }} MensagemProgresso
 * @typedef {{ tipo: 'resultado', tarefa: 'primos'|'ordenar', ms: number,
 *   primos?: number, total?: number, itens?: number }} MensagemResultado
 */

// Web Worker: thread paralela com loop de eventos próprio e SEM acesso ao DOM.
// Por que usei aqui: cálculos de segundos não congelam a UI nem a rolagem.

/**
 * Testa primalidade por divisão trial até √n (pura, sem efeitos colaterais).
 *
 * @param {number} n número a testar
 * @returns {boolean} true se `n` for primo
 * @example
 * ehPrimo(97); // true
 */
function ehPrimo(n) {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  const raiz = Math.sqrt(n);
  for (let d = 3; d <= raiz; d += 2) {
    if (n % d === 0) return false;
  }
  return true;
}

/**
 * Conta os primos de 2 até `limite`, publicando progresso a cada ~10%.
 *
 * @param {number} limite topo do intervalo (inclusive)
 * @returns {void} resultado é enviado via postMessage
 */
function calcularPrimos(limite) {
  const inicio = performance.now();
  let contagem = 0;
  let proximoPct = 10;

  for (let n = 2; n <= limite; n++) {
    if (ehPrimo(n)) contagem += 1;
    const pct = (n / limite) * 100;
    if (pct >= proximoPct) {
      /** @type {MensagemProgresso} */
      self.postMessage({ tipo: 'progresso', tarefa: 'primos', pct: proximoPct });
      proximoPct += 10;
    }
  }

  self.postMessage({ tipo: 'progresso', tarefa: 'primos', pct: 100 });
  /** @type {MensagemResultado} */
  self.postMessage({
    tipo: 'resultado',
    tarefa: 'primos',
    primos: contagem,
    total: limite,
    ms: performance.now() - inicio,
  });
}

/**
 * Gera `quantidade` inteiros aleatórios em Int32Array, reportando progresso
 * por fatias (0–50% — metade do trabalho é gerar, a outra é ordenar).
 *
 * @param {number} quantidade quantos inteiros criar
 * @returns {Int32Array} dados pseudoaleatórios prontos para ordenar
 */
function gerarInteiros(quantidade) {
  const dados = new Int32Array(quantidade);
  const fatia = 100_000;
  for (let i = 0; i < quantidade; i++) {
    dados[i] = Math.floor(Math.random() * 2_000_000_000);
    if (i > 0 && i % fatia === 0) {
      self.postMessage({
        tipo: 'progresso',
        tarefa: 'ordenar',
        pct: Math.round((i / quantidade) * 50),
      });
    }
  }
  return dados;
}

/**
 * Merge sort iterativo (bottom-up) sobre Int32Array — O(n log n), estável.
 * Cada passada de largura duplica o trecho ordenado, então dá para reportar
 * progresso honesto entre passadas em vez de "travado aqui…" até o fim.
 *
 * @param {Int32Array} dados array a ordenar (modificado no lugar)
 * @param {(pct: number) => void} aoProgresso callback de progresso (50–100%)
 * @returns {void}
 * @example
 * mergeSort(new Int32Array([3, 1, 2]), (p) => console.log(p));
 */
function mergeSort(dados, aoProgresso) {
  const n = dados.length;
  if (n < 2) return;
  const buffer = new Int32Array(n);
  const totalPassadas = Math.ceil(Math.log2(n));
  let passada = 0;
  let largura = 1;

  while (largura < n) {
    for (let esq = 0; esq < n; esq += 2 * largura) {
      const meio = Math.min(esq + largura, n);
      const dir = Math.min(esq + 2 * largura, n);
      let i = esq;
      let j = meio;
      let k = esq;
      while (i < meio && j < dir) {
        buffer[k++] = dados[i] <= dados[j] ? dados[i++] : dados[j++];
      }
      while (i < meio) buffer[k++] = dados[i++];
      while (j < dir) buffer[k++] = dados[j++];
    }
    dados.set(buffer);
    largura *= 2;
    passada += 1;
    aoProgresso(Math.min(99, 50 + Math.round((passada / totalPassadas) * 50)));
  }
}

/**
 * Gera e ordena `quantidade` inteiros publicando progresso e o resultado.
 *
 * @param {number} quantidade quantos inteiros ordenar
 * @returns {void} resultado é enviado via postMessage
 */
function ordenarInteiros(quantidade) {
  const inicio = performance.now();
  const dados = gerarInteiros(quantidade);
  mergeSort(dados, (pct) => self.postMessage({ tipo: 'progresso', tarefa: 'ordenar', pct }));
  self.postMessage({ tipo: 'progresso', tarefa: 'ordenar', pct: 100 });
  /** @type {MensagemResultado} */
  self.postMessage({
    tipo: 'resultado',
    tarefa: 'ordenar',
    itens: dados.length,
    ms: performance.now() - inicio,
  });
}

/**
 * Ponto de entrada: recebe um comando e despacha para a rotina correspondente.
 * onmessage é o "ouvinte único" do worker — uma única porta de entrada torna o
 * fluxo fácil de rastrear (nada de handlers espalhados competindo por mensagens).
 */
self.onmessage = (evento) => {
  const msg = /** @type {{ tipo?: string, limite?: unknown, itens?: unknown }} */ (evento.data);
  if (!msg || typeof msg.tipo !== 'string') return;

  if (msg.tipo === 'primos') {
    const limite = Number(msg.limite);
    const seguro = Number.isFinite(limite)
      ? Math.min(Math.max(Math.floor(limite), 2), 5_000_000)
      : 2;
    calcularPrimos(seguro);
    return;
  }

  if (msg.tipo === 'ordenar') {
    const informado = Number(msg.itens);
    // Padrão de 1_000_000 quando a mensagem não traz quantidade válida
    const quantidade = Number.isFinite(informado)
      ? Math.min(Math.max(Math.floor(informado), 1), 2_000_000)
      : 1_000_000;
    ordenarInteiros(quantidade);
  }
};
