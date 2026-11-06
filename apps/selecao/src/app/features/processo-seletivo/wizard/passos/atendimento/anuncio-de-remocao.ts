import { Injector, type WritableSignal } from '@angular/core';

import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';

/**
 * Anuncia a remoção, para quem não vê a tela, e devolve o foco à lista. Sem isto o botão clicado
 * sai do DOM e o foco cai no corpo da página, numa ação que não tem desfazer.
 *
 * A espera é por renderização, não por microtask: o ciclo de detecção do Angular roda depois que a
 * fila de microtasks drena, e consultar o DOM antes disso acharia o botão que está prestes a sair.
 */
export function anunciarRemocao(
  anuncio: WritableSignal<string>,
  injector: Injector,
  remocao: {
    readonly nome: string | undefined;
    readonly prefixoDoId: string;
    readonly indice: number;
    readonly tituloDaSecao: string;
  },
): void {
  anuncio.set(
    remocao.nome === undefined ? 'Item removido.' : `Removido da oferta: ${remocao.nome}.`,
  );

  // Removido o último da lista, o foco volta ao título da seção, que existe sempre e diz onde a
  // pessoa está.
  focarAposRenderizar(
    injector,
    `${remocao.prefixoDoId}-${Math.max(0, remocao.indice - 1)}`,
    remocao.tituloDaSecao,
  );
}
