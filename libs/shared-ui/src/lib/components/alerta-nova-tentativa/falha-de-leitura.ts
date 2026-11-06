import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AlertaNovaTentativaComponent } from './alerta-nova-tentativa';
import type { LeituraAcompanhada } from './leitura-acompanhada';

/**
 * O aviso de falha de uma leitura acompanhada. Decide a visibilidade por dentro: a tela o põe
 * sempre no modelo, sem `@if` em volta, e ele só desenha a caixa quando há falha ou tentativa.
 */
@Component({
  selector: 'ui-falha-de-leitura',
  standalone: true,
  imports: [AlertaNovaTentativaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (leitura().visivel()) {
      <ui-alerta-nova-tentativa
        [titulo]="titulo()"
        [mensagem]="leitura().mensagem()"
        [pendente]="leitura().pendente()"
        [indisponivel]="leitura().indisponivel()"
        [fase]="leitura().fase()"
        [variante]="variante()"
        [idBotao]="idBotao()"
        [idMensagem]="idMensagem()"
        (tentar)="leitura().tentar()"
      />
    }
  `,
})
export class FalhaDeLeituraComponent {
  readonly titulo = input.required<string>();
  readonly leitura = input.required<LeituraAcompanhada>();
  readonly variante = input<'warning' | 'danger'>('danger');
  /** Id do botão, para quem precisa referenciá-lo. */
  readonly idBotao = input<string | null>(null);
  /** Id do texto da mensagem, para ligá-lo a um campo por `aria-describedby`. */
  readonly idMensagem = input<string | null>(null);
}
