import type { PredicadoNoWire } from '../editor-de-formulario/modelo/tipos';
import { type BaseLegal, baseLegalNova, CONSEQUENCIAS_ESCOLHIVEIS } from '@uniplus/shared-utils';

/** Uma opção de vocabulário: fase canônica ou tipo de documento, pelo código. */
export interface OpcaoDoDocumento {
  readonly codigo: string;
  readonly nome: string;
  /** Só da fase: se ela admite complementação, que a consequência de reenvio exige. */
  readonly permiteComplementacao?: boolean;
}

/** A norma do documento exigido: a mesma do processo, definida em `@uniplus/shared-utils`. */
export type BaseLegalDoDocumento = BaseLegal;

/** Um documento do conjunto padrão do modelo, na forma do contrato. */
export interface DocumentoExigidoDoFormulario {
  readonly faseCodigo: string;
  readonly tipoDocumentoCodigo: string;
  readonly obrigatorio: boolean;
  readonly quando: PredicadoNoWire;
  readonly consequenciaIndeferimento: string;
  readonly basesLegais: null | readonly BaseLegalDoDocumento[];
}

/** Um documento novo: exigido de todo candidato, com uma norma em branco para preencher. */
export function documentoExigidoNovo(
  faseCodigo: string,
  tipoDocumentoCodigo: string,
): DocumentoExigidoDoFormulario {
  return {
    faseCodigo,
    tipoDocumentoCodigo,
    obrigatorio: true,
    quando: null,
    consequenciaIndeferimento: CONSEQUENCIAS_ESCOLHIVEIS[0].valor,
    basesLegais: [baseLegalNova()],
  };
}

/** As recusas da API a um documento: as da condição ficam junto dela, as demais no cabeçalho. */
export interface RecusasDoDocumento {
  readonly quando: readonly string[];
  readonly demais: readonly string[];
}

/** A API prefixa o caminho com `conteudo.`; a posição é a da lista enviada. */
const DOCUMENTO_APONTADO = /(?:^|\.)documentosExigidos\[(\d+)\](.*)$/iu;
const LISTA_DE_DOCUMENTOS = /(?:^|\.)documentosExigidos$/iu;

/** A recusa aponta um documento exigido do modelo (`documentosExigidos[2].quando[0][1].valor`). */
export function ehRecusaDeDocumento(campo: string): boolean {
  return DOCUMENTO_APONTADO.test(campo) || LISTA_DE_DOCUMENTOS.test(campo);
}

/**
 * Distribui as recusas pelo documento que a API aponta, pela posição na lista enviada. A chave é o
 * próprio documento enviado: editar um documento o troca por outro objeto e a recusa dele some,
 * enquanto a dos demais permanece mesmo que a lista mude de posição. A recusa sem posição — a da
 * lista inteira — vai em `gerais`.
 */
export function distribuirRecusasDosDocumentos(
  recusas: readonly { readonly field: string; readonly message: string }[],
  enviados: readonly DocumentoExigidoDoFormulario[],
): {
  readonly porDocumento: ReadonlyMap<DocumentoExigidoDoFormulario, RecusasDoDocumento>;
  readonly gerais: readonly string[];
} {
  const porDocumento = new Map<DocumentoExigidoDoFormulario, RecusasDoDocumento>();
  const gerais: string[] = [];
  for (const recusa of recusas) {
    const apontada = DOCUMENTO_APONTADO.exec(recusa.field);
    const documento = apontada === null ? undefined : enviados[Number(apontada[1])];
    if (apontada === null || documento === undefined) {
      gerais.push(recusa.message);
      continue;
    }
    const atual = porDocumento.get(documento) ?? { quando: [], demais: [] };
    const daCondicao = /^\.quando\b/iu.test(apontada[2] ?? '');
    porDocumento.set(
      documento,
      daCondicao
        ? { ...atual, quando: [...atual.quando, recusa.message] }
        : { ...atual, demais: [...atual.demais, recusa.message] },
    );
  }
  return { porDocumento, gerais };
}
