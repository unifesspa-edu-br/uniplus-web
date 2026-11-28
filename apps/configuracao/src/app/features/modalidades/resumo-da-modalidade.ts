import {
  ComposicaoVagasCodigo,
  NaturezaLegalCodigo,
  RegraRemanejamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import type { Condicionais, RegraSelecao, ValoresDaModalidade } from './modalidade-form';

type RotuloDaModalidade = (codigo: string) => string;

function clausulaDaComposicao(
  composicao: ComposicaoVagasCodigo | '',
  origem: string,
  rotulo: string,
  rotuloDe: RotuloDaModalidade,
): string {
  if (composicao === ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE) {
    return origem
      ? `As vagas são retiradas da modalidade ${rotuloDe(origem)}.`
      : 'As vagas são retiradas de outra modalidade (informe a origem).';
  }
  return rotulo ? `Composição das vagas: ${rotulo}.` : 'Selecione a composição das vagas.';
}

function clausulaDoRemanejamento(
  condicionais: Condicionais,
  valores: ValoresDaModalidade,
  rotuloDe: RotuloDaModalidade,
): string {
  const { natureza, regra } = condicionais;
  if (natureza === NaturezaLegalCodigo.AMPLA)
    return 'Ampla concorrência não remaneja vagas ociosas.';
  if (natureza === NaturezaLegalCodigo.COTA_RESERVADA) {
    return 'Cota da Lei 12.711: vagas ociosas seguem a cascata legal de remanejamento.';
  }
  return descricaoDoDestino(regra, valores, rotuloDe);
}

function descricaoDoDestino(
  regra: RegraSelecao,
  valores: ValoresDaModalidade,
  rotuloDe: RotuloDaModalidade,
): string {
  if (regra === RegraRemanejamentoCodigo.DESTINO_UNICO) {
    return valores.remanejamentoDestino
      ? `Vagas ociosas remanejam para ${rotuloDe(valores.remanejamentoDestino)}.`
      : 'Vagas ociosas remanejam para um destino único (informe o destino).';
  }
  if (regra === RegraRemanejamentoCodigo.CRUZADO) return descricaoDoCruzado(valores, rotuloDe);
  return 'Selecione a regra de remanejamento para esta modalidade.';
}

function descricaoDoCruzado(valores: ValoresDaModalidade, rotuloDe: RotuloDaModalidade): string {
  const { remanejamentoPar: par, remanejamentoFallback: fallback } = valores;
  return par && fallback
    ? `Remanejamento cruzado entre ${rotuloDe(par)} e ${rotuloDe(fallback)}.`
    : 'Remanejamento cruzado (informe o par e o fallback).';
}

/** As frases que descrevem, em prosa, o efeito das escolhas atuais. */
export function resumoCondicional(
  condicionais: Condicionais,
  valores: ValoresDaModalidade,
  rotulo = '',
  rotuloDe: RotuloDaModalidade = (codigo) => codigo,
): readonly string[] {
  return [
    clausulaDaComposicao(condicionais.composicao, valores.composicaoOrigem, rotulo, rotuloDe),
    clausulaDoRemanejamento(condicionais, valores, rotuloDe),
  ];
}
