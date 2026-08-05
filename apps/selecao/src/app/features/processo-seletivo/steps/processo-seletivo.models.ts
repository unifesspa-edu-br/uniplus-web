import { ModalidadeConcorrencia } from '@uniplus/shared-data/selecao';

export type StepStatus = 'active' | 'done' | 'pending' | 'unvisited';

/**
 * Resultado da validação declarativa de um step. Steps de domínio
 * (seleção, grids, upload custom) implementam `validate(): StepValidation`;
 * steps de formulário clássico usam Reactive Forms e traduzem o estado
 * do form para esta mesma interface na hora de avançar.
 */
export interface StepValidation {
  valid: boolean;
  /** Lista de mensagens exibida com role="alert" quando `valid === false`. */
  messages?: string[];
  /**
   * Mensagem única (forma simples). Normalizada para `messages` pela page.
   * @deprecated Prefira `messages` para coletar todos os erros de uma vez.
   */
  message?: string;
}

export interface TipoProcessoOption {
  value: string;
  name: string;
  description: string;
  tags: string[];
  legal: string;
}

export interface UploadItem {
  id: string;
  name: string;
  extension: 'pdf' | 'png' | 'jpeg' | 'jpg' | 'docx';
  progress: number;
}

export interface Curso {
  id: number;
  nome: string;
  grau: string;
  campus: string;
  unidade: string;
}

export type Turno = '' | 'matutino' | 'vespertino' | 'noturno';

export interface OfertaCurso extends Curso {
  turno: Turno;
  vagas: number;
}

export interface EtapaEdital {
  id: string;
  tipo: string;
  inicio: string;
  fim: string;
  nomeCustomizado: string;
  permiteRecurso: boolean;
  tagNumeroAtiva: boolean;
  administrativa: boolean;
}

export interface CriterioDesempate {
  id: number;
  nome: string;
  fonte: string;
}

export interface DocumentoDefinicao {
  id: string;
  nome: string;
  desc: string;
}

export interface DocumentoGrupo {
  label: string;
  docs: DocumentoDefinicao[];
}

export interface DocumentoConfig {
  included: boolean;
  todasEtapas: boolean;
  etapas: string[];
  modalidades: ModalidadeConcorrencia[];
}

export interface PoloConfig {
  selected: boolean;
  capacidade: number | null;
}

export interface AtendimentoCondicao {
  id: string;
  nome: string;
  laudo?: boolean;
  isPcd?: boolean;
}

export interface AtendimentoRecurso {
  id: string;
  nome: string;
  desc: string;
  ext?: boolean;
}

export interface WizardDraft {
  tipoProcesso: {
    selected: string;
  };
  identificacao: {
    numero: string;
    ano: number | null;
    data: string;
    orgao: string;
    periodo: string;
    nome: string;
    uploads: UploadItem[];
  };
  modalidades: {
    selected: ModalidadeConcorrencia[];
    concorrenciaDupla: boolean;
  };
  vagas: {
    cursos: OfertaCurso[];
  };
  etapas: EtapaEdital[];
  formula: {
    agregacao: string;
    precisao: string;
  };
  bonus: {
    ativo: boolean;
    tipo: string;
    valor: number | null;
    criterio: string;
    modalidades: ModalidadeConcorrencia[];
  };
  desempate: number[];
  eliminacao: {
    notasMinimas: Record<string, number | null>;
    clausulas: string[];
  };
  documentos: Record<string, DocumentoConfig>;
  polos: Record<string, PoloConfig>;
  atendimento: {
    condicoes: string[];
    tiposPcd: string[];
    recursos: string[];
  };
}
