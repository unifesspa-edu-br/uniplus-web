import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReferenciaAoSuporteComponent } from '@uniplus/shared-ui/components';

import type { ErroDoPasso } from '../wizard/processo-seletivo.models';

/**
 * O resumo do erro do passo em tela. Só as mensagens ficam na região que anuncia o erro; as
 * referências ao suporte, com o botão de copiar, ficam fora dela para o leitor de tela anunciar o
 * erro uma vez só. O contêiner `.step-error` é o destino do foco do editor e não anuncia nada.
 */
@Component({
  selector: 'sel-resumo-do-erro-do-passo',
  standalone: true,
  imports: [ReferenciaAoSuporteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step-error">
      <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
      <div class="step-error__content">
        <div class="step-error__alerta" role="alert">
          <strong class="step-error__summary">
            @if (erro().mensagens.length === 1) {
              Há 1 erro no formulário
            } @else {
              Há {{ erro().mensagens.length }} erros no formulário
            }
          </strong>
          <ul class="step-error__list u-list">
            @for (mensagem of erro().mensagens; track mensagem) {
              <li>{{ mensagem }}</li>
            }
          </ul>
        </div>
        @for (item of erro().referencias; track item.passo) {
          <ui-referencia-ao-suporte [referencia]="item.referencia" [passo]="item.passo" />
        }
      </div>
    </div>
  `,
})
export class ResumoDoErroDoPassoComponent {
  readonly erro = input.required<ErroDoPasso>();
}
