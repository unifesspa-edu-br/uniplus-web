import type { PublicarAtoAvulsoDoProcessoRequest } from '@uniplus/shared-data/selecao';

/** O que o formulário declara do ato, antes de virar o corpo do comando. */
export interface DadosDoAto {
  readonly tipoAtoCodigo: string;
  readonly numero: string;
  readonly dataPublicacao: string;
  readonly assinante: string;
  /** O ato que este corrige; `null` quando não corrige nenhum. */
  readonly atoCorrigidoId: string | null;
  readonly motivoDaCorrecao: string;
}

/** Um anexo já confirmado, com o nome com que a pessoa o recebe no download. */
export interface AnexoConfirmado {
  readonly documentoAPublicarId: string;
  readonly nome: string;
}

/**
 * O corpo do comando de publicar o documento avulso. O que o servidor trata como ausente vai
 * ausente: número em branco, lista de anexos vazia e, sem ato corrigido, também o motivo — que só
 * existe junto dele.
 */
export function pedidoDoAto(
  dados: DadosDoAto,
  documentoPrincipalId: string,
  anexos: readonly AnexoConfirmado[],
): PublicarAtoAvulsoDoProcessoRequest {
  const numero = dados.numero.trim();
  return {
    tipoAtoCodigo: dados.tipoAtoCodigo,
    numero: numero === '' ? null : numero,
    dataPublicacao: dados.dataPublicacao,
    assinante: dados.assinante.trim(),
    documentoPrincipalId,
    ...(anexos.length > 0
      ? {
          anexos: anexos.map((anexo) => ({
            documentoId: anexo.documentoAPublicarId,
            nome: anexo.nome.trim(),
          })),
        }
      : {}),
    ...(dados.atoCorrigidoId === null
      ? {}
      : { atoCorrigidoId: dados.atoCorrigidoId, motivoDaCorrecao: dados.motivoDaCorrecao.trim() }),
  };
}
