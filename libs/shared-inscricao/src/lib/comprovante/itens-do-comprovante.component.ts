import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ItemDoComprovanteDto } from '@uniplus/shared-data/selecao';
import {
  DadoDirective,
  ListaDeDadosComponent,
  RespostaExibidaComponent,
  valorExibido,
} from '@uniplus/shared-ui/components';

/** As respostas de um trecho do comprovante, na ordem e com o rótulo que a API devolve. */
@Component({
  selector: 'ptl-itens-do-comprovante',
  standalone: true,
  imports: [DadoDirective, ListaDeDadosComponent, RespostaExibidaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-lista-de-dados [colunas]="colunas()">
      @for (resposta of respostas(); track $index) {
        <ng-template uiDado [rotulo]="resposta.rotulo">
          <ui-resposta-exibida [exibido]="resposta.exibido" />
        </ng-template>
      }
    </ui-lista-de-dados>
  `,
})
export class ItensDoComprovanteComponent {
  readonly itens = input.required<readonly ItemDoComprovanteDto[]>();
  readonly colunas = input<1 | 2>(2);

  protected readonly respostas = computed(() =>
    this.itens().map((item) => ({
      rotulo: item.rotulo,
      exibido: valorExibido(item.tipo, item.valor, item.componente),
    })),
  );
}
