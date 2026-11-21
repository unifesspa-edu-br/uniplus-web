import type { EtapaPontuada } from '../../processo-seletivo.models';
import type { ParteDaEtapa } from './parte-da-etapa';

/** As listas da etapa cujos itens a recusa aponta pela posição que tinham quando foi enviada. */
export type ListaComPosicao = 'recursos' | 'itensDeAvaliacao' | 'escalaDeAtendimento';

export type ListasDaEtapa = Readonly<Record<ListaComPosicao, readonly unknown[]>>;

/** Para cada posição antiga de cada lista, a posição de hoje, ou `null` quando o item saiu. */
export type NovasPosicoes = Readonly<Record<ListaComPosicao, readonly (number | null)[]>>;

const LISTAS: readonly ListaComPosicao[] = ['recursos', 'itensDeAvaliacao', 'escalaDeAtendimento'];

export function listasDaEtapa(etapa: EtapaPontuada): ListasDaEtapa {
  return {
    recursos: etapa.recursos,
    itensDeAvaliacao: etapa.itensDeAvaliacao ?? [],
    escalaDeAtendimento: etapa.escalaDeAtendimento ?? [],
  };
}

/**
 * Onde cada item de antes está agora. O item é reconhecido pelo próprio objeto: remover, acrescentar
 * ou reordenar preserva os objetos dos demais, e quem os reencontra sabe qual é qual. Quando o
 * tamanho não muda e o objeto não aparece, o item foi editado no lugar e fica na mesma posição.
 * Quando o tamanho muda e o objeto não aparece, o item saiu.
 */
function posicoesNaLista(antes: readonly unknown[], depois: readonly unknown[]): (number | null)[] {
  const tomadas = new Set<number>();
  const mesmoTamanho = antes.length === depois.length;
  return antes.map((item, posicao) => {
    const achada = depois.findIndex((atual, i) => atual === item && !tomadas.has(i));
    if (achada < 0) return mesmoTamanho ? posicao : null;
    tomadas.add(achada);
    return achada;
  });
}

export function novasPosicoes(antes: ListasDaEtapa, depois: ListasDaEtapa): NovasPosicoes {
  const doGrupo = (lista: ListaComPosicao) => posicoesNaLista(antes[lista], depois[lista]);
  return {
    recursos: doGrupo('recursos'),
    itensDeAvaliacao: doGrupo('itensDeAvaliacao'),
    escalaDeAtendimento: doGrupo('escalaDeAtendimento'),
  };
}

/** Nenhum item mudou de posição nem saiu: as recusas seguem apontando o que apontavam. */
export function todasNoLugar(novas: NovasPosicoes): boolean {
  return LISTAS.every((lista) => novas[lista].every((posicao, i) => posicao === i));
}

const CAMPO_DE_ITEM = /^(recursos|itensDeAvaliacao|escalaDeAtendimento)\.(\d+)(\..+)$/;

/** O campo da recusa na posição de hoje do item, ou `null` quando o item saiu. */
export function campoNasNovasPosicoes(campo: string, novas: NovasPosicoes): string | null {
  const item = CAMPO_DE_ITEM.exec(campo);
  if (item === null) return campo;
  const lista = item[1] as ListaComPosicao;
  const posicao = novas[lista][Number(item[2])] ?? null;
  return posicao === null ? null : `${lista}.${posicao}${item[3]}`;
}

/** A parte da recusa na posição de hoje do recurso, ou `null` quando o recurso saiu. */
export function parteNasNovasPosicoes(
  parte: ParteDaEtapa,
  novas: NovasPosicoes,
): ParteDaEtapa | null {
  if (parte === 'etapa') return parte;
  const posicao = novas.recursos[parte.recurso] ?? null;
  return posicao === null ? null : { recurso: posicao };
}

/**
 * A recusa na posição de hoje do item que ela aponta, ou `null` quando o item saiu: a recusa de
 * um item que não existe mais deixa de valer, e nunca passa para o item que ocupou o lugar dele.
 */
export function recusaNasNovasPosicoes<T extends { campo: string; parte: ParteDaEtapa }>(
  recusa: T,
  novas: NovasPosicoes,
): T | null {
  const campo = campoNasNovasPosicoes(recusa.campo, novas);
  const parte = parteNasNovasPosicoes(recusa.parte, novas);
  return campo === null || parte === null ? null : { ...recusa, campo, parte };
}
