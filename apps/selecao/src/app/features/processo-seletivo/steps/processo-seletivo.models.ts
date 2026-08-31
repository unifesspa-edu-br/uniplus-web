import { CaraterEtapa, OrigemCandidatos, UnidadePrazo } from '@uniplus/shared-data/selecao';
import type { FundamentoIsencaoCodigo } from '@uniplus/shared-data/selecao';

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

/**
 * Distribuição de vagas de uma oferta de curso (UNI-REQ-0134).
 *
 * A oferta é referenciada pelo id do catálogo de Configuração, e não descrita
 * aqui: curso, local, unidade, regime de turno e turnos são projeção dela, e
 * remontá-los localmente foi o que produziu o quadro fictício que este modelo
 * substitui.
 *
 * Os números são texto porque é o que o campo edita. Convertê-los com `Number`
 * ao digitar leria `1.000` como 1 — a mesma armadilha corrigida no valor da
 * taxa (#624); a conversão acontece no envio, com gramática explícita.
 */
export interface DistribuicaoDeVagas {
  readonly ofertaCursoId: string;
  readonly voBase: string;
  readonly pr: string;
  /** Regra do `rol_de_regras`, identificada por código **e** versão: publicar
   * versão nova do catálogo não pode mudar a regra que um processo já
   * publicado aplicou. */
  readonly regraDistribuicaoCodigo: string;
  readonly regraDistribuicaoVersao: string;
  /** Obrigatória na Lei 12.711 (art. 11, § único); ausente nas demais. */
  readonly regraAjusteCodigo: string | null;
  readonly regraAjusteVersao: string | null;
  /** Obrigatória na Lei 12.711 e recusada fora dela. */
  readonly referenciaReservaDemograficaId: string | null;
  readonly modalidades: readonly ModalidadeDaOferta[];
  readonly quadro: readonly QuantidadeDeVagas[];
}

/**
 * Quantidade que o edital fixa para uma modalidade.
 *
 * Nem toda modalidade selecionada aparece aqui: na Lei 12.711, as de
 * composição `DENTRO_DO_VR` e `RESIDUAL_DO_VO` são calculadas pelo motor e
 * informá-las é recusado. Fora dela, todas exigem quantidade.
 */
/**
 * Modalidade que a oferta seleciona. O identificador é o que a gravação
 * recebe; o código é como as demais dimensões do edital a nomeiam — bônus e
 * documentos exigidos falam em `AC` e `LB_PPI`, não em uuid.
 */
export interface ModalidadeDaOferta {
  readonly id: string;
  readonly codigo: string;
}

export interface QuantidadeDeVagas {
  readonly modalidadeId: string;
  readonly quantidade: string;
}

/**
 * Uma fase do cronograma do certame.
 *
 * A fase é referenciada pelo id da fase canônica, e não descrita aqui: código,
 * dono, origem da data e os sinalizadores que decidem o que ela exige são
 * projeção do catálogo, congelados pelo servidor no momento da gravação. O
 * `codigo` acompanha o id porque as pendências derivadas e as precedências
 * falam em `INSCRICAO`, não em uuid — mesma razão pela qual a modalidade carrega
 * o código ao lado do identificador na distribuição de vagas.
 *
 * A janela é instante em texto RFC 3339, não data: é o que o contrato recebe, e
 * é a hora que separa o fim de um dia do começo do seguinte.
 */
export interface FaseDoCronograma {
  readonly faseCanonicaId: string;
  readonly codigo: string;
  readonly ordem: number;
  /** `null` só é válido em fase cuja origem de data é delegada. */
  readonly inicio: string | null;
  readonly fim: string | null;
  readonly atoProduzidoCodigo: string | null;
  readonly tiposBancaIds: readonly string[];
  readonly regraRecurso: RecursoDaFase | null;
  /** `null` numa fase acrescentada agora: quem a descreve é o catálogo. */
  readonly congelados: AtributosCongeladosDaFase | null;
}

/**
 * O que a fase congelou do catálogo no momento em que entrou no processo.
 *
 * Existe porque o catálogo é vivo e o cronograma não: uma fase canônica pode ser
 * inativada depois, e a que já está no edital continua valendo. Sem guardar
 * estes atributos, a tela deixaria de saber se a fase pede janela, ato ou
 * etapas — e esconderia do operador a fase que ele precisa editar.
 */
export interface AtributosCongeladosDaFase {
  readonly donoTipico: string;
  readonly origemData: string;
  readonly agrupaEtapas: boolean;
  readonly produzResultado: boolean;
  readonly resultadoDefinitivo: boolean;
  readonly coletaInscricao: boolean;
  /** Código de cada banca exigida, como a fase o congelou. */
  readonly bancas: readonly { readonly id: string; readonly codigo: string }[];
}

