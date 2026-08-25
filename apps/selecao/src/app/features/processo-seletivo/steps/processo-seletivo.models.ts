import { OrigemCandidatos } from '@uniplus/shared-data/selecao';

export type StepStatus = 'active' | 'done' | 'pending' | 'unvisited';

/**
 * Origem dos candidatos no rascunho: `''` representa "ainda não escolhida".
 * `OrigemCandidatos.nenhuma` existe no contrato mas é recusada pela criação do
 * processo, então não é oferecida como opção.
 */
export type OrigemCandidatosSelecionada =
  | ''
  | OrigemCandidatos.inscricaoPropria
  | OrigemCandidatos.importacaoExterna;

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
  legal?: string;
}

/**
 * Fase do anexo do edital, na ordem em que a API a executa: o registro é
 * criado com a URL pré-assinada (`iniciando`), o arquivo vai direto ao storage
 * (`enviando`), e a API lê o objeto para validar e selar (`confirmando`).
 * Guardar a fase é o que permite retomar do ponto certo depois de uma falha —
 * repetir a confirmação não muda um objeto que nunca chegou ao storage.
 */
export type FaseUpload = 'iniciando' | 'enviando' | 'confirmando' | 'confirmado' | 'erro';

export interface UploadItem {
  id: string;
  name: string;
  /** O contrato do documento do edital aceita somente PDF. */
  extension: 'pdf';
  progress: number;
  fase: FaseUpload;
  /** Id do registro criado na iniciação — necessário para confirmar. */
  documentoEditalId?: string;
  /** Instante em que a URL pré-assinada deixa de valer. */
  expiraEm?: string;
  /**
   * O arquivo já chegou ao storage. Distingue "falhou antes de subir" de
   * "subiu e a confirmação não concluiu": no segundo caso, repetir o PUT é
   * desperdício e pode até esbarrar na URL já expirada, enquanto repetir só a
   * confirmação recupera o replay do comando anterior.
   */
  enviado?: boolean;
  /**
   * A confirmação ficou sem resposta definitiva. O documento pode já estar
   * selado — imutável — no servidor, então trocar o arquivo criaria um segundo
   * edital e perderia a referência do primeiro: só a retentativa da mesma
   * confirmação resolve.
   */
  confirmacaoIndefinida?: boolean;
  mensagemErro?: string;
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

/**
 * Oferta de Curso adicionada ao quadro de vagas (Passo 4). A identidade e o
 * id UUID da Oferta de Curso (ofertaCursoId) — o que o PUT /distribuicao-vagas
 * espera. Nao herda de Curso: o catalogo real de ofertas nao embute id numerico.
 */
export interface OfertaVaga {
  ofertaCursoId: string;
  cursoId: string;
  nome: string;
  grau: string;
  campus: string;
  unidade: string;
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
  /** Código do contrato — a API é a fonte de verdade do vocabulário. */
  modalidades: string[];
  /**
   * `false` enquanto o documento acompanha as modalidades aceitas pelo
   * processo; `true` depois que o operador recorta a lista no passo 10.
   * Registrar o estado evita confundir um recorte que por acaso coincide com
   * as aceitas — depois de uma remoção no passo 3 — com o padrão.
   */
  modalidadesRecortadas: boolean;
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

/**
 * Snapshot da cidade escolhida no seletor da Geo. Os três campos viajam juntos
 * porque o backend valida a coerência do trio (sete dígitos, prefixo compatível
 * com a UF, nome não vazio); `nome` e `uf` são cache de exibição e não entram em
 * cálculo de prazo.
 */
export interface LocalidadeSelecionada {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
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
    /**
     * Unidade que administra o certame, escolhida no catálogo de Organização
     * Institucional. Obrigatória na criação e imutável depois dela.
     */
    unidadeAdministradoraId: string;
    /**
     * De onde vêm os candidatos. Atributo declarado — não se deriva do tipo do
     * processo, e é ele que define o piso mínimo do cronograma de fases.
     */
    origemCandidatos: OrigemCandidatosSelecionada;
    /**
     * Município cujo calendário rege a contagem dos prazos do certame
     * (`UNI-REQ-0111`). Obrigatório na criação, e declarado: a interface sugere a
     * cidade da unidade administradora escolhida, mas quem confirma é o operador —
     * o servidor recusa a criação sem ele em vez de deduzi-lo de qualquer cadastro.
     * O trio vem inteiro da opção da Geo; montá-lo a mão dessincronizaria nome e
     * código, e é o código que decide quais feriados incidem no prazo.
     */
    localidade: LocalidadeSelecionada | null;
    uploads: UploadItem[];
  };
  modalidades: {
    /** Código do contrato — a API é a fonte de verdade do vocabulário. */
    selected: string[];
    concorrenciaDupla: boolean;
  };
  vagas: {
    cursos: OfertaVaga[];
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
    /** Código do contrato — a API é a fonte de verdade do vocabulário. */
    modalidades: string[];
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
