import { Directive, input } from '@angular/core';

import type { LeituraAcompanhada } from './leitura-acompanhada';

/**
 * O indicador de carregamento de uma página cuja leitura tem aviso de falha. Enquanto o aviso está
 * na tela, quem fala é a região de status dele; o indicador perde o `role="status"` para não
 * anunciar a mesma espera duas vezes.
 */
@Directive({
  selector: '[uiIndicadorDaLeitura]',
  standalone: true,
  host: { '[attr.role]': "leitura().visivel() ? null : 'status'" },
})
export class IndicadorDaLeituraDirective {
  readonly leitura = input.required<LeituraAcompanhada>({ alias: 'uiIndicadorDaLeitura' });
}
