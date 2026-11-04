import type { ConteudoDoFormulario } from '@uniplus/shared-ui/components';

/**
 * O instante contra o qual a idade do candidato é apurada, uma política por certame que ancora
 * todos os gatilhos etários. A fase entra por CÓDIGO (o id não sobrevive a uma gravação de
 * cronograma que a remova e reacrescente), e `tipo` vazio é a ausência da política, legítima
 * enquanto nenhum gatilho citar faixa etária.
 */
export interface ReferenciaTemporalConfig {
  readonly tipo: string;
  readonly data: string;
  readonly faseCodigo: string;
}

/**
 * Como um fato derivado é calculado a partir dos coletados. A tela semeia as regras de modalidade
 * a partir do recorte declarado; o resto é carregado como veio.
 */
export interface DerivacaoDeFato {
  readonly codigoFato: string;
  readonly regras: unknown;
}

/**
 * O formulário de inscrição do certame e o que, do processo, ele sustenta. O conteúdo é o do
 * editor de formulário, com a seção dos dados básicos que a API acrescenta: ela fica no rascunho
 * para o editor mostrá-la e as citações a enxergarem, e sai do envio. A fase entra por CÓDIGO,
 * pela mesma razão da referência temporal.
 *
 * A política temporal e as regras de derivação são do processo e viajam por rotas próprias; ficam
 * aqui porque este passo as edita e as usa.
 */
export interface FormularioDeInscricao {
  readonly faseCodigo: string;
  readonly conteudo: ConteudoDoFormulario;
  readonly referenciaTemporal: ReferenciaTemporalConfig;
  readonly derivacao: readonly DerivacaoDeFato[];
  /**
   * Os formulários das OUTRAS finalidades (isenção da taxa, habilitação), na ordem das finalidades.
   * A inscrição fica nos campos de cima porque todo processo a tem; as outras existem só quando o
   * operador as acrescenta. Um fato tem um único formulário que o coleta.
   */
  readonly outrasFinalidades: readonly FormularioDaFinalidade[];
  /** O código do modelo de que a inscrição partiu; ausente ou nulo quando foi composta no processo. */
  readonly modeloOrigemCodigo?: string | null;
}

/** O formulário de uma finalidade no rascunho: a fase por CÓDIGO, como a da inscrição, e o conteúdo do editor. */
export interface FormularioDaFinalidade {
  readonly finalidade: string;
  readonly faseCodigo: string;
  readonly conteudo: ConteudoDoFormulario;
  /**
   * O código do modelo de que o formulário partiu; ausente ou nulo quando foi composto no processo.
   * Só o servidor o define, ao aplicar um modelo, e editar a cópia depois não o apaga.
   */
  readonly modeloOrigemCodigo?: string | null;
}
