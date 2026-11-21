import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RecusaDoCampoComponent } from '@uniplus/shared-ui/components';

import type { OrigemDaRecusa, RecusaOrdenada } from './ordem-das-recusas';

const NOTA_DA_CONFERENCIA: Readonly<Record<OrigemDaRecusa, string>> = {
  gravacao:
    'Você alterou esta parte depois desta recusa; ela será conferida de novo na próxima gravação.',
  publicacao:
    'Você alterou esta parte depois desta recusa; ela será conferida de novo na próxima publicação.',
};

const NOTA_DA_PUBLICACAO = 'Apontada na última tentativa de publicação.';

/** A nota que explica a recusa a conferir de novo, conforme a resposta que a trouxe. */
export function notaDaConferencia(origem: OrigemDaRecusa): string {
  return NOTA_DA_CONFERENCIA[origem];
}

/**
 * As recusas que o servidor fez a um campo, com a mensagem, o código e a página dele. As que
 * ainda valem aparecem como recusa; as que a pessoa já tocou por baixo, a conferir de novo,
 * seguem à vista com a nota que diz isso e sem marcar o campo como inválido.
 *
 * Quem usa dá um `id` ao elemento do componente e o liga ao campo por `aria-describedby`.
 */
@Component({
  selector: 'sel-recusas-do-campo',
  imports: [RecusaDoCampoComponent],
  template: `
    <ui-recusa-do-campo [recusas]="ativas()" />
    @if (aConferir().length > 0) {
      <ui-recusa-do-campo [recusas]="aConferir()" />
      @for (nota of notas(); track nota) {
        <p class="field__hint">{{ nota }}</p>
      }
    }
    @for (nota of notasDaOrigem(); track nota) {
      <p class="field__hint">{{ nota }}</p>
    }
  `,
  styles: ':host { display: block; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecusasDoCampoComponent {
  readonly recusas = input.required<readonly RecusaOrdenada[]>();

  protected readonly ativas = computed(() => this.recusas().filter((recusa) => !recusa.aConferir));
  protected readonly aConferir = computed(() =>
    this.recusas().filter((recusa) => recusa.aConferir),
  );
  protected readonly notas = computed(() => [
    ...new Set(this.aConferir().map((recusa) => NOTA_DA_CONFERENCIA[recusa.origem])),
  ]);
  protected readonly notasDaOrigem = computed(() => {
    const recusas = this.recusas();
    const daPublicacao = recusas.some((recusa) => recusa.origem === 'publicacao');
    const esclarecimentos = recusas.flatMap((recusa) => recusa.nota ?? []);
    return [...new Set([...(daPublicacao ? [NOTA_DA_PUBLICACAO] : []), ...esclarecimentos])];
  });
}
