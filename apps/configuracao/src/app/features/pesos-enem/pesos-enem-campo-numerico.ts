import { AbstractControl, ValidatorFn } from '@angular/forms';
import { formatarNumeroPtBr } from '@uniplus/shared-utils';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import {
  CASAS_CORTE,
  CASAS_PESO,
  CORTE_MAXIMO,
  PESO_MAXIMO,
  type CampoDaArea,
} from './pesos-enem-limites';

/** Casas decimais de um número, inclusive na notação exponencial (ex.: 1.5e-7). */
function casasDecimais(valor: number): number {
  const [mantissa = '', expoente = '0'] = String(valor).toLowerCase().split('e');
  const decimaisDaMantissa = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, decimaisDaMantissa - Number(expoente));
}

/** Recusa valor com mais casas decimais do que a coluna guarda: sem isso, a tela mostraria o
 *  número digitado e o backend gravaria outro, arredondado. */
export function maximoDeCasasDecimais(maximo: number): ValidatorFn {
  return (control) => {
    const valor: unknown = control.value;
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      return null;
    }
    return casasDecimais(valor) > maximo ? { casasDecimais: { maximo } } : null;
  };
}

type MensagemPorCampo = Readonly<Record<CampoDaArea, string>>;

/** As regras próprias do campo numérico, na ordem em que a mensagem é escolhida. */
const REGRAS_DO_CAMPO: readonly (readonly [string, MensagemPorCampo])[] = [
  ['numeroInvalido', { peso: 'Número inválido.', corte: 'Número inválido.' }],
  ['min', { peso: 'O peso não pode ser negativo.', corte: 'O corte não pode ser negativo.' }],
  [
    'max',
    {
      peso: `O peso não pode exceder ${formatarNumeroPtBr(PESO_MAXIMO)}.`,
      corte: `O corte não pode exceder ${formatarNumeroPtBr(CORTE_MAXIMO)}.`,
    },
  ],
  [
    'casasDecimais',
    {
      peso: `O peso aceita no máximo ${CASAS_PESO} casas decimais.`,
      corte: `O corte aceita no máximo ${CASAS_CORTE} casas decimais.`,
    },
  ],
];

/**
 * A mensagem do campo de peso ou de corte, só depois de tocado ou editado. A recusa do
 * servidor vale mais que as regras locais. Texto ainda incompleto ("2,", "1e") deixa o campo
 * inválido mas não diz nada até o operador terminar, nem "Campo obrigatório.", que o valor
 * vazio causaria.
 */
export function mensagemDoCampoNumerico(
  control: AbstractControl,
  campo: CampoDaArea,
): string | null {
  const erros = control.errors;
  if (erros === null || erros['backend']) {
    return mensagemDeErroDoControle(control);
  }
  if (!(control.touched || control.dirty) || erros['digitacaoIncompleta']) {
    return null;
  }
  const regra = REGRAS_DO_CAMPO.find(([erro]) => erros[erro]);
  return regra === undefined ? mensagemDeErroDoControle(control) : regra[1][campo];
}
