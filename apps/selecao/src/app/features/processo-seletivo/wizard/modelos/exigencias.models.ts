import type { BaseLegal } from '@uniplus/shared-utils';

export interface DocumentoDefinicao {
  id: string;
  nome: string;
  /** A descrição do tipo no cadastro; `null` quando ele não tem. */
  descricao: string | null;
  /** Os formatos aceitos e o tamanho máximo do cadastro, como texto; `null` quando não há. */
  formatos: string | null;
  /** O texto que a edição mostra sob o nome do documento, completo; `null` quando não há. */
  orientacao: string | null;
  /** Que o tipo saiu do cadastro e continua valendo; `null` quando ele ainda está nele. */
  situacao: string | null;
}

export interface DocumentoGrupo {
  label: string;
  docs: DocumentoDefinicao[];
}

/**
 * Uma norma que sustenta a exigência, espelho de `BaseLegalInput`. São N por exigência (ADR-0074),
 * como a lei federal somada à cláusula do edital, e só as `RESOLVIDO` congelam no snapshot da
 * publicação. É a mesma norma do modelo de formulário, definida em `@uniplus/shared-utils`:
 * `observacao` nula ou em branco é a ausência e viaja como `null`.
 */
export type BaseLegalConfig = BaseLegal;

/** Uma cláusula do gatilho, na forma em que o contrato a guarda. */
export interface CondicaoGatilhoConfig {
  readonly clausula: number;
  readonly fato: string;
  readonly operador: string;
  readonly valor: string;
}

/**
 * A idade máxima de emissão aceita para o documento. A fase de referência entra por código: o id da fase
 * não sobrevive a uma gravação de cronograma que a remova e reacrescente, e reenviá-lo faria o
 * servidor recusar uma exigência que a tela nem mostra. O id é resolvido no envio.
 */
export interface IdadeMaximaEmissaoConfig {
  readonly valor: number | null;
  readonly unidade: string | null;
  readonly referenciaTipo: string | null;
  readonly data: string | null;
  readonly referenciaFaseCodigo: string | null;
  readonly referenciaFaseIdLido?: string | null;
}

/** Aplicabilidade, obrigatoriedade, consequências e normas da exigência de documento. */
export interface RegraDaExigenciaDeDocumento {
  readonly aplicabilidade: string;
  readonly obrigatorio: boolean;
  readonly consequenciaIndeferimento: string;
  readonly condicoes: readonly CondicaoGatilhoConfig[];
  readonly basesLegais: readonly BaseLegalConfig[];
}

export type FormatosAceitos =
  | { readonly tipo: 'qualquer' }
  | {
      readonly tipo: 'lista';
      readonly itens: readonly {
        readonly formato: string;
        readonly tamanhoMaximoBytes: number | null;
      }[];
    };

/** Restrições e modelo do documento apresentado. */
export interface CriteriosDoComprovante {
  readonly idadeMaximaEmissao: IdadeMaximaEmissaoConfig | null;
  /** O contrato aceita a string QUALQUER ou uma lista de formatos declarados. */
  readonly formatosPermitidos: FormatosAceitos;
  readonly tamanhoMaximoBytes: number | null;
  /** Modelo que o candidato pode baixar e devolver preenchido. */
  readonly modelo: ModeloDaExigencia | null;
}

/**
 * A exigência de um documento numa fase, a unidade que o contrato guarda: um registro por
 * (documento, fase, etapa). Um registro por tipo de documento achataria, na releitura, o mesmo
 * documento exigido em duas fases, e a gravação seguinte reescreveria a segunda com o valor da
 * primeira. A fase entra por CÓDIGO, como na idade máxima.
 */
export interface ExigenciaDeDocumento extends RegraDaExigenciaDeDocumento, CriteriosDoComprovante {
  readonly tipoDocumentoId: string;
  /**
   * O nome que o processo guardou do tipo de documento. Cobre o tipo removido depois de exigido:
   * sem ele a linha sumiria da tela enquanto a gravação seguiria reenviando a exigência, invisível
   * e intocável. Ausente no que a tela acabou de declarar, porque aí o nome vem do catálogo.
   */
  readonly tipoDocumentoNome?: string;
  readonly faseCodigo: string;
  readonly faseIdLido?: string | null;
  readonly fatosComprovados?: readonly string[];
  /** A etapa daquela fase que coleta o documento; `null` quando é da fase inteira. */
  readonly etapaId: string | null;
  /**
   * O formulário em cujo bloco de comprovação o candidato apresenta o documento (`INSCRICAO`,
   * `ISENCAO_TAXA` ou `HABILITACAO`), como o operador o declarou; `null` enquanto não declarou.
   * A fase não basta, porque inscrição e isenção podem dividir a mesma fase. O que vale diante da
   * fase sai de `finalidadeDaExigencia`, que nunca troca o declarado por outro.
   */
  readonly finalidade: string | null;
}

/**
 * O modelo confirmado que a exigência referencia, como o servidor o copiou: o arquivo é imutável,
 * e o hash é o que congela no edital.
 */
export interface ModeloDaExigencia {
  readonly modeloId: string;
  readonly nomeArquivo: string;
  /** `DOCX` ou `ODT`. */
  readonly formato: string;
  readonly hashSha256: string;
}

/** Preserva as regras que a tela não edita, pois o envio substitui todas as regras. */
export interface RegraDeComprovacao {
  readonly identificadorNoRascunho: string;
  readonly forma: 'DOCUMENTO' | 'TODOS_OS_ITENS' | 'QUANTIDADE_MINIMA_DE_ITENS';
  readonly documento: ExigenciaDeDocumento | null;
  readonly quantidadeMinima: number | null;
  readonly consequencia: string | null;
  readonly basesLegais: readonly BaseLegalConfig[] | null;
  readonly itens: readonly RegraDeComprovacao[] | null;
  readonly criterioDeDistincao: string | null;
  readonly dataReferencia: string | null;
  readonly ocorrenciasEsperadas: readonly string[] | null;
  readonly grupoDoFormularioParaRepeticao: string | null;
}

/**
 * As exigências do rascunho e a intenção de alcance que a tela oferece. `emTodasAsFases` é
 * intenção de UI, não dado da exigência: marca os tipos que valem em toda fase, para a fase
 * acrescentada depois recebê-los. O contrato só conhece a exigência materializada em cada fase.
 */
export interface ExigenciasDoRascunho {
  readonly regrasDeComprovacao: readonly RegraDeComprovacao[];
  readonly emTodasAsFases: readonly string[];
}
