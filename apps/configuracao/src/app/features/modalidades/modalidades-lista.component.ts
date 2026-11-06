import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { focoEstaLivre } from '../../shared/foco';

/**
 * O painel da lista de modalidades: título, contagem, estado vazio e paginação. A tabela entra
 * por projeção, para a lista não repassar os dados que só ela usa.
 */
@Component({
  selector: 'cfg-modalidades-lista',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidades-lista.component.html',
})
export class ModalidadesListaComponent {
  /** Quantas modalidades a lista exibe, depois de buscas e filtros. */
  readonly total = input.required<number>();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly temFiltroAtivo = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  /** O diálogo de remoção está aberto para uma modalidade. */
  readonly emRemocao = input.required<boolean>();
  readonly limpar = output<void>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  private readonly injector = inject(Injector);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private removeuNoDialogo = false;

  constructor() {
    effect(() => {
      if (this.emRemocao()) {
        this.removeuNoDialogo = true;
      } else if (!this.removendo() && this.removeuNoDialogo) {
        this.removeuNoDialogo = false;
        afterNextRender(() => this.focarTituloSeLivre(), { injector: this.injector });
      }
    });
  }

  /**
   * Durante a remoção e a recarga as ações da linha ficam indisponíveis, e um botão indisponível
   * não recebe o foco que o diálogo fechado deixou livre. Fechado o diálogo e terminada a recarga,
   * o foco vai ao título da lista, se ninguém o tomou nesse intervalo. Quando a lixeira de origem
   * ainda existe, o próprio navegador a refocaliza ao fechar o diálogo e o foco já não está livre.
   */
  private focarTituloSeLivre(): void {
    if (focoEstaLivre()) this.titulo()?.nativeElement.focus();
  }
}
