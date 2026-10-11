import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DadoDirective } from '../lista-de-dados/dado';
import { ListaDeDadosComponent } from '../lista-de-dados/lista-de-dados';
import {
  type UiValorEmConsulta,
  ValorApresentadoComponent,
} from '../lista-de-dados/valor-apresentado';

export type { UiValorEmConsulta };

/**
 * Um campo lido, não preenchido: o rótulo e o valor gravado, como texto.
 *
 * Em consulta, um controle desabilitado não serve de leitura: o cinza de desabilitado não
 * alcança o contraste de texto, o valor longo é cortado pela largura do campo e o select
 * mostra a opção só enquanto o catálogo dela está carregado. O texto quebra linha e nunca
 * trunca.
 *
 * O par é um dado de uma lista de descrição, para o leitor de tela associar o valor ao rótulo.
 * Quando quem rotula é um título que já está na tela, `rotuladoPor` recebe o id dele e só o
 * valor é renderizado, sem repetir o rótulo.
 */
@Component({
  selector: 'ui-valor-em-consulta',
  standalone: true,
  imports: [DadoDirective, ListaDeDadosComponent, ValorApresentadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'valor-em-consulta' },
  template: `
    @if (rotuladoPor(); as id) {
      <div class="dado__valor" role="group" [attr.aria-labelledby]="id">
        <ui-valor-apresentado [valor]="valor()" [seVazio]="seVazio()" [ordenada]="ordenada()" />
      </div>
    } @else {
      <ui-lista-de-dados>
        <ng-template
          uiDado
          [rotulo]="rotulo()"
          [valor]="valor()"
          [seVazio]="seVazio()"
          [ordenada]="ordenada()"
        ></ng-template>
      </ui-lista-de-dados>
    }
    @if (dica(); as texto) {
      <p class="field__hint">{{ texto }}</p>
    }
  `,
})
export class ValorEmConsultaComponent {
  /** O rótulo do campo, o mesmo que ele tem em edição. Ignorado com `rotuladoPor`. */
  readonly rotulo = input<string>('');
  readonly valor = input<UiValorEmConsulta>(null);
  /** Id do título que já rotula o valor na tela, como o de uma seção. */
  readonly rotuladoPor = input<string | null>(null);
  /** O que se lê quando nada foi declarado. */
  readonly seVazio = input<string>('Não informado');
  /** A lista tem ordem que importa, como a de avaliação: numerada, e anunciada como tal. */
  readonly ordenada = input(false, { transform: booleanAttribute });
  /** Contexto que ajuda a ler o valor; instrução de preenchimento não entra aqui. */
  readonly dica = input<string | null>(null);
}
