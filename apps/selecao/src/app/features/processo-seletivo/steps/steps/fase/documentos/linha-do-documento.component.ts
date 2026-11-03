import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { FaseEmEdicao } from '../fase-em-edicao';
import type { ResumoDoDocumento } from '../tipos-da-conferencia';

/** A linha-resumo de um documento da conferência: o que decide a exigência, sem abrir os campos. */
@Component({
  selector: 'tr[selLinhaDoDocumento]',
  templateUrl: './linha-do-documento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinhaDoDocumentoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly idDaFase = inject(FaseEmEdicao).idDaFase;

  readonly resumo = input.required<ResumoDoDocumento>();
  readonly aberta = input.required<boolean>();
  readonly semNormaComum = input.required<boolean>();
  readonly alternar = output<void>();
}
