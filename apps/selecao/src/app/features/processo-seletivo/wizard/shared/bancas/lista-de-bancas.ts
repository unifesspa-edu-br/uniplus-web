import type { BancaDeclarada } from '../../modelos/banca.models';

export function acrescentarBanca<T extends BancaDeclarada>(bancas: readonly T[], banca: T): T[] {
  return [...bancas, banca];
}

export function retirarBanca<T extends BancaDeclarada>(bancas: readonly T[], chave: string): T[] {
  return bancas.filter((banca) => banca.identificadorLocal !== chave);
}

export function moverNoTipo<T extends BancaDeclarada>(
  bancas: readonly T[],
  chave: string,
  direcao: -1 | 1,
): T[] {
  const indice = bancas.findIndex((banca) => banca.identificadorLocal === chave);
  if (indice < 0) return [...bancas];
  const vizinha = indiceDaVizinha(bancas, indice, direcao);
  if (vizinha < 0) return [...bancas];
  const resultado = [...bancas];
  [resultado[indice], resultado[vizinha]] = [resultado[vizinha], resultado[indice]];
  return resultado;
}

function indiceDaVizinha(
  bancas: readonly BancaDeclarada[],
  indice: number,
  direcao: -1 | 1,
): number {
  for (let i = indice + direcao; i >= 0 && i < bancas.length; i += direcao) {
    if (bancas[i].tipoBancaId === bancas[indice].tipoBancaId) return i;
  }
  return -1;
}

export function posicaoNoTipo(bancas: readonly BancaDeclarada[], banca: BancaDeclarada): number {
  const indice = bancas.findIndex((item) => item.identificadorLocal === banca.identificadorLocal);
  return bancas.slice(0, indice + 1).filter((item) => item.tipoBancaId === banca.tipoBancaId)
    .length;
}

export function identificacaoDaBanca(
  bancas: readonly BancaDeclarada[],
  banca: BancaDeclarada,
  rotuloDoCadastro: string,
): string {
  return `${banca.copiaDoTipo?.rotulo ?? rotuloDoCadastro} ${posicaoNoTipo(bancas, banca)}`;
}

export function gruposPorTipo<T extends BancaDeclarada>(bancas: readonly T[]): T[][] {
  const grupos = new Map<string, T[]>();
  for (const banca of bancas) {
    const grupo = grupos.get(banca.tipoBancaId) ?? [];
    grupo.push(banca);
    grupos.set(banca.tipoBancaId, grupo);
  }
  return [...grupos.values()];
}

export function algumaBancaEncerraORecurso(bancas: readonly BancaDeclarada[]): boolean {
  return bancas.some((banca) => banca.copiaDoTipo?.encerraRecursoNaPrimeiraInstancia === true);
}
