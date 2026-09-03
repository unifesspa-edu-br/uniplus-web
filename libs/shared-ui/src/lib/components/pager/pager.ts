import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
    -->
    <nav class="pager" [attr.aria-label]="navigationLabel()">
      <button
        type="button"
        class="pager__btn"
        data-pager="prev"
        [disabled]="!hasPrevious() || isDisabled()"
        (click)="previous.emit()"
      >
        Anterior
      </button>
      <span class="pager__status" aria-live="polite">
        <span class="pager__page">{{ statusText() }}</span>
      </span>
      <button
        type="button"
        class="pager__btn"
        data-pager="next"
        [disabled]="!hasNext() || isDisabled()"
        (click)="next.emit()"
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
  readonly previous = output<void>();
  readonly next = output<void>();
}
