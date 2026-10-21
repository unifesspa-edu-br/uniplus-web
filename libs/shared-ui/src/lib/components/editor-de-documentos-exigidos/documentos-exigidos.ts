import type { PredicadoNoWire } from '../editor-de-formulario/formulario-editavel';

/** Alcance da norma que sustenta a exigência, como a tela o nomeia. */
export const ABRANGENCIA_PADRAO = 'INTERNA_EDITAL';
export const STATUS_BASE_LEGAL_RESOLVIDO = 'RESOLVIDO';

export const ABRANGENCIAS_ESCOLHIVEIS = [
  { valor: 'FEDERAL', rotulo: 'Lei federal' },
  { valor: 'ESTADUAL', rotulo: 'Lei estadual' },
  { valor: 'MUNICIPAL', rotulo: 'Lei municipal' },
  { valor: 'INTERNA_NORMA', rotulo: 'Norma interna da universidade' },
  { valor: ABRANGENCIA_PADRAO, rotulo: 'O próprio edital' },
] as const;

/** Se a norma já foi identificada ou se a identificação segue pendente. */
export const STATUS_BASE_LEGAL_ESCOLHIVEIS = [
  { valor: STATUS_BASE_LEGAL_RESOLVIDO, rotulo: 'Resolvida' },
  { valor: 'PENDENTE', rotulo: 'Pendente' },
] as const;

/**
 * A consequência que só vale em fase que admite complementação — o servidor a recusa nas
 * demais.
 */
export const CONSEQUENCIA_REENVIO = 'PENDENCIA_REENVIO';

/** O que acontece com o candidato que não apresenta o documento. */
export const CONSEQUENCIAS_ESCOLHIVEIS = [
  { valor: 'ELIMINA', rotulo: 'Elimina do processo' },
  { valor: 'RECLASSIFICA_AC', rotulo: 'Reclassifica para ampla concorrência' },
  { valor: 'REMOVE_VANTAGEM', rotulo: 'Remove a vantagem pleiteada' },
  { valor: CONSEQUENCIA_REENVIO, rotulo: 'Abre pendência para reenvio' },
] as const;

/**
 * As consequências que a fase admite: o reenvio só vale em fase que admite complementação, e
 * oferecê-lo nas demais levaria a uma recusa na gravação que o operador não saberia ligar ao que fez.
 */
export function consequenciasDaFase<T extends { readonly valor: string }>(
  consequencias: readonly T[],
  admiteComplementacao: boolean,
): readonly T[] {
  return admiteComplementacao
    ? consequencias
    : consequencias.filter((consequencia) => consequencia.valor !== CONSEQUENCIA_REENVIO);
}

export interface BaseLegalDoDocumento {
  readonly referencia: string;
  readonly abrangencia: string;
  readonly status: string;
  readonly observacao: null | string;
}

/** Um documento do conjunto padrão do modelo, na forma do contrato. */
export interface DocumentoExigidoDoFormulario {
  readonly faseCodigo: string;
  readonly tipoDocumentoCodigo: string;
  readonly obrigatorio: boolean;
  readonly quando: PredicadoNoWire;
  readonly consequenciaIndeferimento: string;
  readonly basesLegais: null | readonly BaseLegalDoDocumento[];
}

/** Uma norma em branco, no alcance e no status que são o caso comum. */
export function baseLegalNova(): BaseLegalDoDocumento {
  return {
    referencia: '',
    abrangencia: ABRANGENCIA_PADRAO,
    status: STATUS_BASE_LEGAL_RESOLVIDO,
    observacao: null,
  };
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