/**
 * A regra de recurso de uma fase. A **presença** desta configuração é o que faz
 * a fase admitir recurso — não há sinalizador próprio.
 *
 * Os números são texto porque é o que o campo edita; a conversão acontece no
 * envio, com gramática explícita. O par de suspensividade de uma instância é
 * declarado inteiro ou deixado inteiro em branco: metade preenchida é recusada,
 * e a ausência dos dois é a desativação prevista daquela instância.
 */
export interface RecursoDaFase {
  readonly regraCodigo: string;
  readonly regraVersao: string;
  readonly prazoValor: string;
  readonly prazoUnidade: UnidadePrazo | '';
  readonly atoAncoraCodigo: string;
  readonly suspensividadePrimeiraInstanciaValor: string;
  readonly suspensividadePrimeiraInstanciaUnidade: UnidadePrazo | '';
  readonly suspensividadeSegundaInstanciaValor: string;
  readonly suspensividadeSegundaInstanciaUnidade: UnidadePrazo | '';
}

/**
 * Uma etapa pontuada do processo — o eixo de nota, distinto do eixo temporal.
 * Não tem janela: quando ela ocorre é a janela da fase que a agrupa.
 *
 * O `id` é preservado e reenviado quando a etapa já existe. É o que critério de
 * desempate e regra de eliminação referenciam, e perdê-lo ao reordenar deixaria
 * as duas apontando para uma etapa que deixou de existir.
 */
export interface EtapaPontuada {
  /** Devolvido pela API; `null` enquanto a etapa é nova. */
  readonly id: string | null;
  readonly nome: string;
  readonly carater: CaraterEtapa | '';
  readonly tipoEtapaOrigemId: string;
  readonly peso: string;
  readonly notaMinima: string;
  readonly ordem: number;
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
  /**
   * O recorte do operador — vazio enquanto o documento acompanha o quadro de
   * vagas. Não é a lista que vale: quem for persistir este passo precisa
   * enviar `modalidadesEfetivas()`, que resolve o padrão contra o quadro.
   *
   * Código do contrato — a API é a fonte de verdade do vocabulário.
   */
  modalidades: string[];
  /**
   * `false` enquanto o documento acompanha as modalidades que o quadro de
   * vagas oferta; `true` depois que o operador recorta a lista. Registrar o
   * estado evita confundir um recorte que por acaso coincide com as ofertadas
   * — depois de uma remoção no quadro — com o padrão.
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
    /**
     * Nome do tipo como o operador o viu ao escolher. Guardado junto do id
     * porque o catálogo que traduz um no outro vive no passo 1: sem isto,
     * qualquer outra tela que precise dizer *qual* tipo foi escolhido teria
     * de recarregar o catálogo — e na criação não há snapshot remoto de onde
     * tirar o nome.
     */
    rotulo: string;
  };
  /**
   * Declaração de cobrança e de quais fundamentos de isenção o processo
   * reconhece. `cobra` começa nulo porque a ausência de declaração não é "não
   * cobra" — a publicação recusa processo que nunca declarou.
   */
  pagamento: {
    cobra: boolean | null;
    valor: string;
    fundamentos: FundamentoIsencaoCodigo[];
  };
  identificacao: {
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
  vagas: {
    ofertas: DistribuicaoDeVagas[];
  };
  /**
   * O cronograma do certame e as etapas que a fase de avaliação agrupa.
   *
   * As etapas moram aqui, e não como seção de topo, por duas razões que se
   * somam: é a fase com `agrupaEtapas` que lhes dá lugar no tempo, e a projeção
   * do detalhe sobre o rascunho lança quando a seção é um array — o mesmo
   * motivo pelo qual as ofertas vivem dentro de `vagas`.
   */
  cronograma: {
    fases: FaseDoCronograma[];
    etapas: EtapaPontuada[];
    /** Código e versão da regra escolhida; vazios enquanto não há escolha. */
    algoritmoContagemCodigo: string;
    algoritmoContagemVersao: string;
  };
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

/**
 * Por que a leitura por URL não entregou um processo. O tipo decide a ação
 * que a tela oferece: `naoEncontrado` e `idInvalido` não têm retentativa útil
 * — o endereço é que está errado; `semPermissao` e `falhaTemporaria` têm.
 */
export type MotivoFalhaDeLeitura =
  | 'idInvalido'
  | 'naoEncontrado'
  | 'semPermissao'
  | 'falhaTemporaria';

export interface FalhaDeLeitura {
  readonly motivo: MotivoFalhaDeLeitura;
  /** Texto já resolvido para exibição — vem do `ProblemDetails` quando há um. */
  readonly mensagem: string;
}
