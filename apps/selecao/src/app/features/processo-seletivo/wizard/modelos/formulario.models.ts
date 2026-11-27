import type { ConsequenciaDoDescumprimentoCodigo } from '@uniplus/shared-data/selecao';
import type { ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';

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
 * Um formulário do processo no rascunho, identificado pelo código. A fase entra por CÓDIGO, pela
 * mesma razão da referência temporal, e vira o id dela no envio. `gravado` diz se o servidor já
 * tem o formulário: o código só se edita enquanto ele não existe lá.
 *
 * O conteúdo é o do editor de formulário, com a seção dos dados básicos que a API acrescenta: ela
 * fica no rascunho para o editor mostrá-la e as citações a enxergarem, e sai do envio.
 */
export interface FormularioDoProcessoNoRascunho {
  readonly codigo: string;
  readonly gravado: boolean;
  readonly faseCodigo: string;
  readonly obrigatorio: boolean;
  /** A consequência de o candidato não enviar o formulário; `null` é "sem consequência própria". */
  readonly consequenciaDaFaltaDeEnvio: ConsequenciaDoDescumprimentoCodigo | null;
  readonly conteudo: ConteudoDoFormulario;
  /**
   * O código do modelo de que o formulário partiu; nulo quando foi composto no processo. Só o
   * servidor o define, ao aplicar um modelo, e editar a cópia depois não o apaga.
   */
  readonly modeloOrigemCodigo: string | null;
}

/**
 * Os formulários do processo e o que, do processo, eles sustentam. A política temporal e as regras
 * de derivação são do processo e viajam por rotas próprias; ficam aqui porque este passo as edita
 * e as usa.
 */
export interface FormularioDeInscricao {
  readonly formularios: readonly FormularioDoProcessoNoRascunho[];
  readonly referenciaTemporal: ReferenciaTemporalConfig;
  readonly derivacao: readonly DerivacaoDeFato[];
}
