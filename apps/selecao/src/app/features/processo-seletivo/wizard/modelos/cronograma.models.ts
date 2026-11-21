import type { CaraterEtapa } from '@uniplus/shared-data/selecao';

import type {
  LeituraDoRecurso,
  ParametrosDoRecurso,
} from '../shared/configuracao-do-recurso/parametros-do-recurso';
import type { BancaDaEtapa, RegraDeDeliberacaoDaBanca } from './deliberacao.models';

/**
 * Uma fase do cronograma. É referenciada pelo id da fase canônica: código, dono, origem da data e
 * os sinalizadores que decidem o que ela exige são projeção do catálogo, congelados pelo servidor
 * na gravação. O `codigo` acompanha o id porque pendências e precedências falam em `INSCRICAO`,
 * não em uuid.
 *
 * A janela é instante em texto RFC 3339, não data: é a hora que separa o fim de um dia do começo
 * do seguinte.
 */
export interface FaseDoCronograma {
  readonly faseCanonicaId: string;
  readonly codigo: string;
  readonly ordem: number;
  /** `null` só é válido em fase cuja data é definida na execução. */
  readonly inicio: string | null;
  readonly fim: string | null;
  /**
   * A fase acontece no mesmo momento da anterior. Não é editado aqui: viaja como foi lido, para a
   * gravação do cronograma, que substitui a coleção inteira, não o apagar.
   */
  readonly noMesmoMomentoDaAnterior: boolean;
  readonly produtos: readonly ProdutoDaFase[];
  /** Unidade que responde pela fase; `null` é aceito no rascunho e recusado na publicação. */
  readonly unidadeResponsavelId: string | null;
  readonly emiteParecerIndividual: boolean;
  readonly bancasRequeridas: readonly BancaRequeridaDaFase[];
  readonly regraRecurso: RecursoDaFase | null;
  /**
   * Os tipos de decisão que a fase declara. O cronograma é gravado por substituição: lista ausente
   * apaga a declaração, e por isso a tela a devolve como a leu.
   */
  readonly tiposDeDecisao?: readonly string[];
  /** `null` numa fase acrescentada agora: quem a descreve é o catálogo. */
  readonly congelados: AtributosCongeladosDaFase | null;
}

/**
 * Uma publicação que a fase declara: o tipo de ato e o papel dele no ciclo recursal. Sem produto
 * com papel, a fase não produz resultado; sem produto preliminar, não há do que recorrer.
 *
 * O papel viaja como o texto do contrato, sem estreitar para um conjunto fechado: este passo não
 * o edita, e reduzir um token que o servidor acrescente o transformaria em "sem papel" na gravação
 * seguinte.
 */
export interface ProdutoDaFase {
  readonly atoCodigo: string;
  readonly papel: string | null;
}

/**
 * Uma banca que a fase requer, e as categorias de documento que ela julga. O recorte distingue
 * duas bancas do mesmo tipo na mesma fase, e vazio significa "julga tudo o que a fase exige".
 */
export interface BancaRequeridaDaFase {
  readonly tipoBancaId: string;
  readonly categoriasDocumentoIds: readonly string[];
  readonly regraDeDeliberacao: RegraDeDeliberacaoDaBanca | null;
}

/** Papel do produto de cujo instante de publicação o prazo de recurso conta. */
export const PAPEL_PRELIMINAR = 'PRELIMINAR';

/** Papel do produto que encerra a matéria: dele não cabe mais recurso. */
export const PAPEL_DEFINITIVO = 'DEFINITIVO';

/**
 * O que a fase congelou do catálogo ao entrar no processo. O catálogo é vivo e o cronograma não:
 * a fase removida depois continua valendo no edital, e sem estes atributos a tela esconderia do
 * operador a fase que ele precisa editar. O que a fase publica fica em `produtos`.
 */
export interface AtributosCongeladosDaFase {
  readonly origemData: string;
  readonly agrupaEtapas: boolean;
  readonly coletaInscricao: boolean;
  /**
   * Se a fase admite reenvio de documento depois da análise. É cópia da fase canônica, mas a tela
   * a lê: "abre pendência para reenvio" só vale em fase que permite complementação.
   */
  readonly permiteComplementacao: boolean;
  /** Se é nela que o candidato pede isenção da taxa. */
  readonly coletaSolicitacaoIsencao: boolean;
  /** Código de cada banca exigida, como a fase o congelou. */
  readonly bancas: readonly { readonly id: string; readonly codigo: string }[];
}

/**
 * A regra de recurso de uma fase; a **presença** dela é o que faz a fase admitir recurso. Os
 * parâmetros (prazos, instância superior, efeito suspensivo e guarda da vaga) são os mesmos do
 * recurso da etapa, e `leitura` guarda o que a resposta trouxe e o envio ignora.
 */
export interface RecursoDaFase extends ParametrosDoRecurso {
  readonly leitura: LeituraDoRecurso;
  readonly regraCodigo: string;
  readonly regraVersao: string;
  /**
   * Código do tipo de ato cujo produto ancora o prazo. A leitura devolve `produtoAncoraId`, e a
   * hidratação o cruza com os produtos da própria fase para reconstruir este campo. `''` é
   * ausência declarada, que a conferência cobra, e não um código que reancoraria o prazo em
   * outra publicação.
   */
  readonly atoAncoraCodigo: string;
  /** Procedimentos declarados para o recurso; a tela os mostra e os devolve como os leu. */
  readonly procedimentos: readonly ProcedimentoDeRecurso[];
}

