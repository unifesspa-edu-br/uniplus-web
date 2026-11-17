import type { IdentidadeDoProcedimento } from '../../../documento/edicoes/procedimentos-de-recurso.edicao';
import type { RegraEscolhida } from '../../../documento/regra-escolhida';
import type { ModoDoTipo } from '../../../shared/procedimentos-do-recurso/procedimentos-da-janela';

/** A regra que a pessoa escolheu para o procedimento que a identidade aponta. */
export interface EscolhaDaRegra {
  readonly identidade: IdentidadeDoProcedimento;
  readonly regra: RegraEscolhida;
}

/** O pedido para passar o tipo de decisão ao modo dado. */
export interface TrocaDeModo {
  readonly tipoDeDecisao: string;
  readonly modo: ModoDoTipo;
}
