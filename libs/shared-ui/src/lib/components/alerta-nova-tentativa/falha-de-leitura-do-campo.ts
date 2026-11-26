import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { LeituraAcompanhada } from './leitura-acompanhada';
import { NovaTentativaDoCampoComponent } from './nova-tentativa-do-campo';

let falhaDeLeituraDoCampoIdSeed = 0;

/**
 * A falha de uma leitura que alimenta um campo: a mensagem numa região `role="alert"` e, depois
 * dela, o "Tentar novamente". Decide a visibilidade por dentro, como `ui-falha-de-leitura`.
 */
@Component({
  selector: 'ui-falha-de-leitura-do-campo',
  standalone: true,
  imports: [NovaTentativaDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (leitura().visivel()) {
      <span class="field__error" [id]="id">
        <span role="alert">{{ leitura().mensagem() }}</span>
        <ui-nova-tentativa-do-campo
          [pendente]="leitura().pendente()"
          [indisponivel]="leitura().indisponivel()"
          [fase]="leitura().fase()"
          [assunto]="leitura().assunto"
          (tentar)="leitura().tentar()"
        />
      </span>
    }
  `,
})
export class FalhaDeLeituraDoCampoComponent {
  readonly id = `ui-falha-de-leitura-do-campo-${++falhaDeLeituraDoCampoIdSeed}`;
  readonly leitura = input.required<LeituraAcompanhada>();
}
