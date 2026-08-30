import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AlertComponent } from '../alert/alert';

/** Catálogo cuja busca foi recusada, com o gatilho para tentar de novo. */
export interface UiLookupFalho {
  /** Nome do catálogo como aparece na frase de nova tentativa ("cursos"). */
  readonly nome: string;
  recarregar(): void;
}

/**
 * Anuncia, uma vez por listagem, os catálogos de chave estrangeira que não
 * puderam ser carregados, e oferece a nova tentativa de cada um.
 *
 * O par natural de `ui-lookup-label`: a célula diz que aquele rótulo não
 * resolveu, e este alerta diz por quê e o que fazer. A ação vive aqui, e não
 * na célula, porque numa tabela ela se repetiria por linha — dezenas de
 * controles com o mesmo nome acessível para quem navega por leitor de tela.
 */
@Component({
  selector: 'ui-lookup-alert',
  standalone: true,
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lookup-alert' },
  template: `
    @if (falhas().length > 0) {
      <ui-alert variant="warning" heading="Rótulos não carregados">
        {{ mensagem() }}
        <span class="lookup-alert__acoes">
          @for (falha of falhas(); track falha.nome) {
            <button type="button" class="lookup-alert__retry" (click)="falha.recarregar()">
              Recarregar {{ falha.nome }}
            </button>
          }
        </span>
      </ui-alert>
    }
  `,
})
export class LookupAlertComponent {
  readonly falhas = input.required<readonly UiLookupFalho[]>();

  protected readonly mensagem = computed(() =>
    this.falhas().length === 1
      ? 'A coluna afetada mostra “Não carregado” até a busca ser refeita.'
      : 'As colunas afetadas mostram “Não carregado” até a busca ser refeita.',
  );
}
