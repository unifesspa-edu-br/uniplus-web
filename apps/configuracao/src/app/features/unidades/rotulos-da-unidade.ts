import type { UnidadeDto } from '@uniplus/shared-data/organizacao';

function formatarData(valor: string): string {
  const [ano, mes, dia] = valor.split('-');
  if (ano === undefined || mes === undefined || dia === undefined) {
    return valor;
  }
  return `${dia}/${mes}/${ano}`;
}

export function vigenciaDaUnidade(unidade: UnidadeDto): string {
  return unidade.vigenciaFim === null
    ? `Desde ${formatarData(unidade.vigenciaInicio)}`
    : `${formatarData(unidade.vigenciaInicio)} a ${formatarData(unidade.vigenciaFim)}`;
}

/** A cidade-sede na ficha de leitura (referência opcional). */
export function cidadeDaUnidade(unidade: UnidadeDto): string {
  return unidade.cidadeCodigoIbge === null
    ? 'Não informada'
    : `${unidade.cidadeNome} — ${unidade.cidadeUf}`;
}
