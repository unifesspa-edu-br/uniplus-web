import type { FatoEscolhivel } from '@uniplus/shared-inscricao/formulario';

import type { RegraDeHomologacao } from '../../../modelos/homologacao.models';
import {
  descricaoDaCondicaoDeHomologacao,
  type RotuloDaEdicao,
} from '../../../shared/homologacao/descricao-da-regra-de-homologacao';

/** O motivo da condição ainda não apontado. */
export const MOTIVO_NAO_APONTADO = 'não apontado';

/** O que a leitura precisa para nomear o que a regra aponta por código. */
export interface NomesDaLeitura {
  readonly fatos: ReadonlyMap<string, FatoEscolhivel>;
  readonly edicao: RotuloDaEdicao;
  readonly motivo: (codigo: string) => string;
}

/**
 * Cada condição da regra numa linha, com a alternativa a que pertence e o motivo desfavorável que
 * aponta: o que a consulta mostra no lugar dos campos.
 */
export function linhasDaRegraDeHomologacao(
  regra: RegraDeHomologacao,
  nomes: NomesDaLeitura,
): readonly string[] {
  return regra.alternativas.flatMap((alternativa, daAlternativa) =>
    alternativa.condicoes.map((condicao, daCondicao) => {
      const descricao = descricaoDaCondicaoDeHomologacao(condicao, nomes.fatos, nomes.edicao);
      const codigo = condicao.motivoDesfavoravelCodigo;
      const motivo = codigo === null ? MOTIVO_NAO_APONTADO : nomes.motivo(codigo);
      return `Alternativa ${daAlternativa + 1}, condição ${daCondicao + 1}: ${descricao}. Motivo desfavorável: ${motivo}.`;
    }),
  );
}
