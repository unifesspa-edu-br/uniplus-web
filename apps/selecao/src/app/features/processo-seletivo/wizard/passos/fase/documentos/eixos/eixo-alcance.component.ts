import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../../processo-seletivo.store';
import { ExigenciasDaFaseStore } from '../exigencias-da-fase.store';
import { FaseEmEdicao } from '../../fase-em-edicao';

@Component({
  selector: 'sel-eixo-alcance',
  templateUrl: './eixo-alcance.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class EixoAlcanceComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);

  readonly documentoId = input.required<string>();

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly nomeDaFaseAberta = this.faseEmEdicao.nomeDaFaseAberta;

  /**
   * Em que fases o documento é exigido. É outro eixo do "Coletado em": este diz em QUAIS
   * fases, aquele em que ponto DESTA fase — e a resposta do segundo continua sendo por fase
   * mesmo quando o primeiro diz "todas".
   */
  escolherAlcanceDoDocumento(id: string, alcance: string): void {
    if (alcance === 'todas') {
      this.exigencias.valerEmTodasAsFases(id);
      return;
    }
    this.exigencias.recortarPorFase(id);
  }
}
