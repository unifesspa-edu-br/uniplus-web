import type { Notification } from '@uniplus/shared-core/notifications';

/** Fração da altura da tela que os avisos à vista podem ocupar. */
export const FRACAO_DA_TELA = 0.5;

export interface MedidaDosAvisos {
  readonly alturaDaRegiao: number;
  readonly alturaMaxima: number;
  /** Altura do aviso recolhido mais novo se voltasse à vista; `null` quando não há recolhido. */
  readonly alturaDoProximo: number | null;
}

function alturaDosCartoes(regiao: HTMLElement): HTMLElement[] {
  return [...regiao.querySelectorAll<HTMLElement>(':scope > ui-aviso')];
}

function espacoEntreCartoes(regiao: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(regiao).rowGap) || 0;
}

/** Guarda a altura de cada cartão à vista e esquece os que saíram da fila. */
export function registrarAlturas(
  regiao: HTMLElement,
  alturas: Map<number, number>,
  fila: readonly Notification[],
): void {
  for (const cartao of alturaDosCartoes(regiao)) {
    alturas.set(Number(cartao.dataset['avisoId']), cartao.offsetHeight);
  }
  for (const id of [...alturas.keys()]) {
    if (!fila.some((aviso) => aviso.id === id)) alturas.delete(id);
  }
}

function estimativaDoProximo(
  regiao: HTMLElement,
  alturas: Map<number, number>,
  idDoProximo: number,
): number {
  const cartoes = alturaDosCartoes(regiao);
  const media = cartoes.reduce((soma, c) => soma + c.offsetHeight, 0) / (cartoes.length || 1);
  return (alturas.get(idDoProximo) ?? media) + espacoEntreCartoes(regiao);
}

export function medirRegiao(
  regiao: HTMLElement,
  alturas: Map<number, number>,
  idDoProximo: number | undefined,
  alturaMaxima: number,
): MedidaDosAvisos {
  const alturaDoProximo =
    idDoProximo === undefined ? null : estimativaDoProximo(regiao, alturas, idDoProximo);
  return { alturaDaRegiao: regiao.offsetHeight, alturaMaxima, alturaDoProximo };
}

/**
 * Reduz 1 aviso à vista enquanto a região passa do máximo (nunca abaixo de 1: o mais novo fica
 * inteiro) e só devolve 1 quando o recolhido mais novo cabe com a altura já medida, sem oscilar.
 */
export function ajustarLimite(limite: number, teto: number, medida: MedidaDosAvisos): number {
  if (medida.alturaDaRegiao > medida.alturaMaxima) return Math.max(limite - 1, 1);
  const { alturaDoProximo } = medida;
  const cabe =
    alturaDoProximo !== null && medida.alturaDaRegiao + alturaDoProximo <= medida.alturaMaxima;
  return cabe ? Math.min(limite + 1, teto) : Math.min(limite, teto);
}
