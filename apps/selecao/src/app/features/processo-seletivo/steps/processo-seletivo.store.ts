import { computed, Injectable, signal } from '@angular/core';
import { DOC_ETAPAS, DOCUMENTO_GRUPOS, STEP_LABELS } from './processo-seletivo.data';
import { DocumentoConfig, EtapaEdital, StepStatus, WizardDraft } from './processo-seletivo.models';

function initialDocumentos(): Record<string, DocumentoConfig> {
  return Object.fromEntries(
    DOCUMENTO_GRUPOS.flatMap((group) => group.docs).map((doc) => [
      doc.id,
      {
        included: false,
        todasEtapas: true,
        etapas: DOC_ETAPAS.map((item) => item.cod),
        // Documentos acompanham a seleção de modalidades do passo 3 —
        // preenchidos em `sincronizarModalidades` conforme o operador marca.
        modalidades: [],
        modalidadesRecortadas: false,
      },
    ]),
  );
}

function initialEtapa(): EtapaEdital {
  return {
    id: 'etapa-1',
    tipo: '',
    // Datas vazias — o usuário DEVE preencher início e fim no passo 5.
    inicio: '',
    fim: '',
    nomeCustomizado: '',
    permiteRecurso: false,
    tagNumeroAtiva: false,
    administrativa: false,
  };
}

const INITIAL_DRAFT: WizardDraft = {
  // Desmarcado por padrão — o usuário DEVE escolher um tipo no step-01.
  tipoProcesso: { selected: '' },
  // Todos os campos do Passo 2 começam vazios para obrigar o preenchimento.
  identificacao: {
    numero: '',
    ano: null,
    data: '',
    orgao: '',
    periodo: '',
    nome: '',
    unidadeAdministradoraId: '',
    origemCandidatos: '',
    localidade: null,
    uploads: [],
  },
  // Taxa de inscrição desmarcada por padrão — o usuário DEVE decidir no passo 3.
  pagamento: {
    taxaObrigatoria: false,
    valorTaxa: null,
    formasPagamento: [],
    isencao: { inicioSolicitacao: '', fimSolicitacao: '', prazoRecursoDiasUteis: null },
  },
  modalidades: { selected: [], concorrenciaDupla: false },
  vagas: { cursos: [] },
  etapas: [initialEtapa()],
  // Fórmula e precisão começam vazios — o usuário DEVE escolher no passo 6.
  formula: { agregacao: '', precisao: '' },
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
  /** Mensagens de validação do step ativo. `null` indica sem erro. */
  readonly stepError = signal<string[] | null>(null);
  /**
   * Id do Processo Seletivo já criado na API. `null` enquanto o cadastro
   * inicial não foi persistido.
   */
  readonly processoSeletivoId = signal<string | null>(null);
  /** Mutação em curso — usado para impedir disparo duplo e travar a navegação. */
  readonly salvando = signal(false);
  /**
   * Uma criação ficou sem resposta definitiva (rede ou 5xx): o servidor pode
   * tê-la executado. A retentativa repete o mesmo comando, então alterar o
   * rascunho agora só faria a tela divergir do que existe no servidor.
   */
  readonly criacaoIndefinida = signal(false);

  /**
   * Depois de criado, os dados que compuseram o comando de criação não podem
   * mais ser alterados: o contrato não expõe atualização de identificação e a
   * unidade administradora é imutável no agregado por definição. Vale também
   * enquanto uma criação inconclusiva aguarda retentativa — inclusive para o
   * tipo, escolhido no passo 1.
   */
  readonly cadastroInicialCongelado = computed(
    () => this.processoSeletivoId() !== null || this.salvando() || this.criacaoIndefinida(),
  );

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
    if (this.stepError()) return false;
    const current = this.currentStep();
    if (current >= this.totalSteps - 1) return false;
    this.completedSteps.update((steps) => new Set(steps).add(current));
    this.goTo(current + 1);
    return true;
  }

  /** Define as mensagens de erro do step ativo (null limpa). */
  setStepError(messages: string[] | null): void {
    this.stepError.set(messages);
  }

  /**
   * Substitui o conjunto de passos concluídos pelo resultado de uma validação
   * completa do rascunho. Como a navegação é livre, um passo pode ter sido
   * concluído e depois invalidado — ou preenchido sem nunca passar por
   * "Próximo" —, e só a validação de todos reconcilia o progresso exibido.
   */
  syncCompleted(completed: Iterable<number>): void {
    this.completedSteps.set(new Set(completed));
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

  patchObjectSection<K extends keyof WizardDraft>(
    section: K,
    patch: Partial<WizardDraft[K]>,
  ): void {
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
    this.stepError.set(null);
    this.processoSeletivoId.set(null);
    this.salvando.set(false);
    this.criacaoIndefinida.set(false);
  }
}
