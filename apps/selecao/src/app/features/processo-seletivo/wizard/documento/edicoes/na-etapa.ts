import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoEtapa,
} from '@uniplus/shared-data/selecao';

import { comPartePorChave } from './partes-por-chave';
import { comLista } from './secao-do-documento';

/** Edita a etapa da chave; sem ela no documento, nada muda. Chave repetida vale a primeira etapa. */
export function naEtapa(
  documento: DocumentoDaConfiguracao,
  chave: string,
  alterar: (etapa: DocumentoDaConfiguracaoEtapa) => DocumentoDaConfiguracaoEtapa,
): DocumentoDaConfiguracao {
  const etapas = comPartePorChave(documento.etapas ?? [], chave, alterar);
  return etapas === undefined ? documento : comLista(documento, 'etapas', etapas);
}
