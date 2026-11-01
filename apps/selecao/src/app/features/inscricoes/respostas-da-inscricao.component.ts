import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ItemDeRespostaDto } from '@uniplus/shared-data/selecao';
import {
  DadoDirective,
  ListaDeDadosComponent,
  ValorApresentadoComponent,
  type UiValorEmConsulta,
} from '@uniplus/shared-ui/components';

import { valorExibido } from './valor-da-resposta';

/** Uma resposta pronta para a lista: o endereço sai em linhas; o resto, pelo valor em consulta. */
interface RespostaExibida {
  readonly fatoCodigo: string;
  readonly rotulo: string;
  readonly descricao: string;
  readonly linhas: readonly string[] | null;
  readonly valor: UiValorEmConsulta;
}

function respostaExibida(item: ItemDeRespostaDto): RespostaExibida {
  const base = {
    fatoCodigo: item.fatoCodigo,
    rotulo: item.rotulo,
    descricao: item.descricao,
  };
  const exibido = valorExibido(item.tipo, item.valor);
  return 'linhas' in exibido
    ? { ...base, linhas: exibido.linhas, valor: null }
    : { ...base, linhas: null, valor: exibido.valor };
}

/**
 * As respostas de uma inscrição como lista de dados: o rótulo, o valor segundo o `tipo` e a
 * descrição do campo como dica, em texto visível, que o teclado, o leitor de tela e o toque
 * alcançam do mesmo jeito. Mostra só os itens que recebe; o valor é calculado uma vez por item.
 */
@Component({
  selector: 'sel-respostas-da-inscricao',
  standalone: true,
  imports: [DadoDirective, ListaDeDadosComponent, ValorApresentadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-lista-de-dados [colunas]="2">
      @for (resposta of respostas(); track resposta.fatoCodigo) {
        <ng-template uiDado [rotulo]="resposta.rotulo">
          @if (resposta.linhas; as linhas) {
            @for (linha of linhas; track $index) {
              <span class="resposta__linha">{{ linha }}</span>
            }
          } @else {
            <ui-valor-apresentado [valor]="resposta.valor" />
          }
          @if (resposta.descricao) {
            <small class="resposta__dica">{{ resposta.descricao }}</small>
          }
        </ng-template>
      }
    </ui-lista-de-dados>
  `,
  styles: `
    .resposta__linha {
      display: block;
      overflow-wrap: anywhere;
    }
    .resposta__dica {
      display: block;
      margin-top: var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
  `,
})
export class RespostasDaInscricaoComponent {
  readonly itens = input.required<readonly ItemDeRespostaDto[]>();

  protected readonly respostas = computed(() => this.itens().map(respostaExibida));
}
