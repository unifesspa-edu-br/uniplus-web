import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';

/**
 * Percorre a estrutura de regras aplicando uma transformação a cada regra de documento; regra de documento que a transformação
 * descarta sai, e grupo que fica sem item nenhum sai junto, em cascata.
 *
 * O colapso em cascata é o mesmo que a regra principal faz no servidor ao remover uma fase: grupo sem
 * alternativa não exige nada, e mandá-lo vazio faria o `PUT` recusar a estrutura de regras inteira.
 */
export function transformar(
  regras: readonly RegraDeComprovacao[],
  transformacao: (documento: ExigenciaDeDocumento) => ExigenciaDeDocumento | null,
): readonly RegraDeComprovacao[] {
  return regras.flatMap((regra) => transformarExigencia(regra, transformacao) ?? []);
}

function transformarExigencia(
  regra: RegraDeComprovacao,
  transformacao: (documento: ExigenciaDeDocumento) => ExigenciaDeDocumento | null,
): RegraDeComprovacao | null {
  if (regra.forma === 'DOCUMENTO') {
    if (regra.documento === null) return null;
    const documento = transformacao(regra.documento);
    if (documento === null) return null;
    return { ...regra, documento };
  }
  const itensDoGrupo = transformar(regra.itens ?? [], transformacao);
  if (itensDoGrupo.length === 0) return null;
  const quantidadeMinima = coubeNoGrupo(regra.quantidadeMinima, itensDoGrupo.length);
  return { ...regra, itens: itensDoGrupo, quantidadeMinima };
}

/**
 * A quantidade mínima que ainda cabe no grupo após remover alternativas.
 *
 * Um grupo que pedia duas alternativas e ficou com uma só continuaria pedindo duas: o agregado
 * recusa, e a recusa chega depois de as etapas, o cronograma e o formulário já terem sido
 * gravados — falando de um campo que esta tela não mostra. Reduzir preserva a intenção
 * possível: continuar pedindo o máximo que o grupo ainda oferece.
 */
function coubeNoGrupo(quantidadeMinima: number | null, itens: number): number | null {
  if (quantidadeMinima === null) return null;
  return Math.min(quantidadeMinima, itens);
}

/**
 * As exigências sem a fase removida do cronograma. A exigência que valia só ali deixa de
 * existir; o mesmo documento em outra fase continua, porque são exigências distintas.
 *
 * A idade máxima que usava essa fase como referência deixa de apontar para a fase removida
 * — a recusa do servidor falaria de um campo que a tela não mostra.
 */
export function semAFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): ExigenciasDoRascunho {
  const regrasDeComprovacao = transformar(exigencias.regrasDeComprovacao, (documento) =>
    documentoSemFase(documento, faseCodigo),
  );
  const tiposSemGrupo = tiposDeDocumentoSemGrupo(regrasDeComprovacao);
  return {
    regrasDeComprovacao,
    emTodasAsFases: exigencias.emTodasAsFases.filter((tipo) => tiposSemGrupo.has(tipo)),
  };
}

function documentoSemFase(
  documento: ExigenciaDeDocumento,
  faseCodigo: string,
): ExigenciaDeDocumento | null {
  if (documento.faseCodigo === faseCodigo) return null;
  if (documento.idadeMaximaEmissao?.referenciaFaseCodigo !== faseCodigo) return documento;
  return {
    ...documento,
    idadeMaximaEmissao: { ...documento.idadeMaximaEmissao, referenciaFaseCodigo: null },
  };
}

/** O alcance de todas as fases depende de uma exigência de regra principal que sirva de modelo. */
function tiposDeDocumentoSemGrupo(
  regrasDeComprovacao: readonly RegraDeComprovacao[],
): ReadonlySet<string> {
  return new Set(
    regrasDeComprovacao.flatMap((regra) =>
      regra.forma === 'DOCUMENTO' && regra.documento !== null
        ? [regra.documento.tipoDocumentoId]
        : [],
    ),
  );
}

/**
 * As exigências sem a etapa removida: quem a apontava como ponto de coleta volta a ser da
 * fase inteira, em vez de reenviar o identificador de uma etapa que não existe mais.
 */
export function semAEtapa(exigencias: ExigenciasDoRascunho, etapaId: string): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: transformar(exigencias.regrasDeComprovacao, (documento) =>
      documento.etapaId === etapaId ? { ...documento, etapaId: null } : documento,
    ),
  };
}
