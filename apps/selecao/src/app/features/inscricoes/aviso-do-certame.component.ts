import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

/**
 * O aviso de que o certame não pôde ser lido, com a nova tentativa. Enquanto relê, o botão fica
 * desabilitado e uma região viva, sempre no DOM, anuncia a releitura.
 */
@Component({
  selector: 'sel-aviso-do-certame',
  standalone: true,
  imports: [AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert variant="warning" heading="Não foi possível carregar o nome do processo e dos cursos">
      Os cursos aparecem sem nome até a leitura dar certo.
      <span class="aviso-do-certame__tentar">
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          [disabled]="carregando()"
          (click)="tentar.emit()"
        >
          Tentar novamente
        </button>
        <span class="aviso-do-certame__lendo" role="status">
          @if (carregando()) {
            <ui-spinner spinnerSize="sm" />
            Recarregando o nome do processo e dos cursos
          }
        </span>
      </span>
    </ui-alert>
  `,
  styles: `
    .aviso-do-certame__tentar {
      display: block;
      margin-top: var(--space-2);
    }
    .aviso-do-certame__lendo {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--text-secondary);
    }
  `,
})
export class AvisoDoCertameComponent {
  /** A releitura do certame está em curso. */
  readonly carregando = input.required<boolean>();
  readonly tentar = output<void>();
}
