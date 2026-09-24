import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';

import { nullIfBlank } from '../formulario';
import { comPontoFinal } from '../texto';

const MENSAGEM_PADRAO = 'A lista não foi carregada.';

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
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert [variant]="variante()" [heading]="titulo()">
      <span [attr.id]="idMensagem()">{{ texto() }}</span>
      <div class="cfg-list__retry">
        <button
          type="button"
          [attr.id]="idBotao()"
          class="btn btn--secondary btn--sm"
          [attr.aria-disabled]="pendente() ? 'true' : null"
          [attr.aria-busy]="pendente() ? 'true' : null"
          (click)="tentar.emit()"
        >
          <!-- Dentro do alerta, que é região viva: o rótulo não muda e o spinner não é
               anunciado, para a espera não reler o alerta inteiro. -->
          @if (pendente()) {
            <span class="spinner spinner--sm" aria-hidden="true"></span>
          }
          Tentar novamente
        </button>
      </div>
    </ui-alert>
  `,
})
export class AlertaNovaTentativaComponent {
  readonly titulo = input.required<string>();
  readonly mensagem = input.required<string>();
  readonly pendente = input.required<boolean>();
  /** Falhas seguidas das tentativas pedidas pelo operador, contadas por quem faz a carga.
   *  A partir da segunda, o número entra no texto: uma nova falha com a mesma recusa
   *  deixaria o texto idêntico, e o leitor de tela não anunciaria nada. */
  readonly tentativasSemSucesso = input.required<number>();
  readonly variante = input<'warning' | 'danger'>('danger');
  /** Id do botão, para o foco e para quem precisa referenciá-lo. */
  readonly idBotao = input<string | null>(null);
  /** Id do texto da mensagem, para ligá-lo a um campo por `aria-describedby`. */
  readonly idMensagem = input<string | null>(null);
  readonly tentar = output<void>();

  protected readonly texto = computed(() => {
    const mensagem = nullIfBlank(this.mensagem()) ?? MENSAGEM_PADRAO;
    const tentativas = this.tentativasSemSucesso();
    return tentativas < 2
      ? mensagem
      : `${comPontoFinal(mensagem)} Tentativa ${tentativas} sem sucesso.`;
  });
}
