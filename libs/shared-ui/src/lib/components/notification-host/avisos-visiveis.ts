import type { Notification } from '@uniplus/shared-core/notifications';

/** Quantos avisos ficam à vista; o resto vai para a lista recolhida, sem descarte. */
export const LIMITE_COMPACTO = 1;
export const LIMITE_NORMAL = 3;
/** Tela compacta: estreita (celular) ou baixa (paisagem, ou zoom alto em tela larga). */
export const CONSULTA_COMPACTA = '(max-width: 767px), (max-height: 600px)';

export interface DivisaoDosAvisos {
  readonly recolhidos: readonly Notification[];
  readonly visiveis: readonly Notification[];
}

export type DestinoDoFoco =
  | { readonly tipo: 'aviso'; readonly id: number }
  | { readonly tipo: 'mais-avisos' }
  | { readonly tipo: 'principal' };

/** A fila vem em ordem de chegada: os `limite` mais novos ficam à vista. */
export function dividirAvisos(fila: readonly Notification[], limite: number): DivisaoDosAvisos {
  const corte = Math.max(fila.length - limite, 0);
  return { recolhidos: fila.slice(0, corte), visiveis: fila.slice(corte) };
}

function avisosAVista(
  fila: readonly Notification[],
  limite: number,
  listaAberta: boolean,
): Notification[] {
  const { recolhidos, visiveis } = dividirAvisos(fila, limite);
  return listaAberta ? [...recolhidos, ...visiveis] : [...visiveis];
}

function semOFechado(fila: readonly Notification[], id: number): Notification[] {
  return fila.filter((aviso) => aviso.id !== id);
}

function destinoSemAvisoAVista(restante: readonly Notification[], limite: number): DestinoDoFoco {
  const depois = dividirAvisos(restante, limite);
  if (depois.recolhidos.length > 0) return { tipo: 'mais-avisos' };
  const novoVisivel = depois.visiveis.at(-1);
  return novoVisivel === undefined ? { tipo: 'principal' } : { tipo: 'aviso', id: novoVisivel.id };
}

/**
 * Para onde o foco vai quando um aviso é fechado: o aviso à vista que o seguia (ou o anterior, se
 * era o último); senão o botão "Mais N"; senão o aviso que passou a ficar à vista; senão o
 * conteúdo principal.
 */
export function destinoDoFoco(
  fila: readonly Notification[],
  idFechado: number,
  limite: number,
  listaAberta: boolean,
): DestinoDoFoco {
  const aVista = avisosAVista(fila, limite, listaAberta);
  const posicao = aVista.findIndex((aviso) => aviso.id === idFechado);
  const restantes = aVista.filter((aviso) => aviso.id !== idFechado);
  const proximo = restantes[posicao] ?? restantes[posicao - 1];
  if (proximo !== undefined) return { tipo: 'aviso', id: proximo.id };
  return destinoSemAvisoAVista(semOFechado(fila, idFechado), limite);
}