/**
 * O que um procedimento de recurso contesta: um item de avaliação ou uma área do ENEM. O
 * procedimento sem alvo vale para o tipo de decisão inteiro.
 */
export type AlvoDoProcedimentoDeRecurso =
  | { readonly itemDeAvaliacaoId: string }
  | { readonly areaDoEnem: string };

/**
 * Como o recurso é julgado para um tipo de decisão: a regra do catálogo que o conduz. A `sugestao`
 * é o código da regra que o servidor recomenda e serve só de dica ao operador: não se edita e não
 * volta no comando, que recebe apenas o que o operador declarou.
 */
export interface ProcedimentoDeRecurso {
  readonly tipoDeDecisao: string;
  readonly alvo: AlvoDoProcedimentoDeRecurso | null;
  readonly regraCodigo: string;
  readonly regraVersao: string;
  readonly sugestao: string | null;
}

/**
 * Um item de avaliação da etapa. O `id` é atribuído e congelado pelo servidor: lançamento e
 * recurso apontam para ele, então é reenviado quando o item existe e fica `null` no item novo.
 */
export interface ItemDeAvaliacaoDaEtapa {
  /** Chave já atribuída no documento, transportada para a apresentação sem usar o id como substituto. */
  readonly chave?: string;
  readonly id: string | null;
  readonly rotulo: string;
  /** Texto até a conversão, como os demais campos numéricos do editor. */
  readonly pontuacaoMaxima: string;
}

/** Um nível da escala de atendimento; o operador digita o percentual, o comando envia a fração. */
export interface NivelDeAtendimentoDaEtapa {
  readonly rotulo: string;
  readonly percentual: string;
}

/**
 * Uma etapa pontuada do processo, o eixo de nota (distinto do temporal): a janela dela é a da
 * fase que a agrupa. O `id` é reenviado quando a etapa existe, porque desempate e eliminação o
 * referenciam e perdê-lo ao reordenar os deixaria apontando para uma etapa que não existe mais.
 */
export interface EtapaPontuada {
  /** Devolvido pela API; `null` enquanto a etapa é nova. */
  readonly id: string | null;
  readonly nome: string;
  readonly carater: CaraterEtapa | '';
  readonly tipoEtapaOrigemId: string;
  readonly peso: string;
  readonly notaMinima: string;
  /** Teto da escala de lançamento; vazio quando a etapa não tem nota ou ainda não o declarou. Ausente em rascunho anterior ao campo. */
  readonly notaMaxima?: string;
  /** Passo do lançamento da nota; só a etapa de avaliação humana o declara. */
  readonly passoDoLancamento?: string;
  /** Token da forma de avaliação (`OBJETIVA` ou `HUMANA`); vazio quando ainda não declarada. */
  readonly formaDeAvaliacao?: string;
  /** Regra de consolidação das notas dos avaliadores, do catálogo; vazia fora da forma humana. */
  readonly regraConsolidacaoCodigo?: string;
  readonly regraConsolidacaoVersao?: string;
  /** Critérios ou blocos em que a nota da etapa se divide; vazio quando a etapa não os declara. */
  readonly itensDeAvaliacao?: readonly ItemDeAvaliacaoDaEtapa[];
  /** Níveis entre os quais a banca escolhe em cada item; vazio quando a etapa lança nota digitada. */
  readonly escalaDeAtendimento?: readonly NivelDeAtendimentoDaEtapa[];
  readonly ordem: number;
  /**
   * Código canônico da fase a que a etapa pertence, o que permite a qualquer fase subdividir-se
   * (a habilitação com oito etapas, por exemplo). Vazio enquanto a etapa não declara fase.
   */
  readonly faseCodigo: string;
  /** O que a etapa publica: ato e papel no ciclo recursal. */
  readonly produtos: readonly ProdutoDaFase[];
  /** Janela própria da etapa, em hora de parede; vazio quando ela herda a da fase. */
  readonly inicio: string;
  readonly fim: string;
  readonly emiteParecerIndividual: boolean;
  readonly bancas: readonly BancaDaEtapa[];
  readonly recursos: readonly RecursoDaEtapa[];
  /** Tipos de decisão que a etapa declara, devolvidos como lidos: o cronograma se grava por substituição. */
  readonly tiposDeDecisao?: readonly string[];
  /**
   * O que o processo congelou do tipo quando a etapa foi gravada; vale sobre o cadastro enquanto a
   * etapa aponta para o mesmo tipo. Ausente na etapa ainda não gravada.
   */
  readonly tipoCongelado?: TipoCongeladoDaEtapa | null;
}

/** O que a etapa gravada congelou do tipo de etapa do cadastro. */
export interface TipoCongeladoDaEtapa {
  readonly origemId: string;
  readonly nome: string;
  readonly notaDeOrigemNoEnem: boolean;
}

/**
 * Um recurso da etapa. `ancora` diz de que instante o prazo corre: da publicação do ato (e
 * `atoAncoraCodigo` nomeia qual) ou da ciência do candidato, que não tem publicação a referenciar.
 * Os parâmetros são os mesmos da regra de recurso da fase.
 */
export interface RecursoDaEtapa extends ParametrosDoRecurso {
  readonly leitura: LeituraDoRecurso;
  readonly ancora: 'atoPublicado' | 'cienciaIndividual';
  readonly regraCodigo: string;
  readonly regraVersao: string;
  readonly atoAncoraCodigo: string;
  readonly procedimentos: readonly ProcedimentoDeRecurso[];
}
