import type { DestinoDoFoco } from './avisos-visiveis';

function elementoDoDestino(
  raiz: HTMLElement,
  doc: Document,
  destino: DestinoDoFoco,
): HTMLElement | null {
  if (destino.tipo === 'aviso') {
    return raiz.querySelector(`[data-aviso-id="${destino.id}"] .toast__close`);
  }
  if (destino.tipo === 'mais-avisos') return raiz.querySelector('.toast-mais');
  return doc.querySelector<HTMLElement>('main');
}

/** Leva o foco ao destino; o conteúdo principal ganha `tabindex="-1"` para poder recebê-lo. */
export function focarDestino(raiz: HTMLElement, doc: Document, destino: DestinoDoFoco): void {
  const elemento = elementoDoDestino(raiz, doc, destino);
  if (elemento === null) return;
  if (destino.tipo === 'principal' && !elemento.hasAttribute('tabindex')) {
    elemento.setAttribute('tabindex', '-1');
  }
  elemento.focus();
}

export function listaTemOFoco(raiz: HTMLElement, doc: Document): boolean {
  return raiz.querySelector('.toast-recolhidos')?.contains(doc.activeElement) ?? false;
}

function idDoAviso(controle: Element): number | null {
  const valor = controle.closest('[data-aviso-id]')?.getAttribute('data-aviso-id');
  return valor === null || valor === undefined ? null : Number(valor);
}

/** Onde estava o foco dentro da pilha (aviso ou "Mais N"); `null` quando está fora dela. */
export function destinoDoControle(
  raiz: HTMLElement,
  controle: Element | null,
): DestinoDoFoco | null {
  if (controle === null || !raiz.contains(controle)) return null;
  if (controle.closest('.toast-mais') !== null) return { tipo: 'mais-avisos' };
  const id = idDoAviso(controle);
  return id === null ? null : { tipo: 'aviso', id };
}

function alternativaDoFoco(raiz: HTMLElement, anterior: DestinoDoFoco): DestinoDoFoco | null {
  if (anterior.tipo === 'aviso' && elementoDoDestino(raiz, raiz.ownerDocument, anterior) !== null) {
    return anterior;
  }
  if (raiz.querySelector('.toast-mais') !== null) return { tipo: 'mais-avisos' };
  const maisNovo = [...raiz.querySelectorAll('.toast-region [data-aviso-id]')].at(-1);
  const id = maisNovo === undefined ? null : idDoAviso(maisNovo);
  return id === null ? null : { tipo: 'aviso', id };
}

/**
 * Depois de renderizar, se o controle que tinha o foco na pilha sumiu (o cartão mudou de lista),
 * devolve o foco: ao "Fechar" do mesmo aviso, senão ao "Mais N", senão ao aviso mais novo à vista, senão ao conteúdo principal.
 * Foco que já está em outro lugar (inclusive fora da pilha) não é movido.
 */
export function devolverFoco(
  raiz: HTMLElement,
  doc: Document,
  anterior: DestinoDoFoco | null,
): void {
  const ativo = doc.activeElement;
  if (anterior === null || (ativo !== null && ativo !== doc.body)) return;
  focarDestino(raiz, doc, alternativaDoFoco(raiz, anterior) ?? { tipo: 'principal' });
}
