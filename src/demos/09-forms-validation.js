// @ts-check
/**
 * ARQUIVO: 09-forms-validation.js
 * PROPÓSITO: formulário real com Constraint Validation API (setCustomValidity,
 *   checkValidity, reportValidity), máscaras de CPF/CEP/telefone feitas à mão,
 *   validação ao vivo com debounce, busca de CEP assíncrona cancelável e
 *   coleta de dados com FormData + Object.fromEntries.
 * CONCEITOS DEMONSTRADOS: Constraint Validation API, ValidityState, masks,
 *   debounce, AbortController/sleep, aria-describedby/aria-live/aria-invalid,
 *   FormData, JSON.stringify.
 * USADO EM: seção 09 da landing page (carregada sob demanda via import()).
 * COMPLEXIDADE/OBSERVAÇÕES: cleanup cancela todos os debounces e aborta a
 *   busca de CEP pendente — sem isso timers/requests vazarão após a saída.
 */
import { h, on } from '../core/dom.js';
import { debounce } from '../utils/debounce.js';
import { sleep } from '../utils/sleep.js';
import { isCEP, validateField } from '../utils/validators.js';

/**
 * @typedef {object} ConfigCampo
 * @property {string} id nome do campo (name no form)
 * @property {string} rotulo rótulo visível
 * @property {string} tipo type do input
 * @property {string} regra chave da regra em validateField()
 * @property {boolean} [obrigatorio] se o campo exige conteúdo
 * @property {string} [autocomplete] valor de autocomplete
 * @property {string} [inputmode] teclado numérico/tel no mobile
 * @property {string} [pattern] restrição nativa (alimenta patternMismatch)
 * @property {string} [placeholder] placeholder exemplo
 * @property {(valor: string) => string} [mascara] formatação manual no input
 */

/** Definição dos campos do formulário (dados, não UI). */
const CONFIGS = [
  {
    id: 'nome',
    rotulo: 'Nome',
    tipo: 'text',
    regra: 'required',
    obrigatorio: true,
    autocomplete: 'name',
  },
  {
    id: 'email',
    rotulo: 'E-mail',
    tipo: 'email',
    regra: 'email',
    obrigatorio: true,
    autocomplete: 'email',
    pattern: '[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}',
    placeholder: 'ana@exemplo.com',
  },
  {
    id: 'cpf',
    rotulo: 'CPF',
    tipo: 'text',
    regra: 'cpf',
    inputmode: 'numeric',
    pattern: '\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}',
    placeholder: '000.000.000-00',
    mascara: mascaraCPF,
  },
  {
    id: 'cep',
    rotulo: 'CEP',
    tipo: 'text',
    regra: 'cep',
    autocomplete: 'postal-code',
    inputmode: 'numeric',
    pattern: '\\d{5}-\\d{3}',
    placeholder: '00000-000',
    mascara: mascaraCEP,
  },
  {
    id: 'telefone',
    rotulo: 'Telefone',
    tipo: 'tel',
    regra: 'phone',
    autocomplete: 'tel',
    inputmode: 'tel',
    pattern: '\\(\\d{2}\\) \\d{4,5}-\\d{4}',
    placeholder: '(00) 00000-0000',
    mascara: mascaraTelefone,
  },
  {
    id: 'senha',
    rotulo: 'Senha',
    tipo: 'password',
    regra: 'password',
    autocomplete: 'new-password',
  },
];

/**
 * Requisitos da senha — espelham as regras de isStrongPassword()
 * (validators.js), item a item, para o checklist ao vivo.
 */
const REGRAS_SENHA = [
  { rotulo: 'pelo menos 8 caracteres', teste: (v) => v.length >= 8 },
  { rotulo: '1 letra maiúscula', teste: (v) => /[A-Z]/.test(v) },
  { rotulo: '1 letra minúscula', teste: (v) => /[a-z]/.test(v) },
  { rotulo: '1 número', teste: (v) => /\d/.test(v) },
  { rotulo: '1 símbolo', teste: (v) => /[^A-Za-z0-9]/.test(v) },
];

/**
 * Máscara de CPF — o que é: formata no evento input como 000.000.000-00
 * descartando tudo que não é dígito; por que usei aqui: máscara manual dá
 * controle do caret e ensina a formatação sem dependência externa.
 *
 * @param {string} valor valor bruto do input
 * @returns {string} valor mascarado
 * @example
 * mascaraCPF('52998224725'); // '529.982.247-25'
 */
