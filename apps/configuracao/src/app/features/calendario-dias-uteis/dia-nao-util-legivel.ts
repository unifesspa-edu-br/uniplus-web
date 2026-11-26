import { DiaNaoUtilDto, UNIDADES_FEDERATIVAS } from '@uniplus/shared-data/configuracao';
import { formatIsoDateLong } from '@uniplus/shared-data/utils';
import type { CelulaCalendarioMensal } from './calendario-mensal.util';

export function abrangenciaLegivel(abrangencia: DiaNaoUtilDto['abrangencia']): string {
  return abrangencia.rotulo;
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

function quantosOcultos(quantidade: number): string {
  return quantidade === 1
    ? '1 dia não útil oculto pelo filtro'
    : `${quantidade} dias não úteis ocultos pelo filtro`;
}

function ocorrenciasLegiveis(celula: CelulaCalendarioMensal): string {
  if (celula.ocorrencias.length === 1) {
    return ocorrenciaLegivel(celula.ocorrencias[0]);
  }
  const resumo = celula.ocorrencias.map(ocorrenciaLegivel).join(', ');
  return `${celula.ocorrencias.length} ocorrências — ${resumo}`;
}

/**
 * O nome acessível do dia: a mesma informação da prévia visual, sem depender de hover. O que o
 * filtro esconde entra no fim, para a data não soar como se tivesse só o que está à vista.
 */
export function rotuloDoDia(celula: CelulaCalendarioMensal): string {
  const ocultos = celula.ocultas.length > 0 ? `; e ${quantosOcultos(celula.ocultas.length)}` : '';
  return `${formatIsoDateLong(celula.data)}: ${ocorrenciasLegiveis(celula)}${ocultos}`;
}

/** O dia cujas ocorrências o filtro esconde todas: tem dia não útil, e o rótulo não diz o contrário. */
export function rotuloDoDiaOculto(celula: CelulaCalendarioMensal): string {
  return `${formatIsoDateLong(celula.data)}: ${quantosOcultos(celula.ocultas.length)}`;
}

/** Dia sem ocorrência também é acionável, pois abre o painel para cadastrar. */
export function rotuloDoDiaSemOcorrencia(celula: CelulaCalendarioMensal): string {
  return `${formatIsoDateLong(celula.data)}: sem dia não útil cadastrado`;
}

function ocultosDaPrevia(quantidade: number): string {
  if (quantidade === 0) return '';
  return quantidade === 1 ? ' (+1 oculto pelo filtro)' : ` (+${quantidade} ocultos pelo filtro)`;
}

export function textoDaPrevia(celula: CelulaCalendarioMensal): string {
  const ocultos = ocultosDaPrevia(celula.ocultas.length);
  if (celula.ocorrencias.length === 1) {
    const [ocorrencia] = celula.ocorrencias;
    return `${ocorrencia.descricao} — ${abrangenciaLegivel(ocorrencia.abrangencia)}${ocultos}`;
  }
  return `${celula.ocorrencias.length} ocorrências nesta data${ocultos}`;
}
