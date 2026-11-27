import type { FormularioApresentadoDoProcessoDto } from '@uniplus/shared-data/selecao';
import {
  type DocumentosAvaliados,
  type ErroDoServidor,
  chaveDoCampoDeDocumento,
  ehCampoDeDocumento,
  localizarCampo,
} from '@uniplus/shared-inscricao/formulario';

type DocumentoAvaliado = DocumentosAvaliados['fases'][number]['documentos'][number];
type DocumentoDaRecusa = Pick<DocumentoAvaliado, 'exigenciaId' | 'nome' | 'formularioCodigo'>;

/** Uma recusa do servidor ligada ao formulário que a mostra e ao nome com que a tela chama o campo. */
export interface RecusaNoFormulario extends ErroDoServidor {
  readonly formularioCodigo: string;
  /** O nome do campo, grupo, termo ou documento recusado; nulo quando a tela não o conhece. */
  readonly rotulo: string | null;
}

/** As recusas de cada formulário e o formulário da primeira, que a tela abre. */
export interface RecusasPorFormulario {
  /** Todas as recusas, na ordem da API, cada uma com o formulário dela. */
  readonly itens: readonly RecusaNoFormulario[];
  readonly porFormulario: ReadonlyMap<string, readonly ErroDoServidor[]>;
  /** O formulário da primeira recusa da API (ADR-0125); nulo sem recusa. */
  readonly primeiro: string | null;
}

/** O que a tela sabe para ligar uma recusa ao formulário dela. */
export interface ReferenciasDasRecusas {
  readonly formularios: readonly FormularioApresentadoDoProcessoDto[];
  readonly documentos: readonly DocumentoDaRecusa[];
}

function documentoDa(
  campo: string,
  documentos: readonly DocumentoDaRecusa[],
): DocumentoDaRecusa | undefined {
  const [exigenciaId] = chaveDoCampoDeDocumento(campo).split(':');
  return documentos.find((d) => d.exigenciaId === exigenciaId);
}

type Localizacao = Pick<RecusaNoFormulario, 'formularioCodigo' | 'rotulo'>;

function localizarDocumento(
  campo: string,
  documentos: readonly DocumentoDaRecusa[],
): Localizacao | null {
  const documento = documentoDa(campo, documentos);
  return documento?.formularioCodigo
    ? { formularioCodigo: documento.formularioCodigo, rotulo: documento.nome }
    : null;
}

function localizar(
  erro: ErroDoServidor,
  { formularios, documentos }: ReferenciasDasRecusas,
): Localizacao | null {
  if (ehCampoDeDocumento(erro.campo)) return localizarDocumento(erro.campo, documentos);
  for (const { codigo, formulario } of formularios) {
    const rotulo = localizarCampo(formulario, erro.campo);
    if (rotulo !== null) return { formularioCodigo: codigo, rotulo };
  }
  return null;
}

function ligar(erro: ErroDoServidor, referencias: ReferenciasDasRecusas): RecusaNoFormulario {
  const achada = localizar(erro, referencias);
  // A recusa que a tela não sabe localizar fica no primeiro formulário.
  const formularioCodigo = achada?.formularioCodigo ?? referencias.formularios[0]?.codigo ?? '';
  return { ...erro, formularioCodigo, rotulo: achada?.rotulo ?? null };
}

/**
 * Distribui as recusas pelos formulários em que a tela as mostra. O dado e o grupo são achados pela
 * apresentação do formulário, o termo pelo código dele nas regras, o documento pela exigência da avaliação.
 */
export function recusasPorFormulario(
  erros: readonly ErroDoServidor[],
  referencias: ReferenciasDasRecusas,
): RecusasPorFormulario {
  const itens = erros.map((erro) => ligar(erro, referencias));
  const porFormulario = new Map<string, ErroDoServidor[]>();
  for (const { formularioCodigo, campo, mensagem } of itens) {
    porFormulario.set(formularioCodigo, [
      ...(porFormulario.get(formularioCodigo) ?? []),
      { campo, mensagem },
    ]);
  }
  return { itens, porFormulario, primeiro: itens[0]?.formularioCodigo ?? null };
}
