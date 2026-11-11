import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ConcessaoSuspensaDto, EtapaDaVersao } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { etapa as rotuloDaEtapa } from '../rotulos-de-acesso';
import { PESSOA_SEM_NOME } from './concessoes-da-etapa';

/** As concessões que a reclassificação suspendeu, com a situação de cada etapa; a pessoa marca as que decide. */
@Component({
  selector: 'cfg-concessoes-suspensas',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-responsive">
      <table>
        <caption class="sr-only">
          Concessões suspensas pela reclassificação
        </caption>
        <thead>
          <tr>
            @if (podeMarcar()) {
              <th scope="col"><span class="sr-only">Marcar para decidir</span></th>
            }
            <th scope="col">Pessoa</th>
            <th scope="col">Escopo</th>
            <th scope="col">Versão</th>
            <th scope="col">Etapas</th>
          </tr>
        </thead>
        <tbody>
          @for (concessao of concessoes(); track concessao.concessaoId) {
            <tr>
              @if (podeMarcar()) {
                <td data-label="Marcar">
                  @if (marcavel(concessao)) {
                    <label class="checkbox">
                      <input
                        type="checkbox"
                        [checked]="marcadas().has(concessao.concessaoId)"
                        [disabled]="bloqueado()"
                        (change)="alternar.emit(concessao.concessaoId)"
                      />
                      <span class="checkbox__box" aria-hidden="true"></span>
                      <span class="sr-only">Decidir a concessão de {{ nome(concessao) }}</span>
                    </label>
                  }
                </td>
              }
              <td data-label="Pessoa">
                {{ nome(concessao) }}
                @if (concessao.ehDoLeitor) {
                  <ui-tag variant="info">Sua concessão</ui-tag>
                }
              </td>
              <td data-label="Escopo">{{ nomeDoEscopo()(concessao) }}</td>
              <td data-label="Versão">{{ concessao.versao ?? '—' }}</td>
              <td data-label="Etapas">
                <ul role="list" style="list-style: none; margin: 0; padding: 0">
                  @for (exigida of concessao.etapasExigidas; track exigida) {
                    <li>
                      {{ rotulo(exigida) }}:
                      {{
                        concessao.etapasDecididas.includes(exigida)
                          ? 'decidida'
                          : 'aguarda a decisão'
                      }}
                    </li>
                  }
                </ul>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ConcessoesSuspensasComponent {
  readonly concessoes = input.required<readonly ConcessaoSuspensaDto[]>();
  readonly nomeDoEscopo = input.required<(concessao: ConcessaoSuspensaDto) => string>();
  /** A etapa que a pessoa decide; sem ela, a tabela é só de consulta. */
  readonly etapa = input<EtapaDaVersao | undefined>(undefined);
  readonly marcadas = input.required<ReadonlySet<string>>();
  readonly bloqueado = input(false);
  readonly alternar = output<string>();

  protected readonly podeMarcar = computed(() => this.etapa() !== undefined);
  protected readonly rotulo = (codigo: string): string => rotuloDaEtapa(codigo).toLowerCase();

  protected nome(concessao: ConcessaoSuspensaDto): string {
    return concessao.beneficiarioNome ?? PESSOA_SEM_NOME;
  }

  protected marcavel(concessao: ConcessaoSuspensaDto): boolean {
    const etapa = this.etapa();
    return (
      etapa !== undefined &&
      !concessao.ehDoLeitor &&
      concessao.etapasExigidas.includes(etapa) &&
      !concessao.etapasDecididas.includes(etapa)
    );
  }
}
