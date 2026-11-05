import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { problemaDaRestricao } from '../modelo/problemas-da-restricao';
import { type LimiteDeDataNoWire, type RestricaoDeValor } from '../modelo/tipos';
import { ErrosDaRestricaoComponent } from './erros-da-restricao';
import { LimiteDeDataComponent, problemaDoLimite } from './limite-de-data';

type NomeDoLimiteDeData = 'dataMinima' | 'dataMaxima';

const LIMITES: readonly { readonly limite: NomeDoLimiteDeData; readonly rotulo: string }[] = [
  { limite: 'dataMinima', rotulo: 'Data mínima' },
  { limite: 'dataMaxima', rotulo: 'Data máxima' },
];

export interface MudancaDeLimiteDeData {
  readonly limite: NomeDoLimiteDeData;
  readonly valor: LimiteDeDataNoWire | null;
}

/**
 * Os dois limites da faixa de datas. O problema e a recusa da faixa inteira — a mínima depois da
 * máxima — aparecem no controle da data máxima; sem limite nenhum, não há controle a que ligá-los, e
 * aparecem depois dos limites.
 */
@Component({
  selector: 'ui-faixa-de-datas',
  standalone: true,
  imports: [LimiteDeDataComponent, ErrosDaRestricaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './anfitriao.css',
  template: `
    <p class="field__hint" [id]="idBase() + '-dica'">
      Cada limite é uma data fixa ou o dia do envio somado a anos e dias; use números negativos para
      voltar no tempo, como −18 anos para exigir 18 anos completos. Informe ao menos um limite.
    </p>
    <div class="form-grid form-grid--pair">
      @for (parte of limites; track parte.limite) {
        <ui-limite-de-data
          [limite]="limiteDe(parte.limite)"
          [rotulo]="parte.rotulo"
          [idBase]="idBase() + '-' + parte.limite"
          [descricao]="descricaoDoLimite(parte.limite)"
          [disabled]="disabled()"
          (limiteChange)="limiteChange.emit({ limite: parte.limite, valor: $event })"
        >
          @if (parte.limite === 'dataMaxima' && erroNaMaxima()) {
            <ui-erros-da-restricao
              [problema]="problema()"
              [recusas]="recusas()"
              [idBase]="idBase()"
            />
          }
        </ui-limite-de-data>
      }
    </div>
    @if (!erroNaMaxima()) {
      <ui-erros-da-restricao [problema]="problema()" [recusas]="recusas()" [idBase]="idBase()" />
    }
  `,
})
export class FaixaDeDatasComponent {
  readonly restricao = input.required<RestricaoDeValor>();
  readonly idBase = input.required<string>();
  /** As recusas da API que apontam a faixa inteira. */
  readonly recusas = input<readonly string[]>([]);
  readonly disabled = input<boolean>(false);

  readonly limiteChange = output<MudancaDeLimiteDeData>();

  protected readonly limites = LIMITES;
  protected readonly problema = computed(() => problemaDaRestricao(this.restricao()));
  protected readonly erroNaMaxima = computed(
    () => this.restricao().dataMinima != null || this.restricao().dataMaxima != null,
  );

  protected limiteDe(limite: NomeDoLimiteDeData): LimiteDeDataNoWire | null {
    return this.restricao()[limite] ?? null;
  }

  /**
   * A dica da faixa e o erro ou a recusa que o controle do limite cita. A API aponta a faixa inteira
   * (`restricoes[i]`), sem dizer o limite: o problema e a recusa da faixa valem para os dois limites.
   */
  protected descricaoDoLimite(limite: NomeDoLimiteDeData): string | null {
    const ids = [
      `${this.idBase()}-dica`,
      problemaDoLimite(this.limiteDe(limite)) === null ? null : `${this.idBase()}-${limite}-erro`,
      this.problema() === null ? null : `${this.idBase()}-erro`,
      this.recusas().length > 0 ? `${this.idBase()}-recusas` : null,
    ];
    return ids.filter((id) => id !== null).join(' ');
  }
}
