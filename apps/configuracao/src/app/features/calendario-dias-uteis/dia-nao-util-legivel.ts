import {
  ABRANGENCIAS,
  DiaNaoUtilDto,
  UNIDADES_FEDERATIVAS,
} from '@uniplus/shared-data/configuracao';
import { formatIsoDateLong } from '@uniplus/shared-data/utils';
import type { CelulaCalendarioMensal } from './calendario-mensal.util';

export function abrangenciaLegivel(abrangencia: string): string {
  return ABRANGENCIAS.find((candidata) => candidata.value === abrangencia)?.label ?? abrangencia;
}

/**
 * Nome e UF do município vêm do snapshot gravado no dataset: a tela não consulta a Geo para
 * resolver localidade já gravada. O que falta some da tela, em vez de virar "null" ao lado do código.
 */
export function municipioLegivel(dia: DiaNaoUtilDto): string {
  return [dia.municipioNome, dia.municipioUf].filter(Boolean).join(' — ');
}

/** A UF por extenso mais a sigla, como `Pará — PA`. */
export function ufLegivel(uf: string | null): string {
  const unidade = UNIDADES_FEDERATIVAS.find((candidata) => candidata.sigla === uf);
  return unidade ? `${unidade.nome} — ${unidade.sigla}` : (uf ?? '');
}

function ocorrenciaLegivel(ocorrencia: DiaNaoUtilDto): string {
  return `${ocorrencia.descricao} (${abrangenciaLegivel(ocorrencia.abrangencia)})`;
}

/** O nome acessível do dia: a mesma informação da prévia visual, sem depender de hover. */
export function rotuloDoDia(celula: CelulaCalendarioMensal): string {
  const dataPorExtenso = formatIsoDateLong(celula.data);
  if (celula.ocorrencias.length === 1) {
    return `${dataPorExtenso}: ${ocorrenciaLegivel(celula.ocorrencias[0])}`;
  }
  const resumo = celula.ocorrencias.map(ocorrenciaLegivel).join(', ');
  return `${dataPorExtenso}: ${celula.ocorrencias.length} ocorrências — ${resumo}`;
}

/** Dia sem ocorrência também é acionável, pois abre o painel para cadastrar. */
export function rotuloDoDiaSemOcorrencia(celula: CelulaCalendarioMensal): string {
  return `${formatIsoDateLong(celula.data)}: sem dia não útil cadastrado`;
}

export function textoDaPrevia(celula: CelulaCalendarioMensal): string {
  if (celula.ocorrencias.length === 1) {
    const [ocorrencia] = celula.ocorrencias;
    return `${ocorrencia.descricao} — ${abrangenciaLegivel(ocorrencia.abrangencia)}`;
  }
  return `${celula.ocorrencias.length} ocorrências nesta data`;
}
