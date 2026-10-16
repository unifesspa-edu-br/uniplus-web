import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { ResumoDoFator } from './fator-de-atenuacao';

/**
 * Na Revisão, o que o candidato respondeu sobre o Fator de Atenuação das Desigualdades de Acesso, com o
 * caminho de volta à seção em que respondeu.
 */
@Component({
  selector: 'ui-fator-de-atenuacao-da-inscricao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .fator-da-inscricao {
      display: grid;
      gap: var(--space-3);
      max-width: 68ch;
    }
    .fator-da-inscricao__titulo {
      margin: 0;
      font-size: var(--text-base);
      font-weight: var(--weight-semibold);
    }
    .fator-da-inscricao__respostas {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }
    .fator-da-inscricao__respostas dd {
      margin: 0;
      font-weight: var(--weight-semibold);
    }
  `,
  template: `
    <section class="fator-da-inscricao" [attr.aria-labelledby]="idBase() + '-titulo'">
      <h4 class="fator-da-inscricao__titulo" [id]="idBase() + '-titulo'">
        Fator de Atenuação das Desigualdades de Acesso
      </h4>
      <dl class="fator-da-inscricao__respostas">
        @for (linha of resumo().linhas; track linha.rotulo) {
          <div>
            <dt>{{ linha.rotulo }}</dt>
            <dd>{{ linha.valor }}</dd>
          </div>
        }
      </dl>
      <p>
        <button
          type="button"
          class="btn btn--tertiary btn--sm"
          (click)="irASecao.emit(resumo().secao.chave)"
        >
          Conferir {{ resumo().secao.titulo }}
        </button>
      </p>
    </section>
  `,
})
export class FatorDeAtenuacaoDaInscricaoComponent {
  readonly resumo = input.required<ResumoDoFator>();
  /** Distingue o título desta região de outras na página. */
  readonly idBase = input.required<string>();
  readonly irASecao = output<string>();
}
