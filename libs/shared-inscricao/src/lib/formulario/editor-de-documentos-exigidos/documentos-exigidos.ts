import type { ClausulasNoWire } from '../editor-de-condicoes/condicoes/condicoes-no-wire';
import { type BaseLegal, baseLegalNova } from '@uniplus/shared-utils';

/** Uma opção de vocabulário: fase canônica ou tipo de documento, pelo código. */
export interface OpcaoDoDocumento {
  readonly codigo: string;
  readonly nome: string;
  /** Só da fase: se ela admite complementação, que o prazo para reenvio exige. */
  readonly permiteComplementacao?: boolean;
}

/** Uma consequência do descumprimento, como a API a devolve: o código e o rótulo que a tela mostra. */
export interface ConsequenciaDoDescumprimento {
  readonly codigo: string;
  readonly rotulo: string;
}

/** A norma do documento exigido: a mesma do processo, definida em `@uniplus/shared-utils`. */
export type BaseLegalDoDocumento = BaseLegal;

/** A data que serve de referência ao prazo de emissão ou à validade; os códigos seguem em texto. */
export interface DataDeReferenciaDoDocumento {
  readonly tipo: null | string;
  readonly data: null | string;
  readonly faseCodigo: null | string;
}

export interface PrazoDeEmissaoDoDocumento {
  readonly escolha: null | string;
  readonly valor: null | number;
  readonly unidade: null | string;
  readonly referencia: null | DataDeReferenciaDoDocumento;
  readonly efeitoForaDoPrazo: null | string;
}

export interface ValidadeDoDocumento {
  readonly escolha: null | string;
  readonly referencia: null | DataDeReferenciaDoDocumento;
  readonly efeitoDoVencimento: null | string;
}

/** O que o documento exige de quem o envia: prazo de emissão e validade. O editor os preserva como vieram. */
export interface RequisitosDoDocumento {
  readonly prazoDeEmissao: null | PrazoDeEmissaoDoDocumento;
  readonly validade: null | ValidadeDoDocumento;
}

/**
 * Um documento do conjunto padrão do modelo, na forma que o editor edita: o indeferimento do
 * contrato vem desdobrado em campos, e o app que grava o devolve ao bloco.
 */
export interface DocumentoExigidoDoFormulario<O = string> {
  readonly faseCodigo: string;
  readonly tipoDocumentoCodigo: string;
  readonly obrigatorio: boolean;
  readonly quando: ClausulasNoWire<O> | null;
  /** Nula quando o documento não tem consequência declarada. */
  readonly consequenciaDoDescumprimento: null | string;
  /** Só vale em fase que admite complementação: a API recusa nas demais. */
  readonly abrePrazoParaReenvio: boolean;
  readonly basesLegais: null | readonly BaseLegalDoDocumento[];
  readonly requisitos?: null | RequisitosDoDocumento;
  readonly porOpcao?: null | { readonly fatoCodigo: string; readonly exceto: readonly string[] };
}

/** Um grupo de documentos: vale a quantidade mínima, e a consequência é a do grupo. */
export interface GrupoDeDocumentosDoFormulario<O = string> {
  readonly quantidadeMinima: null | number;
  readonly indeferimento: null | {
    readonly consequenciaDoDescumprimento: null | string;
    readonly basesLegais: null | readonly BaseLegalDoDocumento[];
    readonly abrePrazoParaReenvio: boolean;
  };
  readonly documentos: readonly DocumentoExigidoDoFormulario<O>[];
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
    consequenciaDoDescumprimento: null,
    abrePrazoParaReenvio: false,
    basesLegais: [baseLegalNova()],
  };
}

/**
 * As recusas da API a um documento: cada uma fica junto do campo a que se refere (condição,
 * obrigatoriedade, prazo para reenvio) e as demais no cabeçalho.
 */
export interface RecusasDoDocumento {
  readonly quando: readonly string[];
  readonly obrigatorio: readonly string[];
  readonly prazoParaReenvio: readonly string[];
  readonly demais: readonly string[];
}

interface RecusasDistribuidas {
  readonly porDocumento: ReadonlyMap<DocumentoExigidoDoFormulario, RecusasDoDocumento>;
  readonly gerais: readonly string[];
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
): RecusasDistribuidas {
  const porDocumento = new Map<DocumentoExigidoDoFormulario, RecusasEmColeta>();
  const gerais: string[] = [];
  for (const { field, message } of recusas) {
    const apontada = DOCUMENTO_APONTADO.exec(field);
    const documento = apontada === null ? undefined : enviados[Number(apontada[1])];
    if (apontada === null || documento === undefined) gerais.push(message);
    else guardarRecusa(porDocumento, documento, apontada[2] ?? '', message);
  }
  return { porDocumento, gerais };
}

type RecusasEmColeta = { -readonly [campo in keyof RecusasDoDocumento]: string[] };

const CAMPOS_RECUSADOS = [
  ['quando', /^\.quando\b/iu],
  ['obrigatorio', /^\.indeferimento\.obrigatorio$/iu],
  ['prazoParaReenvio', /^\.indeferimento\.abrePrazoParaReenvio$/iu],
] as const;

function campoDaRecusa(caminho: string): keyof RecusasDoDocumento {
  return CAMPOS_RECUSADOS.find(([, padrao]) => padrao.test(caminho))?.[0] ?? 'demais';
}

function guardarRecusa(
  porDocumento: Map<DocumentoExigidoDoFormulario, RecusasEmColeta>,
  documento: DocumentoExigidoDoFormulario,
  caminho: string,
  mensagem: string,
): void {
  const recusas = porDocumento.get(documento) ?? {
    quando: [],
    obrigatorio: [],
    prazoParaReenvio: [],
    demais: [],
  };
  recusas[campoDaRecusa(caminho)].push(mensagem);
  porDocumento.set(documento, recusas);
}
