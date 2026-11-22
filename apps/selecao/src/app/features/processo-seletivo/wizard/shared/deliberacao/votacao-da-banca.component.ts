import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';
import { estadoDoControle, type EstadoDoControle } from './estado-do-controle';
import type { CampoDaBanca, RecusasDaBancaPorCampo } from './recusas-da-regra';
import {
  alterarRegra,
  controlesAVista,
  CRITERIOS_DE_VOTACAO,
  DESEMPATES_DA_VOTACAO,
  ENCERRAMENTOS_DA_VOTACAO,
  quorumSegueOsIntegrantes,
  RESULTADOS_SEM_UNANIMIDADE,
  type CampoDaRegra,
} from './regra-de-deliberacao';

@Component({
  selector: 'sel-votacao-da-banca',
  imports: [RecusasDoCampoComponent],
  templateUrl: './votacao-da-banca.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: contents; }',
})
export class VotacaoDaBancaComponent {
  readonly regra = input.required<RegraDeDeliberacaoDaBanca>();
  readonly idBase = input.required<string>();
  readonly desabilitada = input(false);
  /** A conferência feita na tela, por campo. */
  readonly erros = input<Partial<Record<CampoDaBanca, string>>>({});
  /** As recusas do servidor, por campo. */
  readonly recusas = input<RecusasDaBancaPorCampo>({});
  readonly regraChange = output<RegraDeDeliberacaoDaBanca>();

  protected readonly criterios = CRITERIOS_DE_VOTACAO;
  protected readonly desempates = DESEMPATES_DA_VOTACAO;
  protected readonly encerramentos = ENCERRAMENTOS_DA_VOTACAO;
  protected readonly semUnanimidade = RESULTADOS_SEM_UNANIMIDADE;
  protected readonly quorumFixo = computed(() => quorumSegueOsIntegrantes(this.regra()));
  protected readonly aVista = computed(() => controlesAVista(this.regra()));

  protected id(campo: CampoDaBanca): string {
    return `${this.idBase()}-${campo}`;
  }

  protected estado(campo: CampoDaBanca, comDica = false): EstadoDoControle {
    return estadoDoControle(
      this.id(campo),
      this.erros()[campo],
      this.recusas()[campo] ?? [],
      comDica,
    );
  }

  protected alterar(campo: CampoDaRegra, valor: string): void {
    this.regraChange.emit(alterarRegra(this.regra(), campo, valor));
  }
}
