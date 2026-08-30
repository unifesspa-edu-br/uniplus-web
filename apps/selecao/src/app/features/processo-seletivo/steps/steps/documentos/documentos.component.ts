import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DOC_ETAPAS, DOCUMENTO_GRUPOS } from '../../processo-seletivo.data';
import { DocumentoConfig, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';

@Component({
  selector: 'sel-step-documentos',
  standalone: true,
  templateUrl: './documentos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(DocumentosStepComponent)],
})
export class DocumentosStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly groups = DOCUMENTO_GRUPOS;
  readonly etapas = DOC_ETAPAS;
  /** Só as modalidades que as ofertas de vagas selecionam podem exigir documento. */
  readonly modalidades = computed(() => this.store.modalidadesDoProcesso());

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
    const config = this.config(id);

    // A primeira personalização parte do que está marcado na tela — a lista
    // guardada está vazia enquanto o documento acompanha o quadro, e desmarcar
    // uma modalidade apagaria todas as outras. Depois disso vale a lista
    // guardada: partir das efetivas descartaria a modalidade que saiu do quadro
    // temporariamente, e voltar a ofertá-la já não a traria de volta.
    const atual = config.modalidadesRecortadas ? config.modalidades : this.modalidadesEfetivas(id);
    this.patch(id, {
      modalidades: checked ? [...atual, code] : atual.filter((item) => item !== code),
      // A partir daqui o documento deixa de acompanhar as modalidades do quadro.
      modalidadesRecortadas: true,
    });
  }

  /**
   * Modalidades que valem para o documento.
   *
   * Sem recorte, ele acompanha o que o quadro de vagas oferta — derivado, não
   * copiado: uma lista própria a manter em dia dependeria de alguém sincronizá-la
   * a cada mudança do quadro, e ficaria vazia no documento recém-incluído.
   *
   * Com recorte, vale a interseção. O recorte guardado permanece intacto, então
   * voltar a ofertar uma modalidade a traz de volta aqui.
   */
  modalidadesEfetivas(id: string): string[] {
    const aceitas = this.modalidades();
    const config = this.config(id);
    if (!config.modalidadesRecortadas) return [...aceitas];

    const conjunto = new Set(aceitas);
    return config.modalidades.filter((code) => conjunto.has(code));
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const documentos = Object.entries(this.store.draft().documentos);

    const semEtapa = documentos.some(([, config]) => config.included && config.etapas.length === 0);
    if (semEtapa) {
      return { valid: false, message: 'Todo documento incluído deve ter ao menos uma etapa.' };
    }

    const semModalidade = documentos.some(
      ([id, config]) => config.included && this.modalidadesEfetivas(id).length === 0,
    );
    if (semModalidade) {
      return {
        valid: false,
        message: 'Todo documento incluído deve valer para ao menos uma modalidade aceita.',
      };
    }

    return { valid: true };
  }
}
