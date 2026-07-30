import { computed, Injectable, signal } from '@angular/core';
import { DOC_ETAPAS, DOCUMENTO_GRUPOS, MODALIDADES_CANONICAS, STEP_LABELS } from './processo-seletivo.data';
import { DocumentoConfig, EtapaEdital, StepStatus, WizardDraft } from './processo-seletivo.models';

function initialDocumentos(): Record<string, DocumentoConfig> {
  return Object.fromEntries(
    DOCUMENTO_GRUPOS.flatMap((group) => group.docs).map((doc) => [
      doc.id,
      {
        included: false,
        todasEtapas: true,
        etapas: DOC_ETAPAS.map((item) => item.cod),
        modalidades: [...MODALIDADES_CANONICAS],
      },
    ]),
  );
}

function initialEtapa(): EtapaEdital {
  return {
    id: 'etapa-1',
    tipo: '',
    inicio: '2026-01-01',
    fim: '2026-01-30',
    nomeCustomizado: '',
    permiteRecurso: false,
    tagNumeroAtiva: false,
    administrativa: false,
  };
}

const INITIAL_DRAFT: WizardDraft = {
  tipoProcesso: { selected: 'sisu' },
  identificacao: {
    numero: '2026', ano: 2026, data: '', orgao: 'CEPS/UNIFESSPA',
    periodo: '1º semestre', nome: '', uploads: [],
  },
  modalidades: { selected: [], concorrenciaDupla: false },
  vagas: { cursos: [] },
  etapas: [initialEtapa()],
  formula: { agregacao: 'MEDIA_PONDERADA', precisao: 'MEDIA_PONDERADA' },
  bonus: { ativo: false, tipo: '', valor: null, criterio: '', modalidades: [] },
  desempate: [],
  eliminacao: {
    notasMinimas: {
      INSCRICAO_CANDIDATOS: null,
      HOMOLOGACAO_INSCRICOES: null,
      IMPORTACAO_NOTAS_ENEM: null,
      DIVULGACAO_RESULTADO_FINAL: null,
    },
    clausulas: [],
  },
  documentos: initialDocumentos(),
  polos: {},
  atendimento: { condicoes: [], tiposPcd: [], recursos: [] },
};

@Injectable()
export class ProcessoSeletivoStore {
  readonly totalSteps = STEP_LABELS.length;
  readonly labels = STEP_LABELS;
  readonly currentStep = signal(0);
  readonly visitedSteps = signal<ReadonlySet<number>>(new Set([0]));
  readonly completedSteps = signal<ReadonlySet<number>>(new Set());
  readonly draft = signal<WizardDraft>(structuredClone(INITIAL_DRAFT));

  readonly currentLabel = computed(() => this.labels[this.currentStep()]);
  readonly currentMeta = computed(() => {
    const index = this.currentStep();
    return `Etapa ${index + 1} de ${this.totalSteps} (${String(index + 1).padStart(2, '0')} ${this.labels[index]})`;
  });
  readonly progress = computed(() => ((this.currentStep() + 1) / this.totalSteps) * 100);
  readonly isFirst = computed(() => this.currentStep() === 0);
  readonly isLast = computed(() => this.currentStep() === this.totalSteps - 1);

  goTo(index: number): void {
    if (index < 0 || index >= this.totalSteps) return;
    this.currentStep.set(index);
    this.visitedSteps.update((current) => new Set(current).add(index));
  }

  next(): boolean {
    const current = this.currentStep();
    if (current >= this.totalSteps - 1) return false;
    this.completedSteps.update((steps) => new Set(steps).add(current));
    this.goTo(current + 1);
    return true;
  }

  previous(): void {
    this.goTo(this.currentStep() - 1);
  }

  status(index: number): StepStatus {
    if (index === this.currentStep()) return 'active';
    if (this.completedSteps().has(index)) return 'done';
    if (this.visitedSteps().has(index)) return 'pending';
    return 'unvisited';
  }

  patchSection<K extends keyof WizardDraft>(section: K, value: WizardDraft[K]): void {
    this.draft.update((draft) => ({ ...draft, [section]: value }));
  }

  patchObjectSection<K extends keyof WizardDraft>(section: K, patch: Partial<WizardDraft[K]>): void {
    const current = this.draft()[section];
    if (Array.isArray(current) || typeof current !== 'object' || current === null) {
      throw new Error(`A seção ${String(section)} não aceita patch de objeto.`);
    }
    this.draft.update((draft) => ({
      ...draft,
      [section]: { ...(draft[section] as object), ...patch },
    }));
  }

  reset(): void {
    this.currentStep.set(0);
    this.visitedSteps.set(new Set([0]));
    this.completedSteps.set(new Set());
    this.draft.set(structuredClone(INITIAL_DRAFT));
  }
}
