import type { FundamentoIsencaoCodigo } from '@uniplus/shared-data/selecao';

import type { AtendimentoCondicaoSelecionada, ReferenciaDeAtendimento } from './atendimento.models';
import type {
  CriterioDesempateConfigurado,
  RegraEliminacaoConfigurada,
} from './classificacao.models';
import type { EtapaPontuada, FaseDoCronograma } from './cronograma.models';
import type { ExigenciasDoRascunho } from './exigencias.models';
import type { FormularioDeInscricao } from './formulario.models';
import type {
  AnexoDoEdital,
  LocalidadeSelecionada,
  OrigemCandidatosSelecionada,
  UploadItem,
} from './identificacao.models';
import type { CascataSelecionada, DistribuicaoDeVagas } from './vagas.models';

export interface WizardDraft {
  tipoProcesso: {
    selected: string;
    /**
     * Nome do tipo como o operador o viu ao escolher. O catálogo que traduz o id no nome vive no
     * passo 1, e na criação não há snapshot remoto de onde tirá-lo.
     */
    rotulo: string;
    /** Código do tipo: os modelos de formulário são filtrados por ele, e o processo criado nesta sessão não tem snapshot remoto que o traga. */
    codigo: string;
  };
  /**
   * Declaração de cobrança e dos fundamentos de isenção que o processo reconhece. `cobra` começa
   * nulo porque a ausência de declaração não é "não cobra": a publicação recusa processo que
   * nunca declarou.
   */
  pagamento: {
    cobra: boolean | null;
    valor: string;
    fundamentos: FundamentoIsencaoCodigo[];
  };
  /**
   * Quantos cursos o candidato escolhe na inscrição: `'1'`, `'2'` ou vazio enquanto não declarado.
   * Gravado junto das vagas porque a quantidade de cursos cadastrados limita o número.
   */
  opcoesDeCurso: {
    numero: string;
  };
  identificacao: {
    nome: string;
    /**
     * Endereço público do certame, escolhido por quem cadastra e não derivado do nome. Obrigatório
     * na criação; trocável, mas não esvaziável, enquanto rascunho; imutável depois de publicado.
     */
    identificadorLegivel: string;
    /** Unidade que administra o certame, do catálogo de Organização Institucional. Obrigatória na criação e imutável depois. */
    unidadeAdministradoraId: string;
    /** De onde vêm os candidatos. Declarado, não derivado do tipo do processo; define o piso mínimo do cronograma. */
    origemCandidatos: OrigemCandidatosSelecionada;
    /**
     * Município cujo calendário rege a contagem dos prazos (`UNI-REQ-0111`). A interface sugere a
     * cidade da unidade administradora, mas quem confirma é o operador. O trio vem inteiro da
     * opção da Geo: montá-lo à mão dessincronizaria nome e código, e é o código que decide quais
     * feriados incidem no prazo.
     */
    localidade: LocalidadeSelecionada | null;
    uploads: UploadItem[];
  };
  vagas: {
    ofertas: DistribuicaoDeVagas[];
    /** `null` enquanto não há decisão, inclusive quando nenhuma oferta federal exige cascata: a ausência nunca vira sequência pré-selecionada. */
    cascata: CascataSelecionada | null;
  };
  /**
   * O cronograma e as etapas que a fase de avaliação agrupa. As etapas moram aqui porque a fase
   * com `agrupaEtapas` lhes dá lugar no tempo e a projeção do detalhe sobre o rascunho lança
   * quando a seção de topo é um array.
   */
  cronograma: {
    fases: FaseDoCronograma[];
    etapas: EtapaPontuada[];
    /** Código e versão da regra escolhida; vazios enquanto não há escolha. */
    algoritmoContagemCodigo: string;
    algoritmoContagemVersao: string;
  };
  /**
   * A classificação inteira, gravada por `PUT …/classificacao` num corpo só (UNI-REQ-0482) e
   * repartida entre dois passos: Fórmula preenche até `regrasEliminacao`, Eliminação preenche o
   * vetor e grava.
   *
   * Arredondamento só vale sob `FORMULA-MEDIA-PONDERADA`: sob `CLASSIFICACAO-IMPORTADA`
   * o mapeador envia `null` independentemente do digitado, e `regrasEliminacao` é vazio.
   */
  classificacao: {
    regraCalculoCodigo: string;
    regraCalculoVersao: string;
    regraArredondamentoCodigo: string;
    regraArredondamentoVersao: string;
    casasArredondamento: string;
    regraOrdemAlocacaoCodigo: string;
    regraOrdemAlocacaoVersao: string;
    /** Condiciona se `ELIM-CORTE-EM-AREA` e `ELIM-ZERO-EM-AREA` são aceitas em `regrasEliminacao` (`EliminacaoEnemForaDeProcessoEnem`). */
    baseadoEmEnem: boolean;
    /** Escala em que o edital publica a nota final, como o operador a escreve (`1000`, `100,5`). Vazia enquanto não declarada: o rascunho a aceita, a publicação não. */
    escalaNotaFinal: string;
    /**
     * Resolução de Peso por Área da nota: o valor da resolução no cadastro da Configuração, chave
     * pela qual o servidor copia o quadro de pesos. Só é enviada quando a classificação é baseada
     * em ENEM com cálculo local (`exigeResolucaoPesoAreaEnem`); nos demais casos o mapeador envia
     * `null`, mesmo que o rascunho guarde uma escolha anterior.
     */
    resolucaoPesoAreaEnem: string;
    regrasEliminacao: readonly RegraEliminacaoConfigurada[];
    /** Anos das edições do ENEM que o processo aceita. Gravados depois da classificação, porque o servidor só os aceita de processo baseado em ENEM. */
    edicoesEnem: readonly string[];
  };
  /**
   * Bônus regional (`PUT …/bonus-regional`), declaração obrigatória como a da taxa: `aplica` é
   * `null` até o operador responder. `false` grava com os cinco campos `null`; `true` exige a
   * configuração. A base legal referencia um cadastro tipado por id.
   */
  bonus: {
    aplica: boolean | null;
    regraCodigo: string;
    regraVersao: string;
    fator: string;
    teto: string;
    baseLegalBonusRegionalId: string;
    /** O fato de sim ou não que decide quem recebe o acréscimo (ADR-0142): campo do formulário de inscrição ou derivado do processo. Vazio enquanto não escolhido. */
    fatoElegibilidadeCodigo: string;
  };
  /** Critérios de desempate (`PUT …/criterios-desempate`) na ordem em que são avaliados; a ordem é a posição, reescrita pelo reorder. */
  desempate: readonly CriterioDesempateConfigurado[];
  documentos: ExigenciasDoRascunho;
  formulario: FormularioDeInscricao;
  /**
   * A oferta de atendimento especializado (UNI-REQ-0012), gravada por `PUT …/oferta-atendimento`.
   * As listas vêm dos cadastros de Configuração, nunca de vocabulário local; a exceção é o código
   * `PCD`, ancorado no ADR-0067.
   */
  atendimento: {
    condicoes: readonly AtendimentoCondicaoSelecionada[];
    recursos: readonly ReferenciaDeAtendimento[];
    tiposDeficiencia: readonly ReferenciaDeAtendimento[];
  };
  /**
   * O que o passo Revisão coleta para `POST …/publicacao`. Fica **fora de
   * `hidratarDraft`**: depois do `204` o processo é somente leitura. É a única seção que volta de
   * outra rota: a página a repõe de `GET …/rascunho-da-publicacao` depois de hidratar. Publicar
   * lê o que está em tela, nunca o que está guardado.
   *
   * `periodoInscricaoInicio`/`…Fim` só valem quando o cronograma NÃO tem fase com
   * `coletaInscricao` (armadilha do período): a tela os abre só nesse ramo, e o mapeador os
   * ignora no outro. São `date-time` no contrato; o valor aqui é o de `<input type="datetime-local">`, sem fuso.
   */
  publicacao: {
    numero: string;
    periodoInscricaoInicio: string;
    periodoInscricaoFim: string;
    ato: {
      orgao: string;
      serie: string;
      ano: string;
      dataPublicacao: string;
      assinante: string;
      tipoAtoCodigo: string;
    };
    /** Os anexos do edital, na ordem em que a publicação os declara. */
    anexos: AnexoDoEdital[];
  };
}

/**
 * Todas as seções do rascunho, nomeadas uma a uma, para a cobertura de readback ser aferível: o
 * defeito que motivou a lista foi uma seção que ninguém relia do servidor e que um recarregamento
 * apagava. O `satisfies` garante que todo nome é uma seção de verdade, e o assert abaixo garante
 * que nenhuma ficou de fora.
 */
export const SECOES_DO_RASCUNHO = [
  'tipoProcesso',
  'pagamento',
  'identificacao',
  'opcoesDeCurso',
  'vagas',
  'cronograma',
  'classificacao',
  'bonus',
  'desempate',
  'documentos',
  'formulario',
  'atendimento',
  'publicacao',
] as const satisfies readonly (keyof WizardDraft)[];

type SecaoNaoListada = Exclude<keyof WizardDraft, (typeof SECOES_DO_RASCUNHO)[number]>;

/** Seção nova do rascunho fora de `SECOES_DO_RASCUNHO` quebra a compilação: o tipo vira `never`. */
const TODAS_AS_SECOES_LISTADAS: [SecaoNaoListada] extends [never] ? true : never = true;
void TODAS_AS_SECOES_LISTADAS;