function mascaraCPF(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Máscara de CEP (00000-000).
 *
 * @param {string} valor valor bruto do input
 * @returns {string} valor mascarado
 * @example
 * mascaraCEP('01310100'); // '01310-100'
 */
function mascaraCEP(valor) {
  return valor
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Máscara de telefone BR — cobre fixo (00) 0000-0000 e celular (00) 00000-0000.
 *
 * @param {string} valor valor bruto do input
 * @returns {string} valor mascarado
 * @example
 * mascaraTelefone('11987654321'); // '(11) 98765-4321'
 */
function mascaraTelefone(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  const comDdd = digitos.replace(/(\d{2})(\d)/, '($1) $2');
  return digitos.length <= 10
    ? comDdd.replace(/(\d{4})(\d{1,4})$/, '$1-$2')
    : comDdd.replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

/**
 * Aplica a máscara preservando o caret de forma simples: se estava no fim,
 * vai para o novo fim; senão desloca pela diferença de comprimento.
 *
 * @param {HTMLInputElement} campo input a formatar
 * @param {(valor: string) => string} mascara função de formatação
 */
function aplicarMascara(campo, mascara) {
  const antes = campo.value;
  const pos = campo.selectionStart ?? antes.length;
  const novo = mascara(antes);
  if (novo === antes) return;
  campo.value = novo;
  const delta = novo.length - antes.length;
  const destino = pos >= antes.length ? novo.length : Math.min(novo.length, pos + delta);
  campo.setSelectionRange(destino, destino);
}

/**
 * Inicializa a demo de formulários e validação acessível.
 *
 * @param {HTMLElement} container elemento da seção (fornecido pelo main.js)
 * @returns {() => void} função de cleanup — cancela debounces e aborta o CEP
 * @example
 * const cleanup = init(document.querySelector('#demo09'));
 * cleanup(); // ao sair da seção
 */
export function init(container) {
  const remocoes = [];
  /** @type {Array<{ cancel: () => void }>} debounces criados (cancelados no cleanup) */
  const debounces = [];
  /** @type {AbortController|null} busca ativa de CEP */
  let controladorCep = null;

  // ── tabela de flags de validade ────────────────────────────────────────────
  // ValidityState é o objeto nativo do input — o que é: flags como valueMissing
  // e patternMismatch; por que usei aqui: mostra "por dentro" da Constraint
  // Validation API sem adivinhar o estado.
  const corpoTabela = h('tbody');
  const tabela = h(
    'table',
    { class: 'tabela-validade' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { scope: 'col', text: 'Campo' }),
        h('th', { scope: 'col', text: 'valueMissing' }),
        h('th', { scope: 'col', text: 'patternMismatch' }),
        h('th', { scope: 'col', text: 'valid' }),
      ),
    ),
    corpoTabela,
  );

  // ── elementos de apoio (CEP, checklist, resumo) ────────────────────────────
  const statusCep = h('p', {
    class: 'nota',
    id: 'f09-cep-status',
    'aria-live': 'polite',
  });

  const itensChecklist = REGRAS_SENHA.map((regra) =>
    h('li', { text: `✗ ${regra.rotulo}`, 'data-ok': 'false' }),
  );
  const checklistSenha = h(
    'ul',
    { class: 'checklist', id: 'f09-senha-checklist', 'aria-label': 'Requisitos da senha' },
    ...itensChecklist,
  );

  const linhaSucesso = h('p', {
    class: 'nota',
    role: 'status',
    'aria-live': 'polite',
    style: 'color:#1a7f37;font-weight:600',
  });
  const resumoJson = h('output', {
    'aria-live': 'polite',
    style:
      'display:block;white-space:pre;background:#f6f8fa;padding:.75rem;' +
      'border-radius:6px;min-height:1.5rem;overflow:auto',
  });

  // ── campos ─────────────────────────────────────────────────────────────────
  /**
   * @typedef {object} EntradaCampo
   * @property {ConfigCampo} config
   * @property {HTMLInputElement} campo
   * @property {HTMLElement} erro
   * @property {((...args: any[]) => any) & { cancel: () => void }} validar
   *   validação ao vivo (debounced 300ms, com cancel())
   * @property {{ vm: HTMLElement, pm: HTMLElement, ok: HTMLElement }} celulas
   */

  /** @type {EntradaCampo[]} */
  const entradas = [];

  const form = h('form', {
    // novalidate: envia SEMPRE ao submit — quem decide a validação é o nosso
    // código (checkValidity/reportValidity), não o balão nativo automático.
    novalidate: true,
    'aria-label': 'Formulário de cadastro (demo de validação)',
  });

  for (const config of CONFIGS) {
    const sufixo = `f09-${config.id}`;
    const erroId = `${sufixo}-erro`;
    const descricao = config.id === 'senha' ? `${erroId} f09-senha-checklist` : erroId;

    const campo = /** @type {HTMLInputElement} */ (
      h('input', {
        id: sufixo,
        name: config.id,
        type: config.tipo,
        required: config.obrigatorio === true,
        autocomplete: config.autocomplete ?? 'off',
        inputmode: config.inputmode,
        pattern: config.pattern,
        placeholder: config.placeholder,
        'aria-describedby': descricao,
      })
    );

    // Erro por campo: aria-describedby liga a mensagem ao input e a região é
    // aria-live para o leitor anunciar a correção sem roubar o foco.
    const erro = h('span', { class: 'erro', id: erroId, 'aria-live': 'polite' });
    const rotulo = h('label', {
      for: sufixo,
      text: config.obrigatorio ? `${config.rotulo} *` : config.rotulo,
    });
    const bloco = h('div', { class: 'campo' }, rotulo, campo, erro);

    if (config.id === 'cep') bloco.append(statusCep);
    if (config.id === 'senha') bloco.append(checklistSenha);

    const celulas = {
      vm: h('td', { text: 'false' }),
      pm: h('td', { text: 'false' }),
      ok: h('td', { text: 'true' }),
    };
    corpoTabela.append(
      h(
        'tr',
        {},
        h('th', { scope: 'row', text: config.rotulo }),
        celulas.vm,
        celulas.pm,
        celulas.ok,
      ),
    );

    /** @type {EntradaCampo} */
    const entrada = {
      config,
      campo,
      erro,
      celulas,
      // A closure só executa em eventos (depois do init), então `entrada`
      // já estará inicializada quando o debounce disparar.
      validar: debounce(() => validarCampo(entrada), 300),
    };
    debounces.push(entrada.validar);
    entradas.push(entrada);

    remocoes.push(
      on(campo, 'input', () => {
        if (config.mascara) aplicarMascara(campo, config.mascara);
        // Flags lidas na hora (input), validação do negócio em 300ms (debounce)
        atualizarLinhaTabela(entrada);
        entrada.validar();
        if (config.id === 'cep') agendaBuscaCep();
        if (config.id === 'senha') atualizarChecklist();
      }),
      on(campo, 'blur', () => validarCampo(entrada)),
    );

    form.append(bloco);
  }

  const porId = new Map(entradas.map((entrada) => [entrada.config.id, entrada]));
  const campoCep = /** @type {HTMLInputElement} */ (porId.get('cep')?.campo);
  const campoSenha = /** @type {HTMLInputElement} */ (porId.get('senha')?.campo);

  // ── núcleo de validação ────────────────────────────────────────────────────
  /**
   * Valida um campo e injeta o resultado na Constraint Validation API:
   * setCustomValidity('') limpa; setCustomValidity('texto') marca inválido e
   * vira a mensagem exibida por reportValidity()/balão nativo.
   *
   * @param {EntradaCampo} entrada campo a validar
   * @returns {boolean} true se válido
   */
  function validarCampo(entrada) {
    const { config, campo } = entrada;
    const valor = campo.value;
    const resultado =
      valor.trim() === ''
        ? config.obrigatorio
          ? validateField('required', valor)
          : { valido: true, mensagem: '' }
        : validateField(config.regra, valor);

    // Só uma string NÃO vazia invalida o campo: como isStrongPassword devolve
    // "Senha forte." até quando passa, guardamos mensagem só quando FALHA.
    campo.setCustomValidity(resultado.valido ? '' : resultado.mensagem);
    if (resultado.valido) {
      campo.removeAttribute('aria-invalid');
    } else {
      campo.setAttribute('aria-invalid', 'true');
    }
    entrada.erro.textContent = resultado.valido ? '' : resultado.mensagem;
    atualizarLinhaTabela(entrada);
    return resultado.valido;
  }

  /**
   * Atualiza uma linha da tabela lendo o ValidityState real do input.
   *
   * @param {EntradaCampo} entrada cuja linha atualizar
   */
  function atualizarLinhaTabela(entrada) {
    const { validity } = entrada.campo;
    entrada.celulas.vm.textContent = String(validity.valueMissing);
    entrada.celulas.pm.textContent = String(validity.patternMismatch);
    entrada.celulas.ok.textContent = String(validity.valid);
  }

  /** Recalcula todas as linhas da tabela. */
  function atualizarTabela() {
    for (const entrada of entradas) atualizarLinhaTabela(entrada);
  }

  /** Marca/desmarca item a item do checklist de senha. */
  function atualizarChecklist() {
    const valor = campoSenha?.value ?? '';
    REGRAS_SENHA.forEach((regra, indice) => {
      const ok = regra.teste(valor);
      const item = itensChecklist[indice];
      item.textContent = `${ok ? '✓' : '✗'} ${regra.rotulo}`;
      item.setAttribute('data-ok', String(ok));
    });
  }

  // ── busca de CEP (assíncrona e cancelável) ─────────────────────────────────
  /**
   * Simula consulta de CEP: 400 ms de latência com sleep cancelável — o que é:
   * AbortController aborta a Promise em andamento; por que usei aqui: sem ele,
   * uma resposta antiga poderia sobrescrever a de um CEP mais recente (race).
   */
  function agendaBuscaCep() {
    controladorCep?.abort();
    const valor = campoCep?.value ?? '';
    if (valor.trim() === '') {
      statusCep.textContent = '';
      return;
    }
    // Só consulta quando o formato é válido (isCEP) — consulta parcial é ruído
    if (!isCEP(valor)) {
      statusCep.textContent = 'CEP incompleto — continue digitando.';
      return;
    }
    controladorCep = new AbortController();
    const { signal } = controladorCep;
    statusCep.textContent = 'consultando CEP…';
    sleep(400, { signal })
      .then(() => {
        if (signal.aborted) return;
        const digitos = valor.replace(/\D/g, '');
        statusCep.textContent =
          `endereço simulado: Rua X, nº ${Number(digitos.slice(-4)) || 0} — ` +
          `Bairro Mock (${digitos.slice(0, 5)}-${digitos.slice(5)}), 400 ms`;
      })
      .catch((erro) => {
        // AbortError é esperado quando o usuário digita de novo — não é falha
        if (erro instanceof Error && erro.name === 'AbortError') return;
        statusCep.textContent = 'falha ao consultar o CEP (tente novamente).';
      });
  }

  // ── submit / reset ─────────────────────────────────────────────────────────
  const resumoTitulo = h('p', { class: 'nota', text: 'Dados coletados (JSON):' });
  const botaoEnviar = h('button', { type: 'submit', text: 'Enviar (reportValidity)' });
  const botaoLimpar = h('button', { type: 'button', text: 'Limpar', on: { click: limparTudo } });
  // Botões DENTRO do <form>: um botão submit fora dele não dispara submit
  form.append(h('div', { class: 'botoes' }, botaoEnviar, botaoLimpar));

  remocoes.push(
    on(form, 'submit', (evento) => {
      evento.preventDefault();
      let primeiroInvalido = null;
      for (const entrada of entradas) {
        const ok = validarCampo(entrada);
        if (!ok && primeiroInvalido === null) primeiroInvalido = entrada.campo;
      }

      if (form.checkValidity()) {
        // FormData + Object.fromEntries: coleta { nome, email, ... } sem
        // ficar lendo campo por campo no DOM.
        const dados = Object.fromEntries(new FormData(form));
        resumoJson.textContent = JSON.stringify(dados, null, 2);
        linhaSucesso.textContent = '✓ Formulário válido! Dados coletados com FormData.';
        return;
      }

      linhaSucesso.textContent = '';
      resumoJson.textContent = '';
      // reportValidity: mostra o balão nativo no 1º inválido e move o foco
      form.reportValidity();
      primeiroInvalido?.focus();
    }),
  );

  function limparTudo() {
    form.reset();
    controladorCep?.abort();
    controladorCep = null;
    for (const entrada of entradas) {
      entrada.validar.cancel();
      entrada.campo.setCustomValidity('');
      entrada.campo.removeAttribute('aria-invalid');
      entrada.erro.textContent = '';
    }
    statusCep.textContent = '';
    linhaSucesso.textContent = '';
    resumoJson.textContent = '';
    atualizarChecklist();
    atualizarTabela();
    entradas[0]?.campo.focus();
  }

  // ── montagem ───────────────────────────────────────────────────────────────
  const dica = h('p', {
    class: 'nota',
    text:
      'CPF válido de teste: 529.982.247-25 · CEP: 01310-100 · ' +
      'a validação ao vivo usa debounce(300ms) e as mensagens entram via setCustomValidity.',
  });

  const painel = h(
    'div',
    { class: 'linha' },
    h('h3', { text: 'Formulário com Constraint Validation API' }),
    h('div', { class: 'grade' }, form, h('div', {}, h('h4', { text: 'ValidityState' }), tabela)),
    linhaSucesso,
    resumoTitulo,
    resumoJson,
    dica,
  );

  container.append(painel);

  atualizarChecklist();
  atualizarTabela();

  // Cleanup: cancela timers dos debounces e aborta busca de CEP pendente.
  return () => {
    for (const remover of remocoes) remover();
    for (const deb of debounces) deb.cancel();
    controladorCep?.abort();
    controladorCep = null;
  };
}
