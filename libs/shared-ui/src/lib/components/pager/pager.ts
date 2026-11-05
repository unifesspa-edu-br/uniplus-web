import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

@Component({
  selector: 'ui-pager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      Os botões se nomeiam pelo próprio conteúdo. aria-label aqui só
      reescreveria o rótulo visível: "Próximo" com nome "Próxima página"
      viola o SC 2.5.3, porque a flexão de gênero quebra a contenção e quem
      usa comando de voz diz o que lê na tela. O contexto de que se trata de
      paginação vem do aria-label do <nav>, não de cada botão.

      Indisponível = aria-disabled + recusa no handler, não disabled: ao chegar
      na última página o botão acionado não pode perder o foco do teclado.
    -->
    <nav class="pager" [attr.aria-label]="navigationLabel()">
      <button
        type="button"
        class="pager__btn"
        data-pager="prev"
        [attr.aria-disabled]="anteriorIndisponivel() ? 'true' : null"
        (click)="acionarAnterior()"
      >
        Anterior
      </button>
      @if (pageSizeOptions().length > 0) {
        <span class="pager__status">
          <label class="pager__per-page">
            <span>{{ pageSizeLabel() }}</span>
            <select
              data-pager="page-size"
              [value]="pageSize()"
              [disabled]="isDisabled()"
              [attr.aria-label]="pageSizeLabel()"
              (change)="aoTrocarLimite($event)"
            >
              @for (opcao of pageSizeOptions(); track opcao) {
                <option [value]="opcao" [selected]="opcao === pageSize()">{{ opcao }}</option>
              }
            </select>
          </label>
        </span>
      } @else {
        <span class="pager__status" aria-live="polite">
          <span class="pager__page">{{ statusText() }}</span>
        </span>
      }
      <button
        type="button"
        class="pager__btn"
        data-pager="next"
        [attr.aria-disabled]="proximoIndisponivel() ? 'true' : null"
        (click)="acionarProximo()"
      >
        Próximo
      </button>
    </nav>
  `,
})
export class PagerComponent {
  readonly statusText = input<string>('Resultados carregados');
  readonly navigationLabel = input<string>('Paginação');
  readonly hasPrevious = input<boolean>(false);
  readonly hasNext = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);
  /**
   * Opções de "itens por página". Vazio (padrão) mantém o rodapé só com o texto
   * de status; com opções, o texto dá lugar a um seletor de limite (anatomia
   * `.pager__per-page` do Uni+ DS). Trocar o limite é responsabilidade do
   * container: ele deve reagir ao `pageSize` e recarregar a primeira página (o
   * cursor da página atual carrega o limite antigo, ADR-0026).
   */
  readonly pageSizeOptions = input<readonly number[]>([]);
  readonly pageSizeLabel = input<string>('Itens por página');
  readonly pageSize = model<number | null>(null);
  readonly previous = output<void>();
  readonly next = output<void>();

  protected readonly anteriorIndisponivel = computed(
    () => !this.hasPrevious() || this.isDisabled(),
  );
  protected readonly proximoIndisponivel = computed(() => !this.hasNext() || this.isDisabled());

  protected acionarAnterior(): void {
    if (!this.anteriorIndisponivel()) this.previous.emit();
  }

  protected acionarProximo(): void {
    if (!this.proximoIndisponivel()) this.next.emit();
  }

  protected aoTrocarLimite(event: Event): void {
    const valor = Number((event.target as HTMLSelectElement).value);
    if (!Number.isNaN(valor)) {
      this.pageSize.set(valor);
    }
  }
}
