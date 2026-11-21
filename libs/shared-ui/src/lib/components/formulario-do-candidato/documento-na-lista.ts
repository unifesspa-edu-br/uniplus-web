import {
  chaveDaExigencia,
  classeDaSituacao,
  DEPENDE_DE_FASE_POSTERIOR,
  type DocumentoAvaliado,
  EXIGIDO,
  PODE_SER_EXIGIDO,
} from './documentos-avaliados';
import type { DocumentoNaTela, ExigenciaPedida } from './arvore-de-documentos';
import { formatosDaExigencia } from './envio-de-documentos';
import type { GrupoRenderizavel } from './formulario-do-candidato.model';

/** Um integrante de quem a avaliação pede o documento que se repete, e como pede. */
export interface IntegranteDoItem {
  readonly titulo: string | null;
  readonly ocorrenciaId: string | null;
  readonly situacao: string;
}

function situacaoDosIntegrantes(
  documento: DocumentoAvaliado,
  integrantes: readonly IntegranteDoItem[],
): Pick<DocumentoNaTela, 'exigido' | 'situacao'> & { readonly unica: boolean } {
  const situacoes = new Set(integrantes.map((i) => i.situacao));
  if (situacoes.size === 1)
    return { ...situacaoNaLista(classeDaSituacao(documento.situacao)), unica: true };
  return {
    situacao: 'Conforme o integrante, como indicado no nome',
    exigido: situacoes.has(EXIGIDO),
    unica: false,
  };
}

export function documentoJuntado(
  chave: string,
  documento: DocumentoAvaliado,
  grupo: GrupoRenderizavel | undefined,
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
    .filter((i) => i.situacao === EXIGIDO)
    .map((i) => ({
      chave: chaveDaExigencia({ exigenciaId: documento.exigenciaId, ocorrenciaId: i.ocorrenciaId }),
      exigenciaId: documento.exigenciaId,
      ocorrenciaId: i.ocorrenciaId,
      enviavel: i.ocorrenciaId !== null,
      texto: i.titulo === null ? documento.nome : `${documento.nome} — ${i.titulo}`,
    }));
}

/** Como a situação de parte dos integrantes entra no nome do documento, quando ela varia entre eles. */
const PREFIXO_DA_SITUACAO: Readonly<Record<string, string>> = {
  [EXIGIDO]: '',
  [PODE_SER_EXIGIDO]: 'pode ser exigido ',
  [DEPENDE_DE_FASE_POSTERIOR]: 'pode ser exigido, conforme uma fase posterior, ',
};

/** "de cada integrante (familiares)", para quando não se sabe quais integrantes há. */
export function deCadaIntegrante(grupo: GrupoRenderizavel | undefined): string {
  const doGrupo = grupo ? ` (${grupo.rotulo.toLocaleLowerCase('pt-BR')})` : '';
  return `de cada integrante${doGrupo}`;
}

function titulosPorSituacao(
  integrantes: readonly IntegranteDoItem[],
): ReadonlyMap<string, readonly string[]> {
  const porSituacao = new Map<string, string[]>();
  for (const { titulo, situacao } of integrantes) {
    porSituacao.set(situacao, [...(porSituacao.get(situacao) ?? []), titulo as string]);
  }
  return porSituacao;
}

/** As situações presentes, as conhecidas primeiro, na ordem de gravidade, e sem repetir. */
function situacoesEmOrdem(porSituacao: ReadonlyMap<string, unknown>): string[] {
  return [EXIGIDO, PODE_SER_EXIGIDO, DEPENDE_DE_FASE_POSTERIOR, ...porSituacao.keys()].filter(
    (situacao, i, todas) => porSituacao.has(situacao) && todas.indexOf(situacao) === i,
  );
}

/**
 * A quem o documento se aplica, pelos títulos dos integrantes: "de Você (candidato) e do Integrante 1".
 * Quando a situação varia, cada uma diz os seus: "de Você (candidato); pode ser exigido do Integrante 1".
 * Sem saber quais integrantes há, vale para cada um.
 */
function deQuem(
  integrantes: readonly IntegranteDoItem[],
  situacaoUnica: boolean,
  grupo: GrupoRenderizavel | undefined,
): string {
  if (integrantes.some((i) => i.ocorrenciaId === null || i.titulo === null))
    return deCadaIntegrante(grupo);
  const porSituacao = titulosPorSituacao(integrantes);
  return situacoesEmOrdem(porSituacao)
    .map((situacao) => {
      const prefixo = situacaoUnica ? '' : (PREFIXO_DA_SITUACAO[situacao] ?? '');
      return `${prefixo}${comPreposicao(porSituacao.get(situacao) ?? [])}`;
    })
    .join('; ');
}

function comPreposicao(titulos: readonly string[]): string {
  const comDe = titulos.map((t) => (t.startsWith('Integrante') ? `do ${t}` : `de ${t}`));
  return comDe.length === 1 ? comDe[0] : `${comDe.slice(0, -1).join(', ')} e ${comDe.at(-1)}`;
}

/** O que a lista diz da situação do documento, no lugar de a quem a exigência se aplica. */
const TEXTO_DA_SITUACAO: Readonly<Record<string, string>> = {
  [EXIGIDO]: 'Exigido pelas suas respostas',
  [PODE_SER_EXIGIDO]: 'Pode ser exigido, conforme as respostas',
  [DEPENDE_DE_FASE_POSTERIOR]: 'Pode ser exigido, conforme uma fase posterior do processo',
};

function situacaoNaLista(situacao: string): Pick<DocumentoNaTela, 'exigido' | 'situacao'> {
  return {
    exigido: situacao === EXIGIDO,
    situacao: TEXTO_DA_SITUACAO[situacao] ?? TEXTO_DA_SITUACAO[PODE_SER_EXIGIDO],
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
    ...situacaoNaLista(classeDaSituacao(documento.situacao)),
    obrigatorio: documento.obrigatorio,
    ...limitesDoDocumento(documento),
  };
}

function exigidasDoDocumento(
  documento: DocumentoAvaliado,
  chave: string,
  rotulo: string,
): ExigenciaPedida[] {
  if (classeDaSituacao(documento.situacao) !== EXIGIDO) return [];
  const { exigenciaId, ocorrenciaId } = documento;
  return [{ chave, exigenciaId, ocorrenciaId, enviavel: ehEnviavel(documento), texto: rotulo }];
}

function ehEnviavel(documento: DocumentoAvaliado): boolean {
  return (
    documento.ocorrenciaId !== null ||
    (documento.grupoCodigo === null && documento.repetePorEntidade === null)
  );
}
