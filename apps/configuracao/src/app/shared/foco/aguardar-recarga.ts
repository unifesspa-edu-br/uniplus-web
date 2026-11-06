import { Signal, effect, signal, untracked } from '@angular/core';

/** A espera pela recarga da lista que segue uma escrita. */
export interface EsperaDeRecarga {
  /** `true` do pedido de recarga até a lista terminar de ser lida, com sucesso ou falha. */
  readonly aguardando: Signal<boolean>;
  /** Anota que a escrita pediu a recarga; chamar logo antes de `recarregar()` da lista. */
  iniciar(): void;
}

/**
 * Uma escrita termina antes de a lista refletir o que foi gravado. Enquanto a recarga não acaba, a
 * lista segue indisponível para novas ações e a devolução do foco espera por ela.
 *
 * Chamar em contexto de injeção.
 *
 * @param carregando `true` enquanto a lista é lida.
 * @param comFalha `true` enquanto a leitura mais recente falhou.
 */
export function aguardarRecarga(
  carregando: Signal<boolean>,
  comFalha: Signal<boolean>,
): EsperaDeRecarga {
  const aguardando = signal(false);
  let iniciou = false;
  effect(() => {
    if (!aguardando()) {
      iniciou = false;
      return;
    }
    if (carregando()) {
      iniciou = true;
    } else if (iniciou || comFalha()) {
      untracked(() => aguardando.set(false));
    }
  });
  return { aguardando: aguardando.asReadonly(), iniciar: () => aguardando.set(true) };
}
