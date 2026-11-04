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
 * publicação. `observacao` vazia é a ausência e vira `null` no envio.
 */
export interface BaseLegalConfig {
  readonly referencia: string;
  readonly abrangencia: string;
  readonly status: string;
  readonly observacao: string;
}

/** Uma cláusula do gatilho, na forma em que o contrato a guarda. */
export interface CondicaoGatilhoConfig {
  readonly clausula: number;
  readonly fato: string;
  readonly operador: string;
  readonly valor: string;
}

/**
 * A idade máxima de emissão aceita para o documento. A fase âncora entra por CÓDIGO: o id da fase
 * não sobrevive a uma gravação de cronograma que a remova e reacrescente, e reenviá-lo faria o
 * servidor recusar uma exigência que a tela nem mostra. O id é resolvido no envio.
 */
export interface IdadeMaximaEmissaoConfig {
  readonly valor: number | null;
  readonly unidade: string | null;
  readonly referenciaTipo: string | null;
  readonly data: string | null;
  readonly referenciaFaseCodigo: string | null;
}

/**
 * A exigência de um documento numa fase, a unidade que o contrato guarda: um registro por
 * (documento, fase, etapa). Um registro por tipo de documento achataria, na releitura, o mesmo
 * documento exigido em duas fases, e a gravação seguinte reescreveria a segunda com o valor da
 * primeira. A fase entra por CÓDIGO, como na idade máxima.
 */
export interface ExigenciaDeDocumento {
  readonly tipoDocumentoId: string;
  /**
   * O nome que o processo guardou do tipo de documento. Cobre o tipo inativado depois de exigido:
   * sem ele a linha sumiria da tela enquanto a gravação seguiria reenviando a exigência, invisível
   * e intocável. Ausente no que a tela acabou de declarar, porque aí o nome vem do catálogo.
   */
  readonly tipoDocumentoNome?: string;
  readonly faseCodigo: string;
  /** A etapa daquela fase que coleta o documento; `null` quando é da fase inteira. */
  readonly etapaId: string | null;
  /**
   * O formulário em cujo bloco de comprovação o candidato apresenta o documento (`INSCRICAO`,
   * `ISENCAO_TAXA` ou `HABILITACAO`), como o operador o declarou; `null` enquanto não declarou.
   * A fase não basta, porque inscrição e isenção podem dividir a mesma fase. O que vale diante da
   * fase sai de `finalidadeDaExigencia`, que nunca troca o declarado por outro.
   */
  readonly finalidade: string | null;
  readonly aplicabilidade: string;
  readonly obrigatorio: boolean;
  readonly consequenciaIndeferimento: string;
  readonly condicoes: readonly CondicaoGatilhoConfig[];
  readonly basesLegais: readonly BaseLegalConfig[];
  readonly idadeMaximaEmissao: IdadeMaximaEmissaoConfig | null;
  /**
   * Formato e tamanho vêm do cadastro do tipo de documento. Viajam como valor JSON polimórfico: a
   * string `QUALQUER` ou a lista de formatos.
   */
  readonly formatosPermitidos: unknown;
  readonly tamanhoMaximoBytes: number | null;
  /**
   * O modelo que a exigência oferece ao candidato para baixar, preencher e devolver; `null` quando
   * não oferece. O `PUT` da árvore substitui tudo, então sem reenviar o modelo cada gravação o
   * desvincularia.
   */
  readonly modelo: ModeloDaExigencia | null;
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

/**
 * Um nó da árvore de satisfação, espelho de `NoExigenciaInput`. O rascunho guarda a árvore porque
 * o `PUT` a substitui INTEIRA: o que o wizard não souber expressar e regravar é apagado. Guardando
 * o que veio, o que a tela não edita (grupo `OU`, cardinalidade qualificada, repetição por
 * entidade) sobrevive sem uma lista de campos a preservar.
 */
export interface NoDeExigencia {
  readonly tipo: 'FOLHA' | 'E' | 'OU';
  readonly documento: ExigenciaDeDocumento | null;
  readonly quantidadeMinima: number | null;
  readonly consequencia: string | null;
  readonly basesLegais: readonly BaseLegalConfig[] | null;
  readonly filhos: readonly NoDeExigencia[] | null;
  readonly chaveDistincao: string | null;
  readonly dataReferencia: string | null;
  readonly ocorrenciasEsperadas: readonly string[] | null;
  readonly repetePorEntidade: string | null;
}

/**
 * As exigências do rascunho e a intenção de alcance que a tela oferece. `emTodasAsFases` é
 * intenção de UI, não dado da exigência: marca os tipos que valem em toda fase, para a fase
 * acrescentada depois recebê-los. O contrato só conhece a exigência materializada em cada fase.
 */
export interface ExigenciasDoRascunho {
  readonly raizes: readonly NoDeExigencia[];
  readonly emTodasAsFases: readonly string[];
}
