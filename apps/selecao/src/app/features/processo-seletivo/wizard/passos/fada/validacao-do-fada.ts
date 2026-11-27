import type { WizardDraft } from '../../processo-seletivo.models';
import { decimalNaForma } from '../../shared/numero-do-campo';

/**
 * O registro guarda fator e teto com dois dígitos inteiros e quatro decimais: teto efetivo de
 * 99,9999. Não é limite arbitrário da tela, é a precisão da coluna, e o servidor recusa o que
 * passa dela.
 *
 * Num certame cuja nota final é em base 100 ou 1000, "teto de 100 pontos" é o primeiro valor que
 * quem monta o edital escreve, e era o que voltava recusado sem que o campo dissesse nada sobre faixa.
 */
const DIGITOS_INTEIROS = 2;
const CASAS_DECIMAIS = 4;

export function foraDaPrecisao(valor: string, rotulo: string): readonly string[] {
  const [inteira = '', decimal = ''] = valor.trim().replace('-', '').replace(',', '.').split('.');
  const problemas: string[] = [];

  if (inteira.replace(/^0+(?=\d)/, '').length > DIGITOS_INTEIROS) {
    problemas.push(`${rotulo} não pode passar de 99,9999 — é a precisão com que ele é guardado.`);
  }
  if (decimal.length > CASAS_DECIMAIS) {
    problemas.push(`${rotulo} aceita no máximo ${CASAS_DECIMAIS} casas decimais.`);
  }

  return problemas;
}

/** O que impede de gravar o FADA declarado, ou nada quando ele pode ser gravado. */
export function validarFada(fada: WizardDraft['fada']): readonly string[] {
  if (fada.aplica === null) return ['Informe se o processo aplica o Fator de Atenuação.'];
  if (!fada.aplica) return [];

  const messages: string[] = [];
  if (!fada.regraCodigo) messages.push('Selecione a regra do Fator de Atenuação.');
  messages.push(...validarFator(fada.fator), ...validarTeto(fada.teto));
  if (!fada.baseLegalDoFadaId) messages.push('Selecione a base legal do Fator de Atenuação.');
  return messages;
}

function validarFator(valor: string): readonly string[] {
  const fator = decimalNaForma(valor);
  if (fator === null || fator <= 0) {
    return ['Informe o multiplicador da nota, maior que zero.'];
  }
  return foraDaPrecisao(valor, 'O multiplicador da nota');
}

function validarTeto(valor: string): readonly string[] {
  if (valor.trim() === '') return [];
  const teto = decimalNaForma(valor);
  if (teto === null || teto <= 0)
    return ['O teto do Fator de Atenuação, quando informado, deve ser maior que zero.'];
  return foraDaPrecisao(valor, 'O teto do Fator de Atenuação');
}
