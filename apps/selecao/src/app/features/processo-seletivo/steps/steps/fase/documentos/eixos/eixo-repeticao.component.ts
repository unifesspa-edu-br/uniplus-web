import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../../processo-seletivo.store';
import { ExigenciasDaFaseStore } from '../exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from '../gatilho-das-exigencias.store';
import { FaseEmEdicao } from '../../fase-em-edicao';

@Component({
  selector: 'div[selEixoRepeticao]',
  templateUrl: './eixo-repeticao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EixoRepeticaoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);

  readonly documentoId = input.required<string>();

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly gatilho = inject(GatilhoDasExigenciasStore);
}
