import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatarDataBr } from '@uniplus/shared-utils';
import type { AtoDaProtecaoDto, AtoDeDecisao } from '@uniplus/shared-data/configuracao';
import { TagComponent, type UiTagVariant } from '@uniplus/shared-ui/components';
import { CLASSIFICACOES_DE_PROTECAO, rotuloDe } from './protecao-de-dados';

interface RotuloDoAto {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const ATOS: Readonly<Record<string, RotuloDoAto>> = {
  SOLICITACAO: { texto: 'Solicitação', variante: 'info' },
  APROVACAO: { texto: 'Aprovação', variante: 'success' },
  AJUSTE_RECOMENDADO: { texto: 'Ajuste recomendado', variante: 'warning' },
  REPROVACAO: { texto: 'Reprovação', variante: 'danger' },
  ACEITE: { texto: 'Aceite da recomendação', variante: 'success' },
};

/** O rótulo do ato registrado, ou o próprio token quando o vocabulário não o conhece. */
export function rotuloDoAto(ato: string): RotuloDoAto {
  return ATOS[ato] ?? { texto: ato, variante: 'neutral' };
}

/** As decisões que a lista da proteção de dados filtra, com o texto da decisão tomada. */
export const DECISOES_FILTRAVEIS: readonly {
  readonly valor: AtoDeDecisao;
  readonly rotulo: string;
}[] = [
  { valor: 'APROVACAO', rotulo: 'Aprovado' },
  { valor: 'AJUSTE_RECOMENDADO', rotulo: 'Ajuste recomendado' },
  { valor: 'REPROVACAO', rotulo: 'Reprovado' },
];

/**
 * Os atos da proteção de dados de um item, em ordem cronológica: o que aconteceu, quando, quem agiu e
 * a proteção que valia no instante. O ajuste recomendado traz a classificação indicada, e ele e a
 * reprovação trazem a justificativa quando houver.
 */
@Component({
  selector: 'cfg-atos-da-protecao',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './atos-da-protecao.css',
  template: `
    @if (atos().length === 0) {
      <p class="u-caption">{{ textoVazio() }}</p>
    } @else {
      <ol class="cfg-atos" [attr.aria-label]="ariaLabel()">
        @for (ato of atos(); track $index) {
          <li class="cfg-atos__item">
            <div class="cfg-atos__cabecalho">
              <ui-tag [variant]="rotulo(ato.ato).variante">{{ rotulo(ato.ato).texto }}</ui-tag>
              <time [attr.datetime]="ato.instante">{{ data(ato.instante) }}</time>
            </div>
            <p class="cfg-atos__quem">{{ ato.atorNome || 'Pessoa não identificada' }}</p>
            @if (ato.classificacaoRecomendada; as recomendada) {
              <p class="table-responsive__meta">
                Classificação recomendada: {{ classificacao(recomendada) }}
              </p>
            }
            @if (ato.justificativa; as texto) {
              <p class="table-responsive__meta cfg-justificativa">Justificativa: {{ texto }}</p>
            }
          </li>
        }
      </ol>
    }
  `,
})
export class AtosDaProtecaoComponent {
  readonly atos = input.required<readonly AtoDaProtecaoDto[]>();
  readonly ariaLabel = input('Atos da proteção de dados');
  readonly textoVazio = input('Este item ainda não passou pela proteção de dados.');

  protected readonly rotulo = rotuloDoAto;
  protected readonly data = (instante: string): string => formatarDataBr(instante, 'datetime');
  protected readonly classificacao = (token: string): string =>
    rotuloDe(CLASSIFICACOES_DE_PROTECAO, token);
}
