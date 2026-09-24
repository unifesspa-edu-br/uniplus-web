import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

/**
 * Alerta de falha de carga de uma lista de referência, com "Tentar novamente".
 *
 * O botão fica com `aria-disabled`, e não `disabled`, enquanto a lista carrega: continua
 * focável, e o foco não cai no body no meio da nova tentativa. A guarda contra o clique
 * repetido é de quem trata `tentar` (ver `focarAposNovaTentativa`), com o mesmo `pendente`.
 */
@Component({
  selector: 'cfg-alerta-nova-tentativa',
  standalone: true,
  imports: [AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert [variant]="variante()" [heading]="titulo()">
      <span [attr.id]="idMensagem()">{{ mensagem() }}</span>
      <div class="cfg-list__retry">
        <button
          type="button"
          [attr.id]="idBotao()"
          class="btn btn--secondary btn--sm"
          [attr.aria-disabled]="pendente() ? 'true' : null"
          (click)="tentar.emit()"
        >
          @if (pendente()) {
            <ui-spinner size="sm" />
            Carregando...
          } @else {
            Tentar novamente
          }
        </button>
      </div>
    </ui-alert>
  `,
})
export class AlertaNovaTentativaComponent {
  readonly titulo = input.required<string>();
  readonly mensagem = input.required<string>();
  readonly pendente = input.required<boolean>();
  readonly variante = input<'warning' | 'danger'>('danger');
  /** Id do botão, para o foco e para quem precisa referenciá-lo. */
  readonly idBotao = input<string | null>(null);
  /** Id do texto da mensagem, para ligá-lo a um campo por `aria-describedby`. */
  readonly idMensagem = input<string | null>(null);
  readonly tentar = output<void>();
}
