import { FormControl } from '@angular/forms';
import {
  ComponenteDeExibicaoCodigo,
  EscopoFatoCodigo,
  FormatoTextoCodigo,
  QuantidadeDeValoresCodigo,
  FonteValoresFatoCodigo,
  TipoDoDadoCodigo,
} from '@uniplus/shared-data/configuracao';
import { codigoExigidoDoContrato } from '@uniplus/shared-data/utils';

/**
 * Os controles do formulário guardam o código escolhido como texto, porque as opções vêm da
 * própria API; aqui o texto volta a ser o código que o pedido exige.
 */
export const tipoDoDadoEscolhido = (valor: string): TipoDoDadoCodigo =>
  codigoExigidoDoContrato(TipoDoDadoCodigo, valor, 'código de fato');

export const quantidadeEscolhida = (valor: string): QuantidadeDeValoresCodigo =>
  codigoExigidoDoContrato(QuantidadeDeValoresCodigo, valor, 'código de fato');

/** Sem fonte escolhida o texto é vazio, e o pedido leva a ausência. */
export const fonteEscolhida = (valor: string): FonteValoresFatoCodigo | null =>
  valor === '' ? null : codigoExigidoDoContrato(FonteValoresFatoCodigo, valor, 'código de fato');

/** O controle da quantidade de valores: o fato novo guarda um valor só até a pessoa escolher outra. */
export const controleDaQuantidade = (): FormControl<string> =>
  new FormControl<string>(QuantidadeDeValoresCodigo.VALOR_UNICO, { nonNullable: true });

export const escopoEscolhido = (valor: string): EscopoFatoCodigo =>
  codigoExigidoDoContrato(EscopoFatoCodigo, valor, 'código de fato');

export const formatoEscolhido = (valor: string): FormatoTextoCodigo | null =>
  valor === '' ? null : codigoExigidoDoContrato(FormatoTextoCodigo, valor, 'código de fato');

export const componenteEscolhido = (valor: string): ComponenteDeExibicaoCodigo | null =>
  valor === ''
    ? null
    : codigoExigidoDoContrato(ComponenteDeExibicaoCodigo, valor, 'código de fato');
