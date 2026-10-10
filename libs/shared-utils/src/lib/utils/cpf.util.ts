/**
 * Formata um valor parcial ou completo como máscara progressiva de CPF para
 * exibição durante a digitação. NÃO aplica padding — mostra apenas a parte da
 * máscara correspondente aos dígitos disponíveis.
 *
 * Ignora caracteres não-numéricos e limita a entrada a 11 dígitos.
 *
 * @example
 * formatCpfProgressive('123')         // '123'
 * formatCpfProgressive('1234')        // '123.4'
 * formatCpfProgressive('12345678901') // '123.456.789-01'
 * formatCpfProgressive('abc529xyz')   // '529'
 * formatCpfProgressive(null)          // ''
 */
export function formatCpfProgressive(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Um trecho do dado como aparece mascarado; `oculto` é o que a máscara esconde. */
export interface TrechoMascarado {
  readonly texto: string;
  readonly oculto: boolean;
}

/** Um dado sensível que o titular pode revelar para conferir. */
export interface DadoRevelavel {
  /** A forma mascarada, em trechos. */
  readonly mascarado: readonly TrechoMascarado[];
  /** O que a máscara deixa ver, para o leitor de tela; vazio quando ela oculta tudo. */
  readonly visivel: string;
  /** O dado por extenso; nulo quando não há o que revelar. */
  readonly revelado: string | null;
}

const CPF_TODO_OCULTO: DadoRevelavel = {
  mascarado: [{ texto: '***.***.***-**', oculto: true }],
  visivel: '',
  revelado: null,
};

/**
 * O CPF na máscara do Uni+, `***.999.999-**` (Parecer DPO 002/2026): ficam ocultos os três
 * primeiros dígitos e os verificadores. Sem os 11 dígitos, oculta tudo, sem completar com zeros.
 */
export function cpfRevelavel(cpf: string | null | undefined): DadoRevelavel {
  const digitos = (cpf ?? '').replace(/\D/g, '');
  if (digitos.length !== 11) return CPF_TODO_OCULTO;
  const visivel = `${digitos.slice(3, 6)}.${digitos.slice(6, 9)}`;
  return {
    mascarado: [
      { texto: '***', oculto: true },
      { texto: `.${visivel}-`, oculto: false },
      { texto: '**', oculto: true },
    ],
    visivel,
    revelado: formatCpfProgressive(digitos),
  };
}

/** O CPF mascarado, como texto: `***.999.999-**`. */
export function mascararCpf(cpf: string | null | undefined): string {
  return textoMascarado(cpfRevelavel(cpf));
}

/** A forma mascarada do dado, como texto. */
export function textoMascarado(dado: DadoRevelavel): string {
  return dado.mascarado.map((trecho) => trecho.texto).join('');
}
