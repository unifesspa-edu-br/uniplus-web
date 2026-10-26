import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { LeiauteDoInepDto } from '@uniplus/shared-data/selecao';

import type { Leitura } from '../leitura';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';

/** A orientação de um card, recolhida: o que o arquivo é e qual leiaute ele segue. */
@Component({
  selector: 'sel-orientacoes-do-enem',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./compartilhado.css', './orientacoes-do-enem.component.css'],
  template: `
    <details class="notas__orientacoes">
      <summary>Orientações</summary>
      <div class="notas__orientacoes-corpo">
        @if (tipo() === 'envio') {
          <p class="notas__texto">
            O arquivo de envio traz os CPFs dos inscritos da edição, um por linha, no leiaute que o
            INEP espera. Cada arquivo gerado fica registrado no histórico de envios.
          </p>
        } @else {
          <p class="notas__texto">
            O conteúdo do arquivo de retorno não é exibido nesta tela. Se alguma linha não conferir
            com o leiaute, o arquivo é recusado inteiro e nenhuma nota é gravada.
          </p>
        }
        <dl class="notas__leiautes">
          <div>
            <dt>{{ tipo() === 'envio' ? 'Leiaute de envio' : 'Leiaute de retorno' }}</dt>
            @for (leiaute of lista(); track leiaute.codigo + leiaute.versao) {
              <dd>
                <strong>{{ leiaute.codigo }} {{ leiaute.versao }}</strong>
                <span class="notas__leiaute-descricao">{{ leiaute.descricao }}</span>
              </dd>
            } @empty {
              <dd class="notas__texto">Indisponível no momento.</dd>
            }
          </div>
        </dl>
      </div>
    </details>
  `,
})
export class OrientacoesDoEnemComponent {
  private readonly notas = inject(NotasDoEnemDoProcesso);

  readonly tipo = input.required<'envio' | 'retorno'>();

  protected lista(): readonly LeiauteDoInepDto[] {
    const leitura: Leitura<readonly LeiauteDoInepDto[]> =
      this.tipo() === 'envio' ? this.notas.leiautesDeEnvio() : this.notas.leiautesDeRetorno();
    return leitura.estado === 'lido' ? leitura.dados : [];
  }
}
