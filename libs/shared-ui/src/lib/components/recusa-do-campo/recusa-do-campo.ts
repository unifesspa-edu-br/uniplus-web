import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface RecusaDoCampo {
  readonly codigo: string;
  readonly mensagem: string;
  /** Endereço da página que explica a recusa; `null` quando não há página para o código. */
  readonly pagina: string | null;
}

/**
 * Mostra as recusas que a API fez a um campo: a mensagem, o código e, quando existe, o
 * link da página que explica a recusa.
 *
 * Quem usa dá um `id` ao elemento do componente e o liga ao campo por `aria-describedby`.
 * O anúncio ao ler a tela fica a cargo da região viva que contém o campo.
 */
@Component({
  selector: 'ui-recusa-do-campo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (recusa of recusas(); track $index) {
      <p class="field__error">
        <span>{{ recusa.mensagem }}</span>
        <span
          >Código: <code>{{ recusa.codigo }}</code></span
        >
        @if (recusa.pagina !== null) {
          <a [href]="recusa.pagina" target="_blank" rel="noopener noreferrer">
            Entenda a recusa
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14">
              <path
                d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
            </svg>
            <span class="sr-only">, abre em nova aba</span>
          </a>
        }
      </p>
    }
  `,
})
export class RecusaDoCampoComponent {
  readonly recusas = input<readonly RecusaDoCampo[]>([]);
}
