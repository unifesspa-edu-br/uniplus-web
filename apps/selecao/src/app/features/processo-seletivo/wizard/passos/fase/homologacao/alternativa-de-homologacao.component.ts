import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import type { AlternativaDeHomologacao } from '../../../modelos/homologacao.models';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { CondicaoDeHomologacaoComponent } from './condicao-de-homologacao.component';
import { sufixoDaRecusaDaHomologacao, sufixoDoBotaoDeIncluirCondicao } from './ids-da-homologacao';
import { RegraDeHomologacaoDaFase } from './regra-de-homologacao-da-fase';

/**
 * Uma alternativa (OU) da regra de homologação: as condições que precisam valer juntas (E). A
 * alternativa que perde a última condição deixa de existir.
 */
@Component({
  selector: 'sel-alternativa-de-homologacao',
  imports: [CondicaoDeHomologacaoComponent, RecusasDoCampoComponent],
  templateUrl: './alternativa-de-homologacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .acoes > .btn {
      max-width: 100%;
      white-space: normal;
      text-align: start;
    }
  `,
})
export class AlternativaDeHomologacaoComponent {
  readonly posicao = input.required<number>();
  readonly alternativa = input.required<AlternativaDeHomologacao>();

  protected readonly regra = inject(RegraDeHomologacaoDaFase);

  /** O campo que a recusa à alternativa inteira nomeia. */
  protected campo(): `homologacao.alternativas.${number}` {
    return `homologacao.alternativas.${this.posicao()}`;
  }

  protected idDaAlternativa(): string {
    return this.regra.idDaFase(`homologacao-alternativas-${this.posicao()}`);
  }

  protected idDaRecusa(): string {
    return this.regra.idDaFase(sufixoDaRecusaDaHomologacao(this.campo()));
  }

  protected idDoBotaoDeIncluirCondicao(): string {
    return this.regra.idDaFase(sufixoDoBotaoDeIncluirCondicao(this.posicao()));
  }
}
