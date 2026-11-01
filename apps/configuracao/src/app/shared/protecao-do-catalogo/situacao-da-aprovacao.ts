import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagComponent, type UiTagVariant } from '@uniplus/shared-ui/components';
import { CLASSIFICACOES_DE_PROTECAO, rotuloDe } from './protecao-de-dados';

interface Rotulo {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACOES: Readonly<Record<string, Rotulo>> = {
  PENDENTE: { texto: 'Pendente de solicitação', variante: 'warning' },
  SOLICITADA: { texto: 'Aguardando a proteção de dados', variante: 'info' },
  APROVADA: { texto: 'Aprovada', variante: 'success' },
  NEGADA: { texto: 'Negada pela proteção de dados', variante: 'danger' },
};

/** O rótulo curto da lista, em que a tag cabe numa linha; o detalhe traz o texto por extenso. */
const SITUACOES_EM_LISTA: Readonly<Record<string, string>> = {
  PENDENTE: 'Pendente',
  SOLICITADA: 'Em análise',
  APROVADA: 'Aprovada',
  NEGADA: 'Negada',
};

/** O rótulo da situação de aprovação, ou o próprio token quando o vocabulário não o conhece. */
export function rotuloDaSituacao(situacao: string): Rotulo {
  return SITUACOES[situacao] ?? { texto: situacao, variante: 'neutral' };
}

/**
 * Onde o item do catálogo está no circuito de aprovação da proteção de dados. A situação sai
 * sempre como texto, e a negativa traz a classificação que a proteção de dados recomendou.
 */
@Component({
  selector: 'cfg-situacao-da-aprovacao',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-tag [variant]="rotulo().variante">{{ rotulo().texto }}</ui-tag>
    @if (!emLista() && recomendada(); as classificacao) {
      <div class="table-responsive__meta">Classificação recomendada: {{ classificacao }}</div>
    }
  `,
})
export class SituacaoDaAprovacaoComponent {
  readonly situacao = input.required<string>();
  readonly classificacaoRecomendada = input<string | null>(null);
  /** Na célula da lista a situação ocupa uma linha só: rótulo curto e sem a recomendação, que fica no detalhe. */
  readonly emLista = input(false);

  protected readonly rotulo = computed(() => {
    const completo = rotuloDaSituacao(this.situacao());
    const curto = SITUACOES_EM_LISTA[this.situacao()];
    return this.emLista() && curto !== undefined ? { ...completo, texto: curto } : completo;
  });
  protected readonly recomendada = computed(() => {
    const token = this.classificacaoRecomendada();
    return this.situacao() === 'NEGADA' && token ? rotuloDe(CLASSIFICACOES_DE_PROTECAO, token) : null;
  });
}
