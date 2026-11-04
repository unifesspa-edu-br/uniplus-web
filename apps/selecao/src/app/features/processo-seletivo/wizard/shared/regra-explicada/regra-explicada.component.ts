import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { RegraExplicada } from './regra-em-linguagem-clara';

/** Base legal, garantias e, quando a regra os declara, os parâmetros do catálogo. */
@Component({
  selector: 'details[selRegraExplicada]',
  templateUrl: './regra-explicada.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegraExplicadaComponent {
  readonly regra = input.required<RegraExplicada>();
  readonly titulo = input.required<string>();
  readonly rotuloDasGarantias = input.required<string>();
  readonly comParametros = input(false);
}
