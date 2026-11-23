import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { RecusaDoCampoComponent } from '@uniplus/shared-ui/components';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { FaseEmEdicao } from '../fase-em-edicao';
import type { ResumoDoDocumento } from '../tipos-da-conferencia';

/** A linha-resumo de um documento da conferência: o que decide a exigência, sem abrir os campos. */
@Component({
  selector: 'tr[selLinhaDoDocumento]',
  imports: [RecusaDoCampoComponent],
  templateUrl: './linha-do-documento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinhaDoDocumentoComponent {
  protected readonly recusas = inject(RecusasDasExigencias, { optional: true });
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly idDaFase = inject(FaseEmEdicao).idDaFase;

  protected recusasDaLinha() {
    return (this.recusas?.daRegraSemCampo(this.resumo().id) ?? []).map((recusa) => ({
      ...recusa,
      pagina: null,
    }));
  }

  readonly resumo = input.required<ResumoDoDocumento>();
  readonly aberta = input.required<boolean>();
  readonly semNormaComum = input.required<boolean>();
  readonly alternar = output<void>();
}
