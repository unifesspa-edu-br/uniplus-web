import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import type { NoExigenciaDto, PreVisualizacaoDoProcessoDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import type { DocumentoAvaliado, ResultadoDaPreVisualizacao } from '@uniplus/shared-ui/components';

/** O que do processo lido nomeia o resultado: o cronograma, as etapas e a árvore de exigências gravados. */
export type ProcessoParaNomear = Pick<ProcessoSeletivoDto, 'cronogramaFases' | 'etapas' | 'raizesExigencia'>;

/**
 * O resultado da pré-visualização do processo como a tela o mostra. A API cita a fase, a etapa e a
 * exigência por identidade; o nome sai do processo gravado — o mesmo que ela avaliou —, e não do
 * rascunho: a fase pelo catálogo, como `descreverFase`, ou pelo código. A exigência repetida por
 * ocorrência leva o grupo que a árvore gravada repete, para a tela dizer de que grupo é o documento
 * mesmo quando nenhuma ocorrência foi avaliada.
 */
export function resultadoDoProcesso(
  dto: PreVisualizacaoDoProcessoDto,
  processo: ProcessoParaNomear | null,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): ResultadoDaPreVisualizacao {
  const fases = new Map(
    (processo?.cronogramaFases ?? []).map((fase) => [
      fase.id,
      { chave: fase.codigo, nome: fasePorId.get(fase.faseCanonicaOrigemId)?.nome ?? fase.codigo, ordem: Number(fase.ordem) },
    ]),
  );
  const etapas = new Map((processo?.etapas ?? []).map((etapa) => [etapa.id, etapa.nome]));
  const grupos = gruposDasExigencias(processo?.raizesExigencia ?? []);
  return {
    formularios: dto.formularios,
    documentos: dto.documentos.map(
      (documento): DocumentoAvaliado => ({
        exigenciaId: documento.exigenciaId,
        nome: documento.tipoDocumentoNome,
        obrigatorio: documento.obrigatorio,
        // A fase fora do cronograma lido só acontece sem leitura ou com ela defasada: fica pela identidade, no fim.
        fase: fases.get(documento.faseId) ?? { chave: documento.faseId, nome: documento.faseId, ordem: Number.POSITIVE_INFINITY },
        etapa: documento.etapaId === null ? null : (etapas.get(documento.etapaId) ?? documento.etapaId),
        situacao: documento.situacao,
        grupo: grupos.get(documento.exigenciaId) ?? null,
        ocorrenciaId: documento.entidadeId,
        alternativas: documento.alternativas.map((alternativa) => ({ grupoId: alternativa.grupoId, minimo: Number(alternativa.minimo) })),
      }),
    ),
  };
}

/** O grupo repetível de cada exigência, herdado do ancestral mais próximo que repete por ocorrência. */
function gruposDasExigencias(raizes: readonly NoExigenciaDto[]): ReadonlyMap<string, string> {
  const grupos = new Map<string, string>();
  const visitar = (no: NoExigenciaDto, herdado: string | null): void => {
    const grupo = no.repetePorEntidade ?? herdado;
    if (no.documento !== null && grupo !== null) grupos.set(no.documento.id, grupo);
    for (const filho of no.filhos) visitar(filho, grupo);
  };
  for (const raiz of raizes) visitar(raiz, null);
  return grupos;
}
