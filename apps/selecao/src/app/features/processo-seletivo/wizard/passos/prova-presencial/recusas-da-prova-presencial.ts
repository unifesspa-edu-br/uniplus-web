import {
  emOrdem,
  primeiraRecusaAtiva,
  type RecusaOrdenada,
} from '../../shared/recusas/ordem-das-recusas';
import type { MunicipioDeProva } from './declaracao-da-prova-presencial';

export interface RecusasDaProvaPresencial {
  readonly escolha: readonly RecusaOrdenada[];
  readonly lista: readonly RecusaOrdenada[];
  readonly porMunicipio: ReadonlyMap<string, readonly RecusaOrdenada[]>;
}

function campoNormalizado(campo: string): string {
  return campo
    .replace(/^\$\./, '')
    .replace(/^request\./i, '')
    .replace(/^\//, '')
    .replace(/\/(\d+|\w+)/g, '.$1')
    .replace(/\[(\d+)\]/g, '.$1');
}

function codigoDoMunicipio(
  campo: string,
  municipios: readonly MunicipioDeProva[],
): string | undefined {
  const partes = /^provaPresencial\.municipios\.(\d+)(?:\.(?:codigoIbge|uf))?$/i.exec(campo);
  return partes === null ? undefined : municipios[Number(partes[1])]?.codigoIbge;
}

function destinoDaRecusa(recusa: RecusaOrdenada): 'escolha' | 'lista' | 'outro' {
  const campo = campoNormalizado(recusa.campo).toLowerCase();
  if (campo === 'provapresencial') return 'escolha';
  if (campo.startsWith('provapresencial')) return 'lista';
  if (campo !== '') return 'outro';
  if (recusa.codigo === 'ProvaPresencial.PorDeclarar') return 'escolha';
  return recusa.codigo.startsWith('ProvaPresencial.') ? 'lista' : 'outro';
}

function repartirRecusasDaLista(
  recusas: readonly RecusaOrdenada[],
  municipiosEnviados: readonly MunicipioDeProva[],
): Pick<RecusasDaProvaPresencial, 'lista' | 'porMunicipio'> {
  const lista: RecusaOrdenada[] = [];
  const porMunicipio = new Map<string, RecusaOrdenada[]>();
  for (const recusa of recusas) {
    const codigo = codigoDoMunicipio(campoNormalizado(recusa.campo), municipiosEnviados);
    if (codigo === undefined) lista.push(recusa);
    else porMunicipio.set(codigo, [...(porMunicipio.get(codigo) ?? []), recusa]);
  }
  return { lista, porMunicipio };
}

export function recusasDaProvaPresencial(
  recusas: readonly RecusaOrdenada[],
  municipiosEnviados: readonly MunicipioDeProva[],
): RecusasDaProvaPresencial {
  const ordenadas = emOrdem(recusas);
  return {
    escolha: ordenadas.filter((recusa) => destinoDaRecusa(recusa) === 'escolha'),
    ...repartirRecusasDaLista(
      ordenadas.filter((recusa) => destinoDaRecusa(recusa) === 'lista'),
      municipiosEnviados,
    ),
  };
}

export function unirRecusasDaProvaPresencial(
  gravacao: RecusasDaProvaPresencial,
  publicacao: RecusasDaProvaPresencial,
): RecusasDaProvaPresencial {
  return {
    escolha: emOrdem([...gravacao.escolha, ...publicacao.escolha]),
    lista: emOrdem([...gravacao.lista, ...publicacao.lista]),
    porMunicipio: unirRecusasPorMunicipio(gravacao.porMunicipio, publicacao.porMunicipio),
  };
}

function unirRecusasPorMunicipio(
  gravacao: RecusasDaProvaPresencial['porMunicipio'],
  publicacao: RecusasDaProvaPresencial['porMunicipio'],
): RecusasDaProvaPresencial['porMunicipio'] {
  const codigos = new Set([...gravacao.keys(), ...publicacao.keys()]);
  return new Map(
    [...codigos].map((codigo) => [
      codigo,
      emOrdem([...(gravacao.get(codigo) ?? []), ...(publicacao.get(codigo) ?? [])]),
    ]),
  );
}

export function primeiraRecusaDaProvaPresencial(recusas: RecusasDaProvaPresencial) {
  const candidatas = [
    ...recusas.escolha.map((recusa) => ({ recusa, codigo: '' })),
    ...recusas.lista.map((recusa) => ({ recusa, codigo: '' })),
    ...[...recusas.porMunicipio].flatMap(([codigo, itens]) =>
      itens.map((recusa) => ({ recusa, codigo })),
    ),
  ];
  return primeiraRecusaAtiva(candidatas);
}
