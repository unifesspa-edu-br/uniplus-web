import type { ApiOk } from '@uniplus/shared-core/http';
import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

/**
 * A versão vigente de que a retificação parte: o documento lido e o `ETag` que a identifica. O
 * envio devolve o `ETag` em `If-Match`, e por isso ele é guardado como veio, sem interpretação.
 */
export interface VersaoBaseDaRetificacao {
  readonly id: string;
  readonly versao: number;
  readonly etag: string;
  readonly documento: DocumentoDaConfiguracao;
}

/**
 * Monta a base a partir da leitura da configuração. Sem `ETag` ou sem número de versão não há como
 * enviar a retificação com segurança, e a leitura vale como falha: `null`.
 */
export function versaoBaseDaResposta(
  id: string,
  resposta: ApiOk<DocumentoDaConfiguracao>,
): VersaoBaseDaRetificacao | null {
  const etag = resposta.headers.get('ETag');
  const versao = resposta.data.versao;
  if (etag === null || etag === '' || versao === undefined) return null;
  return { id, versao, etag, documento: resposta.data };
}
