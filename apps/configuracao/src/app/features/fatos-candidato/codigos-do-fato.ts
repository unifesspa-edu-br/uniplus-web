import { FormControl } from '@angular/forms';
import {
  QuantidadeDeValoresCodigo,
  FonteValoresFatoCodigo,
  TipoDoDadoCodigo,
} from '@uniplus/shared-data/configuracao';
import { codigoDoContrato } from '@uniplus/shared-data/utils';

/**
 * Os controles do formulário guardam o código escolhido como texto, porque as opções vêm da
 * própria API; aqui o texto volta a ser o código que o pedido exige.
 */
export const tipoDoDadoEscolhido = (valor: string): TipoDoDadoCodigo =>
  codigoDoContrato(TipoDoDadoCodigo, valor) ?? codigoInvalido();

export const quantidadeEscolhida = (valor: string): QuantidadeDeValoresCodigo =>
  codigoDoContrato(QuantidadeDeValoresCodigo, valor) ?? codigoInvalido();

/** Sem fonte escolhida o texto é vazio, e o pedido leva a ausência. */
export const fonteEscolhida = (valor: string): FonteValoresFatoCodigo | null =>
  valor === '' ? null : (codigoDoContrato(FonteValoresFatoCodigo, valor) ?? codigoInvalido());

/** O controle da quantidade de valores: o fato novo guarda um valor só até a pessoa escolher outra. */
export const controleDaQuantidade = (): FormControl<string> =>
  new FormControl<string>(QuantidadeDeValoresCodigo.VALOR_UNICO, { nonNullable: true });

function codigoInvalido(): never {
  throw new Error('Código de fato desconhecido.');
}
