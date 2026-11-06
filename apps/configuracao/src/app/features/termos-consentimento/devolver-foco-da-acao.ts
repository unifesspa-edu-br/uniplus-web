import { ElementRef, Injector, Signal, afterNextRender, effect, inject } from '@angular/core';
import { focoEstaLivre } from '../../shared/foco';
import { AcaoTermo } from './termo-consentimento-form';

export interface OpcoesDaDevolucaoDeFocoDaAcao {
  /** Há escrita em curso ou a releitura que a segue ainda não terminou. */
  readonly processando: Signal<boolean>;
  /** A ação em curso, enquanto ela não termina. */
  readonly acao: Signal<AcaoTermo | null>;
  /** `id` do título da página, destino quando o acionador deixou de aceitar o foco. */
  readonly idDoTitulo: string;
}

/** O foco ficou sem destino: no `body`, numa sobreposição fechada ou num botão que se desabilitou. */
function focoPerdido(): boolean {
  return focoEstaLivre() || (document.activeElement?.matches(':disabled') ?? false);
}

/**
 * Depois de uma ação sobre o termo e da releitura dela, o botão que a acionou pode ter saído da
 * tela (a releitura falhou) ou ter ficado indisponível (promover deixa o rascunho sem revisão).
 * Se o foco ficou sem destino, volta ao acionador, que é localizado por `data-acao`, ou ao título
 * da página; foco que a pessoa levou a outro lugar nesse intervalo não é tocado.
 *
 * Chamar em contexto de injeção, no componente da página que contém os botões e o título.
 */
export function devolverFocoDaAcao(opcoes: OpcoesDaDevolucaoDeFocoDaAcao): void {
  const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const injector = inject(Injector);
  let daEscrita: AcaoTermo | null | undefined;

  const devolver = (acao: AcaoTermo | null): void => {
    if (!focoPerdido()) return;
    const acionador = acao && raiz.querySelector<HTMLElement>(`[data-acao="${acao}"]`);
    const destino = acionador && !acionador.matches(':disabled') ? acionador : null;
    (destino ?? raiz.querySelector<HTMLElement>(`#${opcoes.idDoTitulo}`))?.focus();
  };

  effect(() => {
    const acao = opcoes.acao();
    if (opcoes.processando()) {
      daEscrita = acao ?? daEscrita ?? null;
      return;
    }
    if (daEscrita === undefined) return;
    const acionada = daEscrita;
    daEscrita = undefined;
    afterNextRender(() => devolver(acionada), { injector });
  });
}
