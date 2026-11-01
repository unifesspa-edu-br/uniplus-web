import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagComponent, type UiTagVariant } from '@uniplus/shared-ui/components';
import { CLASSIFICACOES_DE_PROTECAO, rotuloDe } from './protecao-de-dados';

interface Rotulo {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACOES: Readonly<Record<string, Rotulo>> = {
  PENDENTE: { texto: 'Pendente', variante: 'warning' },
  SOLICITADA: { texto: 'Em análise', variante: 'info' },
  APROVADA: { texto: 'Aprovada', variante: 'success' },
  AJUSTE_RECOMENDADO: { texto: 'Ajuste recomendado', variante: 'warning' },
  REPROVADA: { texto: 'Reprovada', variante: 'danger' },
};

/** O rótulo da situação de aprovação, ou o próprio token quando o vocabulário não o conhece. */
export function rotuloDaSituacao(situacao: string): Rotulo {
  return SITUACOES[situacao] ?? { texto: situacao, variante: 'neutral' };
}

/**
 * Onde o item do catálogo está no circuito de aprovação da proteção de dados. A situação sai
 * sempre como texto; o ajuste recomendado traz a classificação que a proteção de dados indicou, e
 * ele e a reprovação trazem a justificativa quando houver. Na lista só a tag aparece.
 */
@Component({
  selector: 'cfg-situacao-da-aprovacao',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-tag [variant]="rotulo().variante">{{ rotulo().texto }}</ui-tag>
    @if (!emLista()) {
      @if (recomendada(); as classificacao) {
        <div class="table-responsive__meta">Classificação recomendada: {{ classificacao }}</div>
      }
      @if (justificativa(); as texto) {
        <div class="table-responsive__meta cfg-justificativa">Justificativa: {{ texto }}</div>
      }
    }
  `,
})
export class SituacaoDaAprovacaoComponent {
  readonly situacao = input.required<string>();
  readonly classificacaoRecomendada = input<string | null>(null);
  readonly justificativa = input<string | null>(null);
  /** Na célula da lista a situação ocupa uma linha só: sem a recomendação nem a justificativa, que ficam no detalhe. */
  readonly emLista = input(false);

  protected readonly rotulo = computed(() => rotuloDaSituacao(this.situacao()));
  protected readonly recomendada = computed(() => {
    const token = this.classificacaoRecomendada();
    return this.situacao() === 'AJUSTE_RECOMENDADO' && token ? rotuloDe(CLASSIFICACOES_DE_PROTECAO, token) : null;
  });
}
