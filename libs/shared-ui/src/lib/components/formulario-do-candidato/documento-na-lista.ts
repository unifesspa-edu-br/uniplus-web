import { chaveDaExigencia, type DocumentoAvaliado } from './documentos-avaliados';
import type { DocumentoNaTela, ExigenciaPedida } from './regras-de-documentos';
import { formatosDaExigencia } from './envio-de-documentos';
import type { GrupoApresentado } from './formulario-do-candidato.model';

/** Um integrante de quem a avaliação pede o documento que se repete, e como pede. */
export interface IntegranteDoItem {
  readonly titulo: string | null;
  readonly ocorrenciaId: string | null;
  readonly exigido: boolean;
  readonly atendido: boolean;
  readonly rotuloDaSituacao: string;
}

function situacaoDosIntegrantes(
  documento: DocumentoAvaliado,
  integrantes: readonly IntegranteDoItem[],
): Pick<DocumentoNaTela, 'exigido' | 'situacao'> & { readonly unica: boolean } {
  const situacoes = new Set(integrantes.map((i) => (i.exigido ? '' : i.rotuloDaSituacao)));
  const pendente = integrantes
    .filter((integrante) => integrante.exigido && !integrante.atendido)
    .map((integrante) => integrante.rotuloDaSituacao)
    .sort()[0];
  return {
    situacao: rotulosDosIntegrantes(integrantes, pendente) || documento.situacao.rotulo,
    exigido: integrantes.some((i) => i.exigido),
    unica: situacoes.size === 1,
  };
}

function rotulosDosIntegrantes(
  integrantes: readonly IntegranteDoItem[],
  pendente?: string,
): string {
  const rotulos = integrantes.map((integrante) =>
    integrante.exigido ? (pendente ?? integrante.rotuloDaSituacao) : integrante.rotuloDaSituacao,
  );
  return [...new Set(rotulos)].sort().join(' / ');
}

export function documentoJuntado(
  chave: string,
  documento: DocumentoAvaliado,
  grupo: GrupoApresentado | undefined,
  integrantes: readonly IntegranteDoItem[],
): DocumentoNaTela {
  const { unica, ...situacao } = situacaoDosIntegrantes(documento, integrantes);
  const rotulo = `${documento.nome} — ${deQuem(integrantes, unica, grupo)}`;
  const exigidas = exigidasDosIntegrantes(documento, integrantes);
  return { ...paraALista(documento, rotulo), ...situacao, chave, juntado: true, exigidas };
}

function exigidasDosIntegrantes(
  documento: DocumentoAvaliado,
  integrantes: readonly IntegranteDoItem[],
): ExigenciaPedida[] {
  return integrantes
    .filter((i) => i.exigido)
    .map((i) => ({
      chave: chaveDaExigencia({ exigenciaId: documento.exigenciaId, ocorrenciaId: i.ocorrenciaId }),
      exigenciaId: documento.exigenciaId,
      ocorrenciaId: i.ocorrenciaId,
      enviavel: i.ocorrenciaId !== null,
      texto: i.titulo === null ? documento.nome : `${documento.nome} — ${i.titulo}`,
    }));
}

/** "de cada integrante (familiares)", para quando não se sabe quais integrantes há. */
export function deCadaIntegrante(grupo: GrupoApresentado | undefined): string {
  const doGrupo = grupo ? ` (${grupo.rotulo.toLocaleLowerCase('pt-BR')})` : '';
  return `de cada integrante${doGrupo}`;
}

function titulosPorSituacao(
  integrantes: readonly IntegranteDoItem[],
): ReadonlyMap<string, readonly string[]> {
  const porSituacao = new Map<string, string[]>();
  for (const { titulo, exigido, rotuloDaSituacao } of integrantes) {
    const situacao = exigido ? '' : rotuloDaSituacao;
    porSituacao.set(situacao, [...(porSituacao.get(situacao) ?? []), titulo as string]);
  }
  return porSituacao;
}

/**
 * A quem o documento se aplica, pelos títulos dos integrantes: "de Você (candidato) e do Integrante 1".
 * Quando a situação varia, cada uma diz os seus: "de Você (candidato); pode ser exigido do Integrante 1".
 * Sem saber quais integrantes há, vale para cada um.
 */
function deQuem(
  integrantes: readonly IntegranteDoItem[],
  situacaoUnica: boolean,
  grupo: GrupoApresentado | undefined,
): string {
  if (integrantes.some((i) => i.ocorrenciaId === null || i.titulo === null))
    return deCadaIntegrante(grupo);
  const porSituacao = titulosPorSituacao(integrantes);
  return [...porSituacao.keys()]
    .sort((a, b) => Number(b === '') - Number(a === ''))
    .map((situacao) => {
      return `${prefixoDaSituacao(integrantes, situacao, situacaoUnica)}${comPreposicao(porSituacao.get(situacao) ?? [])}`;
    })
    .join('; ');
}

function prefixoDaSituacao(
  integrantes: readonly IntegranteDoItem[],
  situacao: string,
  unica: boolean,
): string {
  if (unica || situacao === '') return '';
  const rotulo = integrantes.find((i) => i.rotuloDaSituacao === situacao)?.rotuloDaSituacao ?? '';
  return `${rotulo} `;
}

function comPreposicao(titulos: readonly string[]): string {
  const comDe = titulos.map((t) => (t.startsWith('Integrante') ? `do ${t}` : `de ${t}`));
  return comDe.length === 1 ? comDe[0] : `${comDe.slice(0, -1).join(', ')} e ${comDe.at(-1)}`;
}

function situacaoNaLista(
  documento: DocumentoAvaliado,
): Pick<DocumentoNaTela, 'exigido' | 'situacao'> {
  return {
    exigido: documento.exigido,
    situacao: documento.situacao.rotulo,
  };
}

function limitesDoDocumento(
  documento: DocumentoAvaliado,
): Pick<
  DocumentoNaTela,
  'formatos' | 'modelo' | 'formatosAceitos' | 'tamanhoMaximoBytes' | 'quantidadeMinima'
> {
  return {
    formatos: formatosDaExigencia(documento.formatosAceitos),
    modelo: documento.modelo,
    formatosAceitos: documento.formatosAceitos,
    tamanhoMaximoBytes: documento.tamanhoMaximoBytes,
    quantidadeMinima: documento.quantidadeMinima,
  };
}

export function paraALista(documento: DocumentoAvaliado, rotulo: string): DocumentoNaTela {
  const chave = chaveDaExigencia(documento);
  return {
    chave,
    juntado: false,
    rotulo,
    exigidas: exigidasDoDocumento(documento, chave, rotulo),
    ...situacaoNaLista(documento),
    obrigatorio: documento.obrigatorio,
    ...limitesDoDocumento(documento),
  };
}

function exigidasDoDocumento(
  documento: DocumentoAvaliado,
  chave: string,
  rotulo: string,
): ExigenciaPedida[] {
  if (!documento.exigido) return [];
  const { exigenciaId, ocorrenciaId } = documento;
  return [{ chave, exigenciaId, ocorrenciaId, enviavel: ehEnviavel(documento), texto: rotulo }];
}

function ehEnviavel(documento: DocumentoAvaliado): boolean {
  return (
    documento.ocorrenciaId !== null ||
    (documento.grupoCodigo === null && documento.grupoDoFormularioParaRepeticao === null)
  );
}
