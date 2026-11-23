import type { DefinirProvaPresencialRequest } from '@uniplus/shared-data/selecao';

export interface MunicipioDeProva {
  readonly codigoIbge: string;
  readonly uf: string;
  readonly nome: string | null;
}

export interface DeclaracaoDaProvaPresencial {
  readonly temProvaPresencial: boolean | null;
  readonly municipios: readonly MunicipioDeProva[];
}

export function escolherProvaPresencial(
  declaracao: DeclaracaoDaProvaPresencial,
  temProva: boolean,
): DeclaracaoDaProvaPresencial {
  return { ...declaracao, temProvaPresencial: temProva };
}

export function comMunicipioAdicionado(
  declaracao: DeclaracaoDaProvaPresencial,
  municipio: MunicipioDeProva,
): DeclaracaoDaProvaPresencial {
  if (declaracao.municipios.some((item) => item.codigoIbge === municipio.codigoIbge))
    return declaracao;
  return { ...declaracao, municipios: [...declaracao.municipios, municipio] };
}

export function semMunicipio(
  declaracao: DeclaracaoDaProvaPresencial,
  codigoIbge: string,
): DeclaracaoDaProvaPresencial {
  return {
    ...declaracao,
    municipios: declaracao.municipios.filter((item) => item.codigoIbge !== codigoIbge),
  };
}

export function pedidoDaDeclaracao(
  declaracao: DeclaracaoDaProvaPresencial,
): DefinirProvaPresencialRequest | null {
  if (declaracao.temProvaPresencial === null) return null;
  return {
    temProvaPresencial: declaracao.temProvaPresencial,
    municipios: declaracao.temProvaPresencial
      ? declaracao.municipios.map(({ codigoIbge, uf }) => ({ codigoIbge, uf }))
      : [],
  };
}

export function municipiosQueSeraoRemovidos(
  declaracao: DeclaracaoDaProvaPresencial,
  gravada: DeclaracaoDaProvaPresencial,
): readonly MunicipioDeProva[] {
  if (declaracao.temProvaPresencial === null) return [];
  if (declaracao.temProvaPresencial === false) return gravada.municipios;
  const mantidos = new Set(declaracao.municipios.map((municipio) => municipio.codigoIbge));
  return gravada.municipios.filter((municipio) => !mantidos.has(municipio.codigoIbge));
}

export function rotuloDoMunicipio(municipio: MunicipioDeProva): string {
  return `${municipio.nome ?? `município de código ${municipio.codigoIbge}`} (${municipio.uf})`;
}

export function avisoDeRemocaoDosMunicipios(municipios: readonly MunicipioDeProva[]): string {
  const nomes = municipios.map(rotuloDoMunicipio).join(', ');
  return municipios.length === 1
    ? `O município de prova (${nomes}) será removido ao salvar.`
    : `Os ${municipios.length} municípios de prova (${nomes}) serão removidos ao salvar.`;
}
