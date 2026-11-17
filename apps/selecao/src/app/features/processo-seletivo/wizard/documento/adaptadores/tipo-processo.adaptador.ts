import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import { definirTipoDoProcesso } from '../edicoes/identificacao.edicao';
import type { EdicaoDoDocumento } from '../edicoes/secao-do-documento';

/**
 * O tipo do processo como o passo o mostra. O nome gravado é só de leitura: é o que o processo
 * guardou e serve para o tipo que já saiu do catálogo atual continuar identificável.
 */
export interface ValoresDoTipo {
  readonly codigo: string | null;
  readonly nomeGravado: string | null;
}

export function valoresDoFormulario(documento: DocumentoDaConfiguracao): ValoresDoTipo {
  const { tipoProcessoCodigo, tipoProcessoNome } = documento.identificacao ?? {};
  return { codigo: tipoProcessoCodigo ?? null, nomeGravado: tipoProcessoNome ?? null };
}

export function edicaoDoPasso(valores: ValoresDoTipo): EdicaoDoDocumento {
  return (documento) => definirTipoDoProcesso(documento, valores.codigo ?? '');
}
