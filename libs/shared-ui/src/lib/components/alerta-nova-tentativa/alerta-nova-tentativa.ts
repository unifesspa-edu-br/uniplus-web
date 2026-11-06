import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AlertComponent } from '../alert/alert';
import { FaseDaNovaTentativa } from './nova-tentativa';
import { SituacaoDaNovaTentativaComponent } from './situacao-da-nova-tentativa';

const MENSAGEM_PADRAO = 'A lista não foi carregada.';

/**
 * Alerta de falha de uma leitura, com "Tentar novamente". É o único alerta de nova tentativa do
 * sistema: quem lê a tela e quem a ouve recebem a mesma resposta a cada tentativa.
 *
 * O texto da fase (`tentando`, `repetida`) mora numa região `role="status"` que existe desde o
 * primeiro quadro, depois do botão, fora da região `role="alert"` do aviso: o texto muda dentro do
 * mesmo nó, e o leitor de tela anuncia o que a pessoa vê. A fase vem de `acompanharNovaTentativa`.
 *
 * O botão fica com `aria-disabled`, e não `disabled`, enquanto a leitura corre: continua focável,
 * e o foco não cai no body no meio da nova tentativa. A guarda contra o clique repetido é de quem
 * trata `tentar` (a mesma de `acompanharNovaTentativa`).
 */
@Component({
  selector: 'ui-alerta-nova-tentativa',
  standalone: true,
  imports: [AlertComponent, SituacaoDaNovaTentativaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert [variant]="variante()" [heading]="titulo()">
      <span [attr.id]="idMensagem()">{{ texto() }}</span>
      <div alertaAcoes class="list-state__retry">
        <button
          type="button"
          [attr.id]="idBotao()"
          class="btn btn--secondary btn--sm"
          [attr.aria-disabled]="pendente() || indisponivel() ? 'true' : null"
          [attr.aria-busy]="pendente() ? 'true' : null"
          (click)="tentar.emit()"
        >
          @if (pendente()) {
            <span class="spinner spinner--sm" aria-hidden="true"></span>
          }
          Tentar novamente
        </button>
        <ui-situacao-da-nova-tentativa [fase]="fase()" />
      </div>
    </ui-alert>
  `,
})
export class AlertaNovaTentativaComponent {
  readonly titulo = input.required<string>();
  readonly mensagem = input.required<string>();
  /** A nova tentativa está em curso: o botão fica ocupado, sem perder o foco. */
  readonly pendente = input(false);
  /** A leitura não pode ser pedida agora por outro motivo (uma gravação corre): só `aria-disabled`. */
  readonly indisponivel = input(false);
  readonly fase = input.required<FaseDaNovaTentativa>();
  readonly variante = input<'warning' | 'danger'>('danger');
  /** Id do botão, para o foco e para quem precisa referenciá-lo. */
  readonly idBotao = input<string | null>(null);
  /** Id do texto da mensagem, para ligá-lo a um campo por `aria-describedby`. */
  readonly idMensagem = input<string | null>(null);
  readonly tentar = output<void>();

  protected readonly texto = computed(() => this.mensagem().trim() || MENSAGEM_PADRAO);
}
