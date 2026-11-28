import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RecusaDoCampoComponent } from '@uniplus/shared-ui/components';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

/**
 * As recusas do catálogo a um seletor, junto dele: mensagem da API, código e link da página. O
 * elemento fica na tela mesmo sem recusa, para a região viva já estar montada quando a mensagem
 * entrar e o leitor de tela a anunciar (WCAG 4.1.3). O seletor o referencia por `aria-describedby`
 * com o `id` dado a este elemento.
 */
@Component({
  selector: 'sel-recusas-do-controle',
  imports: [RecusaDoCampoComponent],
  template: `@if (recusas().length > 0) {
    <ui-recusa-do-campo [recusas]="recusas()" />
  }`,
  host: { 'aria-live': 'polite', 'aria-atomic': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class RecusasDoControleComponent {
  readonly recusas = input.required<readonly RecusaDoCampo[]>();
}
