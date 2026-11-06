import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FaseDaNovaTentativa, textoDaNovaTentativa } from './nova-tentativa';

/**
 * O texto da fase da nova tentativa, numa região `role="status"` que existe desde o primeiro
 * quadro: o texto muda dentro do mesmo nó, e o leitor de tela anuncia o que a pessoa vê.
 * Serve ao alerta e a qualquer mensagem de campo que tenha "Tentar novamente".
 */
@Component({
  selector: 'ui-situacao-da-nova-tentativa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'list-state__status', role: 'status' },
  template: `{{ texto() }}`,
})
export class SituacaoDaNovaTentativaComponent {
  readonly fase = input.required<FaseDaNovaTentativa>();
  /** O que é lido, quando quem mostra cuida de mais de uma leitura. */
  readonly assunto = input<string | undefined>(undefined);

  protected readonly texto = computed(() => textoDaNovaTentativa(this.fase(), this.assunto()));
}
