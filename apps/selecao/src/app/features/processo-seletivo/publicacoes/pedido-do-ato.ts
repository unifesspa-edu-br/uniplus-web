import type {
  PublicarAtoAvulsoDoProcessoRequest,
  PublicarProdutoDoEditalRequest,
} from '@uniplus/shared-data/selecao';

/** O que o formulário declara do ato, antes de virar o corpo do comando. */
export interface DadosDoAto extends DadosDoItem {
  readonly tipoAtoCodigo: string;
}

/** O que o formulário declara de um item do edital: o tipo não entra, porque vem do próprio item. */
export interface DadosDoItem {
  readonly numero: string;
  readonly dataDoAto: string;
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

/** Lista de anexos vazia vai ausente: é assim que o servidor a trata. */
function anexosDoCorpo(anexos: readonly AnexoConfirmado[]) {
  if (anexos.length === 0) return {};
  return {
    anexos: anexos.map((anexo) => ({
      documentoId: anexo.documentoAPublicarId,
      nome: anexo.nome.trim(),
    })),
  };
}

/** O motivo só existe junto do ato corrigido; sem ele, os dois vão ausentes. */
function correcaoDoCorpo(dados: DadosDoItem) {
  if (dados.atoCorrigidoId === null) return {};
  return { atoCorrigidoId: dados.atoCorrigidoId, motivoDaCorrecao: dados.motivoDaCorrecao.trim() };
}

/** O que os dois comandos têm em comum; número em branco vai ausente. */
function corpoDoAto(
  dados: DadosDoItem,
  documentoPrincipalId: string,
  anexos: readonly AnexoConfirmado[],
) {
  const numero = dados.numero.trim();
  return {
    numero: numero === '' ? null : numero,
    dataDoAto: dados.dataDoAto,
    assinante: dados.assinante.trim(),
    documentoPrincipalId,
    ...anexosDoCorpo(anexos),
    ...correcaoDoCorpo(dados),
  };
}

/** O corpo do comando de publicar o documento avulso. */
export function pedidoDoAto(
  dados: DadosDoAto,
  documentoPrincipalId: string,
  anexos: readonly AnexoConfirmado[],
): PublicarAtoAvulsoDoProcessoRequest {
  return { tipoAtoCodigo: dados.tipoAtoCodigo, ...corpoDoAto(dados, documentoPrincipalId, anexos) };
}

/**
 * O corpo do comando de publicar um item do edital. A confirmação da política de divulgação só
 * vale quando a tela a pediu: sem a política na tela, o corpo leva `false`.
 */
export function pedidoDoItem(
  dados: DadosDoItem,
  documentoPrincipalId: string,
  anexos: readonly AnexoConfirmado[],
  politicaConfirmada: boolean,
): PublicarProdutoDoEditalRequest {
  return {
    ...corpoDoAto(dados, documentoPrincipalId, anexos),
    politicaDeDivulgacaoConfirmada: politicaConfirmada,
  };
}
