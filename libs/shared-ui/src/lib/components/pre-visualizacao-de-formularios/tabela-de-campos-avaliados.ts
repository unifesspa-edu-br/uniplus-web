import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { rotuloDoEstado } from './estado-avaliado';
import type { ItemAvaliado } from './pre-visualizacao-de-formularios';

/** A tabela dos campos avaliados diante das respostas simuladas: o que aparece, o que é obrigatório e o que impede a inscrição. */
@Component({
  selector: 'ui-tabela-de-campos-avaliados',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-responsive' },
  template: `
    <table>
      <caption class="sr-only">{{ legenda() }}</caption>
      <thead>
        <tr>
          <th scope="col">Campo</th>
          @if (comSecao()) {
            <th scope="col">Seção</th>
          }
          <th scope="col">Exibido</th>
          <th scope="col">Obrigatório</th>
          <th scope="col">Impede a inscrição</th>
          <th scope="col">Restrição violada</th>
        </tr>
      </thead>
      <tbody>
        @for (item of itens(); track item.fatoCodigo) {
          <tr>
            <td data-label="Campo">{{ rotuloDoCampo()(item.fatoCodigo) }}</td>
            @if (comSecao()) {
              <td data-label="Seção">{{ tituloDaEtapa()(item.etapaCodigo) }}</td>
            }
            <td data-label="Exibido">{{ estado(item.visivel) }}</td>
            <td data-label="Obrigatório">{{ estado(item.obrigatorio) }}</td>
            <td data-label="Impede a inscrição">
              {{ estado(item.impedido) }}
              @if (item.impedido === 'VERDADEIRO' && item.mensagemDoImpedimento) {
                <span class="pre-visualizacao-formularios__mensagem">{{ item.mensagemDoImpedimento }}</span>
              }
            </td>
            <td data-label="Restrição violada">{{ item.restricoesVioladas.join(', ') || '—' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class TabelaDeCamposAvaliadosComponent {
  readonly itens = input.required<readonly ItemAvaliado[]>();
  /** A legenda da tabela, lida pelo leitor de tela. */
  readonly legenda = input.required<string>();
  readonly rotuloDoCampo = input.required<(fatoCodigo: string) => string>();
  readonly tituloDaEtapa = input<(etapaCodigo: string | null) => string>(() => '—');
  /** Mostra a seção de cada campo; os campos de uma ocorrência de grupo ficam todos na seção do grupo. */
  readonly comSecao = input<boolean>(true);

  protected estado(token: string): string {
    return rotuloDoEstado(token);
  }
}
