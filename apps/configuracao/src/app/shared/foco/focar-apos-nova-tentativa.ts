import { Injector, Signal, afterNextRender, effect, inject, untracked } from '@angular/core';

/** O "Tentar novamente" de uma lista, com a guarda contra clique repetido e o foco. */
export interface NovaTentativa {
  /**
   * Dispara a nova tentativa pedida pelo operador. Não faz nada enquanto a lista
   * carrega — é a mesma condição do `aria-disabled` do botão, que fica com
   * `aria-disabled`, e não `disabled`, para não perder o foco. `disparar` inicia a carga.
   */
  executar(disparar: () => void): void;
}

/**
 * Quando a nova tentativa pedida pelo operador dá certo, o alerta que anunciava a falha
 * sai da tela e leva junto o botão "Tentar novamente". O foco, que estava nele, cairia
 * no `body`, fora do contexto do operador (WCAG 2.4.3): aqui ele vai para `destino`,
 * depois da renderização que removeu o alerta.
 *
 * Só age se o foco estava no elemento acionado (o botão) no clique e continuava nele
 * quando a tentativa terminou. Uma recarga em segundo plano, um clique que não focou o
 * botão (como no Safari) ou um foco levado a outro lugar durante a espera não mexem no
 * foco: mudar de contexto sem ação do operador é o que a WCAG 3.2 proíbe.
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 *
 * @param pendente Sinal que é `true` enquanto a lista carrega.
 * @param falhou Sinal que é `true` enquanto o alerta da lista está na tela.
 * @param destino Elemento estável que recebe o foco (título, campo que o dado alimenta).
 */
export function focarAposNovaTentativa(
  pendente: Signal<boolean>,
  falhou: Signal<boolean>,
  destino: () => HTMLElement | null | undefined,
): NovaTentativa {
  const injector = inject(Injector);
  /** Elemento com o foco no clique da tentativa do operador que ainda não terminou. */
  let acionado: Element | null | undefined;

  const concluir = (): void => {
    const focoSeguiaNoBotao = acionado !== null && acionado !== undefined && document.activeElement === acionado;
    acionado = undefined;
    if (untracked(falhou) || !focoSeguiaNoBotao) {
      return;
    }
    afterNextRender(
      () => {
        const ativo = document.activeElement;
        if (ativo === null || ativo === document.body) {
          destino()?.focus();
        }
      },
      { injector },
    );
  };

  effect(
    () => {
      const emCurso = pendente();
      falhou();
      if (emCurso || acionado === undefined) {
        return;
      }
      // A tentativa do operador terminou. O efeito roda antes da renderização que tira
      // o alerta: o botão ainda está na tela, e dá para saber se o foco segue nele.
      untracked(concluir);
    },
    { injector },
  );

  return {
    executar: (disparar) => {
      if (untracked(pendente)) {
        return;
      }
      const ativo = document.activeElement;
      disparar();
      acionado = ativo === null || ativo === document.body ? null : ativo;
      // A tentativa pode terminar dentro de `disparar` (erro síncrono): sem mudança de
      // `pendente` para o efeito ver, ela é concluída aqui.
      if (!untracked(pendente)) {
        concluir();
      }
    },
  };
}
