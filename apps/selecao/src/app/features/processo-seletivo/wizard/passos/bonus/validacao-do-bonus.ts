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

/** O que impede de gravar o bônus declarado, ou nada quando ele pode ser gravado. */
export function validarBonus(bonus: WizardDraft['bonus']): readonly string[] {
  if (bonus.aplica === null) return ['Informe se o processo aplica o bônus regional.'];
  if (!bonus.aplica) return [];

  const messages: string[] = [];

  if (!bonus.regraCodigo) messages.push('Selecione a regra do bônus.');

  const fator = decimalNaForma(bonus.fator);
  if (fator === null || fator <= 0) {
    messages.push('Informe o fator do bônus, maior que zero.');
  } else {
    messages.push(...foraDaPrecisao(bonus.fator, 'O fator do bônus'));
  }

  if (bonus.teto.trim() !== '') {
    const teto = decimalNaForma(bonus.teto);
    if (teto === null || teto <= 0) {
      messages.push('O teto do bônus, quando informado, deve ser maior que zero.');
    } else {
      messages.push(...foraDaPrecisao(bonus.teto, 'O teto do bônus'));
    }
  }

  if (!bonus.baseLegalBonusRegionalId) {
    messages.push('Selecione a base legal do bônus regional.');
  }

  return messages;
}
