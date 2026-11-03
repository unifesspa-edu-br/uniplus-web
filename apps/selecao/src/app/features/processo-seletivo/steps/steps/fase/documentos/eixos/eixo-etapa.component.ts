import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../../processo-seletivo.store';
import { ExigenciasDaFaseStore } from '../exigencias-da-fase.store';
import { FaseEmEdicao } from '../../fase-em-edicao';

@Component({
  selector: 'div[selEixoEtapa]',
  templateUrl: './eixo-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EixoEtapaComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);

  readonly documentoId = input.required<string>();

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;

  /**
   * Declara em que etapa desta fase o documento é coletado. Vazio devolve o documento à fase
   * inteira — a etapa sai do registro em vez de ficar guardada como texto vazio, que o
   * contrato leria como declaração.
   */
  escolherEtapaDoDocumento(id: string, etapaId: string): void {
    this.exigencias.escreverExigencia(id, { etapaId: etapaId === '' ? null : etapaId });
  }
}
