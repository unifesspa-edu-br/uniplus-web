import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  CadastroDoCatalogo,
  DecidirProtecaoDoCatalogoRequest,
  DecisaoDaProtecao,
  DetalheDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import {
  CLASSIFICACOES_DE_PROTECAO,
  hipotesesDaClassificacao,
} from '../../shared/protecao-do-catalogo';
import { classificacoesDoDominio } from '../fatos-candidato/fato-candidato.regras';

export const JUSTIFICATIVA_MAXIMA = 2000;

export function justificativaPreenchida(
  controle: AbstractControl<string>,
): ValidationErrors | null {
  return controle.value.trim().length > 0 ? null : { required: true };
}

export function recomendacoesPara(item: DetalheDaProtecaoDoCatalogoDto | null) {
  if (item === null) return [];
  const doDominio =
    item.fato === null
      ? null
      : new Set(classificacoesDoDominio(item.fato.dominio).map((opcao) => opcao.valor));
  return CLASSIFICACOES_DE_PROTECAO.filter(
    (opcao) =>
      opcao.valor !== item.classificacaoProtecao &&
      (doDominio === null || doDominio.has(opcao.valor)) &&
      hipotesesDaClassificacao(opcao.valor).some(
        (hipotese) => hipotese.valor === item.hipoteseLegal,
      ),
  );
}

export function comandoPara(
  item: DetalheDaProtecaoDoCatalogoDto,
): DecidirProtecaoDoCatalogoRequest {
  return {
    cadastro: item.tipo as CadastroDoCatalogo,
    itemId: item.id,
    decisao: 'APROVAR',
    classificacaoProtecao: item.classificacaoProtecao,
    hipoteseLegal: item.hipoteseLegal,
    finalidadeTratamento: item.finalidadeTratamento,
  };
}

/** O comando da decisão com a justificativa digitada; a recomendação só vale no ajuste. */
export function comandoDeJustificativa(
  item: DetalheDaProtecaoDoCatalogoDto,
  decisao: DecisaoDaProtecao,
  justificativa: string,
  recomendada: string,
): DecidirProtecaoDoCatalogoRequest {
  const comando = { ...comandoPara(item), decisao, justificativa: justificativa || null };
  return decisao === 'RECOMENDAR_AJUSTE'
    ? { ...comando, classificacaoRecomendada: recomendada }
    : comando;
}
