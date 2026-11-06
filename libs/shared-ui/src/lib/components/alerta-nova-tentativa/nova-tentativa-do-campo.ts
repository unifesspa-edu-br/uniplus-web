import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FaseDaNovaTentativa } from './nova-tentativa';
import { SituacaoDaNovaTentativaComponent } from './situacao-da-nova-tentativa';

/**
 * "Tentar novamente" de uma leitura que alimenta um campo, ou de um catálogo que rotula uma
 * lista: o botão em forma de link e, depois dele, a situação da tentativa. Fica fora da região
 * viva da mensagem de erro, que o precede.
 *
 * O botão fica com `aria-disabled`, e não `disabled`, para continuar focável. Não emite o pedido
 * enquanto a leitura corre (`pendente`) nem quando ela não pode ser pedida agora (`indisponivel`);
 * só `pendente` marca o botão como ocupado.
 */
@Component({
  selector: 'ui-nova-tentativa-do-campo',
  standalone: true,
  imports: [SituacaoDaNovaTentativaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'nova-tentativa-campo' },
  template: `
    <button
      type="button"
      class="link-button"
      [attr.aria-disabled]="pendente() || indisponivel() ? 'true' : null"
      [attr.aria-busy]="pendente() ? 'true' : null"
      (click)="aoClicar($event)"
    >
      {{ rotulo() }}
    </button>
    <ui-situacao-da-nova-tentativa [fase]="fase()" [assunto]="assunto()" />
  `,
})
export class NovaTentativaDoCampoComponent {
  readonly fase = input.required<FaseDaNovaTentativa>();
  /** O que é lido, para a situação dizer o que está sendo recarregado. */
  readonly assunto = input<string | undefined>(undefined);
  readonly rotulo = input('Tentar novamente');
  /** A nova tentativa está em curso: o botão fica ocupado. */
  readonly pendente = input(false);
  /** A leitura não pode ser pedida agora por outro motivo: só `aria-disabled`, sem ocupado. */
  readonly indisponivel = input(false);
  readonly tentar = output<void>();

  protected aoClicar(evento: Event): void {
    if (this.pendente() || this.indisponivel()) {
      evento.preventDefault();
      return;
    }
    this.tentar.emit();
  }
}
