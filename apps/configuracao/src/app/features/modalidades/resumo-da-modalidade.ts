import {
  ComposicaoVagasCodigo,
  NaturezaLegalCodigo,
  RegraRemanejamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import type { Condicionais, RegraSelecao, ValoresDaModalidade } from './modalidade-form';

function clausulaDaComposicao(
  composicao: ComposicaoVagasCodigo | '',
  origem: string,
  rotulo: string,
): string {
  if (composicao === ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE) {
    return origem
      ? `As vagas são retiradas da modalidade ${origem}.`
      : 'As vagas são retiradas de outra modalidade (informe a origem).';
  }
  return rotulo ? `Composição das vagas: ${rotulo}.` : 'Selecione a composição das vagas.';
}

function clausulaDoRemanejamento(condicionais: Condicionais, valores: ValoresDaModalidade): string {
  const { natureza, regra } = condicionais;
  if (natureza === NaturezaLegalCodigo.AMPLA)
    return 'Ampla concorrência não remaneja vagas ociosas.';
  if (natureza === NaturezaLegalCodigo.COTA_RESERVADA) {
    return 'Cota da Lei 12.711: vagas ociosas seguem a cascata legal de remanejamento.';
  }
  return descricaoDoDestino(regra, valores);
}

function descricaoDoDestino(regra: RegraSelecao, valores: ValoresDaModalidade): string {
  if (regra === RegraRemanejamentoCodigo.DESTINO_UNICO) {
    return valores.remanejamentoDestino
      ? `Vagas ociosas remanejam para ${valores.remanejamentoDestino}.`
      : 'Vagas ociosas remanejam para um destino único (informe o destino).';
  }
  if (regra === RegraRemanejamentoCodigo.CRUZADO) {
    return valores.remanejamentoPar && valores.remanejamentoFallback
      ? `Remanejamento cruzado entre ${valores.remanejamentoPar} e ${valores.remanejamentoFallback}.`
      : 'Remanejamento cruzado (informe o par e o fallback).';
  }
  return 'Selecione a regra de remanejamento para esta modalidade.';
}

/** As frases que descrevem, em prosa, o efeito das escolhas atuais. */
export function resumoCondicional(
  condicionais: Condicionais,
  valores: ValoresDaModalidade,
  rotulo = '',
): readonly string[] {
  return [
    clausulaDaComposicao(condicionais.composicao, valores.composicaoOrigem, rotulo),
    clausulaDoRemanejamento(condicionais, valores),
  ];
}
