import type {
  DocumentoExigidoDto,
  BaseLegalDto,
  NoExigenciaDto,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import type {
  BaseLegalConfig,
  ExigenciaDeDocumento,
  RegraDaExigenciaDeDocumento,
  CriteriosDoComprovante,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../../processo-seletivo.models';

/**
 * A árvore de exigências como o rascunho a guarda, lida de `raizesExigencia`.
 *
 * Lê a ÁRVORE, não a lista plana `documentosExigidos`: a lista plana não diz quem é filho de
 * qual grupo, e reconstruir tudo como folha solta apagaria o grupo `OU` e a consequência
 * própria dele na gravação seguinte.
 */
export function exigenciasDe(dto: ProcessoSeletivoDto): ExigenciasDoRascunho {
  const codigoPorFaseId = new Map((dto.cronogramaFases ?? []).map((f) => [f.id, f.codigo]));
  const raizes = lerExigencias(dto.raizesExigencia ?? [], codigoPorFaseId);
  return {
    raizes,
    emTodasAsFases: documentosExigidosEmTodasAsFases(raizes, [...codigoPorFaseId.values()]),
  };
}

/**
 * Relê, do que voltou do servidor, quais documentos o operador declarou valer em todas as fases.
 *
 * A intenção não trafega: o contrato recebe as folhas já materializadas, uma por fase. Sem
 * reconstruí-la, reabrir o processo a rebaixava a uma escolha fase a fase — e a fase criada
 * depois disso ficava sem o documento, sem nada na tela denunciando a ausência.
 *
 * O sinal é estar em todas as fases DA MESMA MANEIRA. Estar em todas não basta: o certame pode
 * exigir o mesmo documento em cada fase por razões próprias, com condições, consequência ou
 * norma diferentes em cada uma. Lê-las como um alcance global faria a fase criada depois
 * receber uma cópia arbitrária de uma dessas declarações — configuração que ninguém pediu, e
 * pior do que a intenção perdida. Declarações idênticas não têm esse risco: a cópia reproduz o
 * que já está lá.
 *
 * Exige ainda ao menos duas fases: com uma só, "vale em todas" e "vale nesta" são a mesma
 * configuração, e inferir a primeira daria à segunda um alcance que ninguém declarou.
 */
function documentosExigidosEmTodasAsFases(
  raizes: readonly NoDeExigencia[],
  fases: readonly string[],
): readonly string[] {
  if (fases.length < 2) return [];
  const porTipo = exigenciasIndependentesPorTipo(raizes);
  return [...porTipo]
    .filter(([, declaracoes]) => temMesmaDeclaracaoEmCadaFase(declaracoes, fases))
    .map(([tipo]) => tipo);
}

type DeclaracaoDaExigencia = Pick<NoDeExigencia, 'repetePorEntidade'> & {
  readonly documento: ExigenciaDeDocumento;
};

/** Uma alternativa dentro de um grupo não é uma exigência independente. */
function exigenciasIndependentesPorTipo(raizes: readonly NoDeExigencia[]) {
  const porTipo = new Map<string, DeclaracaoDaExigencia[]>();
  for (const { tipo, documento, repetePorEntidade } of raizes) {
    if (tipo !== 'FOLHA' || documento === null) continue;
    const declaracao = { documento, repetePorEntidade };
    const anteriores = porTipo.get(documento.tipoDocumentoId);
    if (anteriores === undefined) porTipo.set(documento.tipoDocumentoId, [declaracao]);
    else anteriores.push(declaracao);
  }
  return porTipo;
}

/** A declaração precisa aparecer uma única vez em cada fase e ter o mesmo conteúdo. */
function temMesmaDeclaracaoEmCadaFase(
  exigencias: readonly DeclaracaoDaExigencia[],
  fases: readonly string[],
): boolean {
  const porFase = fases.map((fase) =>
    exigencias.filter(({ documento }) => documento.faseCodigo === fase),
  );
  if (!porFase.every((declaracoes) => declaracoes.length === 1)) return false;
  const referencia = conteudoDaExigenciaParaComparacao(porFase[0][0]);
  return porFase.every(
    ([declaracao]) => conteudoDaExigenciaParaComparacao(declaracao) === referencia,
  );
}

function conteudoDaExigenciaParaComparacao({
  documento,
  repetePorEntidade,
}: DeclaracaoDaExigencia): string {
  return `${conteudoDoDocumentoParaComparacao(documento)}|${repetePorEntidade ?? ''}`;
}

/**
 * O que precisa coincidir entre fases para as declarações serem a MESMA coisa dita em cada uma.
 *
 * Fica de fora o que é por definição próprio de cada fase — a fase e a etapa que coleta. O
 * resto é o conteúdo da exigência: se algum deles diverge, são declarações independentes.
 */
function conteudoDoDocumentoParaComparacao(exigencia: ExigenciaDeDocumento): string {
  return JSON.stringify({
    tipoDocumentoId: exigencia.tipoDocumentoId,
    aplicabilidade: exigencia.aplicabilidade,
    obrigatorio: exigencia.obrigatorio,
    consequenciaIndeferimento: exigencia.consequenciaIndeferimento,
    condicoes: exigencia.condicoes,
    basesLegais: exigencia.basesLegais,
    idadeMaximaEmissao: exigencia.idadeMaximaEmissao,
    formatosPermitidos: exigencia.formatosPermitidos,
    tamanhoMaximoBytes: exigencia.tamanhoMaximoBytes,
    // O modelo oferecido é conteúdo: fases com modelos diferentes são declarações independentes.
    modeloId: exigencia.modelo?.modeloId ?? null,
  });
}

function lerExigencias(
  nos: readonly NoExigenciaDto[],
  codigoPorFaseId: ReadonlyMap<string, string>,
): NoDeExigencia[] {
  return nos.map((no) => lerExigencia(no, codigoPorFaseId)).filter((no) => no !== null);
}

/** Descarta documentos sem fase no cronograma e grupos que perderam todas as exigências. */
function lerExigencia(
  no: NoExigenciaDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): NoDeExigencia | null {
  if (no.tipo === 'FOLHA') return lerDocumentoExigido(no, codigoPorFaseId);
  return lerGrupoDeExigencias(no, codigoPorFaseId);
}

function lerDocumentoExigido(
  no: NoExigenciaDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): NoDeExigencia | null {
  const documento = documentoDe(no.documento, codigoPorFaseId);
  if (documento === null) return null;
  return { ...camposDoNo(no), tipo: 'FOLHA', documento, filhos: null };
}

function lerGrupoDeExigencias(
  no: NoExigenciaDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): NoDeExigencia | null {
  const filhos = lerExigencias(no.filhos ?? [], codigoPorFaseId);
  if (filhos.length === 0) return null;
  const tipo = no.tipo as NoDeExigencia['tipo'];
  return { ...camposDoNo(no), tipo, documento: null, filhos };
}

/**
 * Uma lista de normas vazia da API representa ausência de norma própria. Na escrita, enviar
 * uma lista vazia para um nó sem consequência declarada viola o contrato.
 */
function camposDoNo(no: NoExigenciaDto): Omit<NoDeExigencia, 'tipo' | 'documento' | 'filhos'> {
  return {
    quantidadeMinima: no.quantidadeMinima ?? null,
    consequencia: no.consequencia,
    basesLegais: no.basesLegais?.length ? no.basesLegais.map(baseLegalDe) : null,
    chaveDistincao: no.chaveDistincao,
    dataReferencia: no.dataReferencia,
    ocorrenciasEsperadas: no.ocorrenciasEsperadas,
    repetePorEntidade: no.repetePorEntidade,
  };
}

function documentoDe(
  dto: DocumentoExigidoDto | null | undefined,
  codigoPorFaseId: ReadonlyMap<string, string>,
): ExigenciaDeDocumento | null {
  if (dto === null || dto === undefined) return null;
  const faseCodigo = codigoPorFaseId.get(dto.exigidoNaFaseId);
  if (faseCodigo === undefined) return null;
  return documentoNaFase(dto, faseCodigo, codigoPorFaseId);
}

/** A fase foi encontrada no cronograma, então o documento pode ser incluído no rascunho. */
function documentoNaFase(
  dto: DocumentoExigidoDto,
  faseCodigo: string,
  codigoPorFaseId: ReadonlyMap<string, string>,
): ExigenciaDeDocumento {
  return {
    tipoDocumentoId: dto.tipoDocumentoOrigemId,
    tipoDocumentoNome: dto.tipoDocumentoNome,
    faseCodigo,
    etapaId: dto.exigidoNaEtapaId ?? null,
    finalidade: dto.finalidade ?? null,
    ...regraDaExigenciaLida(dto),
    ...criteriosDoComprovanteLidos(dto, codigoPorFaseId),
  };
}

function regraDaExigenciaLida(dto: DocumentoExigidoDto): RegraDaExigenciaDeDocumento {
  return {
    aplicabilidade: dto.aplicabilidade,
    obrigatorio: dto.obrigatorio,
    consequenciaIndeferimento: dto.consequenciaIndeferimento ?? '',
    condicoes: dto.condicoes.map(condicaoDaExigencia),
    basesLegais: dto.basesLegais.map(baseLegalDe),
  };
}

function condicaoDaExigencia({
  clausula,
  fato,
  operador,
  valor,
}: DocumentoExigidoDto['condicoes'][number]) {
  return { clausula: clausula ?? 1, fato, operador, valor };
}

function criteriosDoComprovanteLidos(
  dto: DocumentoExigidoDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): CriteriosDoComprovante {
  return {
    idadeMaximaEmissao: idadeMaximaDe(dto.idadeMaximaEmissao, codigoPorFaseId),
    formatosPermitidos: dto.formatosPermitidos,
    tamanhoMaximoBytes: dto.tamanhoMaximoBytes ?? null,
    modelo: modeloDe(dto.modelo),
  };
}

function idadeMaximaDe(
  idade: DocumentoExigidoDto['idadeMaximaEmissao'],
  codigoPorFaseId: ReadonlyMap<string, string>,
): ExigenciaDeDocumento['idadeMaximaEmissao'] {
  if (idade === null || idade === undefined) return null;
  const faseId = idade.referenciaFaseId;
  return {
    valor: idade.valor ?? null,
    unidade: idade.unidade,
    referenciaTipo: idade.referenciaTipo,
    data: idade.data,
    referenciaFaseCodigo:
      faseId === null || faseId === undefined ? null : (codigoPorFaseId.get(faseId) ?? null),
  };
}

function modeloDe(modelo: DocumentoExigidoDto['modelo']): ExigenciaDeDocumento['modelo'] {
  if (modelo === null || modelo === undefined) return null;
  return {
    modeloId: modelo.modeloId,
    nomeArquivo: modelo.nomeArquivo,
    formato: modelo.formato,
    hashSha256: modelo.hashSha256,
  };
}

/** As quatro colunas da norma, `observacao` inclusive — que antes nunca era lida. */
function baseLegalDe(base: BaseLegalDto): BaseLegalConfig {
  return {
    referencia: base.referencia,
    abrangencia: base.abrangencia,
    status: base.status,
    observacao: base.observacao ?? null,
  };
}
