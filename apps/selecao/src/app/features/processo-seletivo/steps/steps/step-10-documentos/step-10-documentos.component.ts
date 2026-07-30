import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DOC_ETAPAS, DOCUMENTO_GRUPOS, MODALIDADES_CANONICAS } from '../../processo-seletivo.data';
import { DocumentoConfig } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

@Component({
  selector: 'sel-step-10-documentos',
  standalone: true,
  templateUrl: './step-10-documentos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step10DocumentosComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly groups = DOCUMENTO_GRUPOS;
  readonly etapas = DOC_ETAPAS;
  readonly modalidades = MODALIDADES_CANONICAS;

  config(id: string): DocumentoConfig {
    return this.store.draft().documentos[id];
  }
  patch(id: string, patch: Partial<DocumentoConfig>): void {
    this.store.patchSection('documentos', {
      ...this.store.draft().documentos,
      [id]: { ...this.config(id), ...patch },
    });
  }
  toggleTodasEtapas(id: string, checked: boolean): void {
    this.patch(id, {
      todasEtapas: checked,
      etapas: checked ? this.etapas.map((item) => item.cod) : this.config(id).etapas,
    });
  }
  toggleEtapa(id: string, code: string, checked: boolean): void {
    const current = this.config(id).etapas;
    this.patch(id, {
      etapas: checked ? [...current, code] : current.filter((item) => item !== code),
    });
  }
  toggleModalidade(id: string, code: string, checked: boolean): void {
    const current = this.config(id).modalidades;
    this.patch(id, {
      modalidades: checked ? [...current, code] : current.filter((item) => item !== code),
    });
  }
}
