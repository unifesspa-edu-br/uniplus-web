import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoCronogramaFase,
} from '@uniplus/shared-data/selecao';

import { comPartePorChave } from './partes-por-chave';
import { comLista, naSecao } from './secao-do-documento';

type Fase = DocumentoDaConfiguracaoCronogramaFase;

/**
 * A fase como o formulário a tem. A janela é a hora de parede do campo de data e hora; a posição
 * da fase na lista do formulário é a posição dela no cronograma, porque as fases não têm `ordem`.
 */
export interface FaseDoFormulario {
  readonly origem?: number;
  readonly chave: string;
  readonly faseCanonicaCodigo: string;
  readonly inicio: string;
  readonly fim: string;
  readonly unidadeResponsavelCodigo: string;
}

/** Edita a fase da chave; sem ela no documento, nada muda. Chave repetida vale a primeira fase. */
export function naFase(
  documento: DocumentoDaConfiguracao,
  chave: string,
  alterar: (fase: Fase) => Fase,
): DocumentoDaConfiguracao {
  const fases = comPartePorChave(documento.cronograma?.fases ?? [], chave, alterar);
  if (fases === undefined) return documento;
  return naSecao(documento, 'cronograma', (cronograma) => comLista(cronograma, 'fases', fases));
}
