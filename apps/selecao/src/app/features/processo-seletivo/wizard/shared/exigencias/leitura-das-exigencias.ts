import type {
  DocumentoExigidoDto,
  BaseLegalDto,
  RegraDeComprovacaoDto,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import type {
  BaseLegalConfig,
  ExigenciaDeDocumento,
  RegraDaExigenciaDeDocumento,
  CriteriosDoComprovante,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';

import { lerFormatosAceitos } from './formatos-aceitos';
import { criarIdentificadorDaRegra } from './identificador-da-regra';

/**
 * A estrutura de regras de exigências como o rascunho a guarda, lida de `regrasDeComprovacao`.
 *
 * Lê a estrutura de regras, não a lista plana `documentosExigidos`: a lista plana não diz quem é item de
 * qual grupo, e reconstruir tudo como regra de documento solta apagaria o grupo de alternativas e a consequência
 * própria dele na gravação seguinte.
 */
export function exigenciasDe(dto: ProcessoSeletivoDto): ExigenciasDoRascunho {
  const codigoPorFaseId = new Map((dto.cronogramaFases ?? []).map((f) => [f.id, f.codigo]));
  const regrasDeComprovacao = lerExigencias(dto.regrasDeComprovacao ?? [], codigoPorFaseId);
  return {
    regrasDeComprovacao,
    emTodasAsFases: documentosExigidosEmTodasAsFases(regrasDeComprovacao, [
      ...codigoPorFaseId.values(),
    ]),
  };
}

/**
 * Relê, do que voltou do servidor, quais documentos o operador declarou valer em todas as fases.
 *
 * A intenção não trafega: o contrato recebe as regras de documento já materializadas, uma por fase. Sem
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
  regrasDeComprovacao: readonly RegraDeComprovacao[],
  fases: readonly string[],
): readonly string[] {
  if (fases.length < 2) return [];
  const porTipo = exigenciasIndependentesPorTipo(regrasDeComprovacao);
  return [...porTipo]
    .filter(([, declaracoes]) => temMesmaDeclaracaoEmCadaFase(declaracoes, fases))
    .map(([tipo]) => tipo);
}

type DeclaracaoDaExigencia = Pick<RegraDeComprovacao, 'grupoDoFormularioParaRepeticao'> & {
  readonly documento: ExigenciaDeDocumento;
};

/** Uma alternativa dentro de um grupo não é uma exigência independente. */
function exigenciasIndependentesPorTipo(regrasDeComprovacao: readonly RegraDeComprovacao[]) {
  const porTipo = new Map<string, DeclaracaoDaExigencia[]>();
  for (const { forma, documento, grupoDoFormularioParaRepeticao } of regrasDeComprovacao) {
    if (forma !== 'DOCUMENTO' || documento === null) continue;
    const declaracao = { documento, grupoDoFormularioParaRepeticao };
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
  grupoDoFormularioParaRepeticao,
}: DeclaracaoDaExigencia): string {
  return JSON.stringify([
    conteudoDoDocumentoParaComparacao(documento),
    documento.fatosComprovados,
    grupoDoFormularioParaRepeticao,
  ]);
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
  regras: readonly RegraDeComprovacaoDto[],
  codigoPorFaseId: ReadonlyMap<string, string>,
): RegraDeComprovacao[] {
  return regras
    .map((regra) => lerExigencia(regra, codigoPorFaseId))
    .filter((regra) => regra !== null);
}

function lerExigencia(
  regra: RegraDeComprovacaoDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): RegraDeComprovacao | null {
  if (regra.forma.codigo === 'DOCUMENTO') return lerDocumentoExigido(regra, codigoPorFaseId);
  return lerGrupoDeExigencias(regra, codigoPorFaseId);
}

function lerDocumentoExigido(
  regra: RegraDeComprovacaoDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): RegraDeComprovacao | null {
  const documento = documentoDe(regra.documento, codigoPorFaseId);
  if (documento === null) return null;
  return { ...camposDaRegra(regra), forma: 'DOCUMENTO', documento, itens: null };
}

function lerGrupoDeExigencias(
  regra: RegraDeComprovacaoDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): RegraDeComprovacao | null {
  const itensDoGrupo = lerExigencias(regra.itens ?? [], codigoPorFaseId);
  const forma = regra.forma.codigo as RegraDeComprovacao['forma'];
  return { ...camposDaRegra(regra), forma, documento: null, itens: itensDoGrupo };
}

/**
 * Uma lista de normas vazia da API representa ausência de norma própria. Na escrita, enviar
 * uma lista vazia para uma regra sem consequência declarada viola o contrato.
 */
function camposDaRegra(regra: RegraDeComprovacaoDto) {
  const { cardinalidade, indeferimento } = regra;
  return {
    identificadorNoRascunho: criarIdentificadorDaRegra(),
    quantidadeMinima: cardinalidade.quantidadeMinima ?? null,
    consequencia: indeferimento.consequencia,
    basesLegais: indeferimento.basesLegais.length
      ? indeferimento.basesLegais.map(baseLegalDe)
      : null,
    criterioDeDistincao: cardinalidade.distincao?.criterioDeDistincao ?? null,
    dataReferencia: cardinalidade.distincao?.dataReferencia ?? null,
    ocorrenciasEsperadas: cardinalidade.distincao?.ocorrenciasEsperadas ?? null,
    grupoDoFormularioParaRepeticao: regra.grupoDoFormularioParaRepeticao,
  };
}

function documentoDe(
  dto: DocumentoExigidoDto | null | undefined,
  codigoPorFaseId: ReadonlyMap<string, string>,
): ExigenciaDeDocumento | null {
  if (dto === null || dto === undefined) return null;
  return documentoNaFase(dto, codigoPorFaseId);
}

function documentoNaFase(
  dto: DocumentoExigidoDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): ExigenciaDeDocumento {
  return {
    tipoDocumentoId: dto.tipoDocumento.id,
    tipoDocumentoNome: dto.tipoDocumento.nome,
    ...faseDoDocumento(dto.momento.faseId, codigoPorFaseId),
    etapaId: dto.momento.etapaId,
    finalidade: dto.momento.finalidade,
    ...regraDaExigenciaLida(dto),
    ...criteriosDoComprovanteLidos(dto.requisitos, codigoPorFaseId),
  };
}

function faseDoDocumento(faseId: string, codigoPorFaseId: ReadonlyMap<string, string>) {
  const faseCodigo = codigoPorFaseId.get(faseId);
  return { faseCodigo: faseCodigo ?? '', faseIdLido: faseCodigo === undefined ? faseId : null };
}

function regraDaExigenciaLida(
  dto: DocumentoExigidoDto,
): RegraDaExigenciaDeDocumento & Pick<ExigenciaDeDocumento, 'fatosComprovados'> {
  const { aplicabilidade, indeferimento } = dto;
  return {
    fatosComprovados: dto.fatosComprovados,
    aplicabilidade: aplicabilidade.tipo,
    obrigatorio: indeferimento.obrigatorio,
    consequenciaIndeferimento: indeferimento.consequencia ?? '',
    condicoes: aplicabilidade.condicoes.map(condicaoDaExigencia),
    basesLegais: indeferimento.basesLegais.map(baseLegalDe),
  };
}

function condicaoDaExigencia({
  clausula,
  fato,
  operador,
  valor,
}: DocumentoExigidoDto['aplicabilidade']['condicoes'][number]) {
  return { clausula, fato, operador, valor };
}

function criteriosDoComprovanteLidos(
  requisitos: DocumentoExigidoDto['requisitos'],
  codigoPorFaseId: ReadonlyMap<string, string>,
): CriteriosDoComprovante {
  return {
    idadeMaximaEmissao: idadeMaximaDe(requisitos.idadeMaximaEmissao, codigoPorFaseId),
    formatosPermitidos: lerFormatosAceitos(requisitos.formatosPermitidos),
    tamanhoMaximoBytes: requisitos.tamanhoMaximoBytes,
    modelo: modeloDe(requisitos.modelo),
  };
}

function idadeMaximaDe(
  idade: DocumentoExigidoDto['requisitos']['idadeMaximaEmissao'],
  codigoPorFaseId: ReadonlyMap<string, string>,
): ExigenciaDeDocumento['idadeMaximaEmissao'] {
  if (idade === null) return null;
  const faseId = idade.referenciaFaseId;
  return {
    valor: idade.valor,
    unidade: idade.unidade,
    referenciaTipo: idade.referenciaTipo,
    data: idade.data,
    referenciaFaseCodigo: faseId === null ? null : (codigoPorFaseId.get(faseId) ?? null),
    referenciaFaseIdLido: faseId !== null && !codigoPorFaseId.has(faseId) ? faseId : null,
  };
}

function modeloDe(
  modelo: DocumentoExigidoDto['requisitos']['modelo'],
): ExigenciaDeDocumento['modelo'] {
  if (modelo === null) return null;
  return {
    modeloId: modelo.modeloId,
    nomeArquivo: modelo.nomeArquivo,
    formato: modelo.formato,
    hashSha256: modelo.hashSha256,
  };
}

function baseLegalDe(base: BaseLegalDto): BaseLegalConfig {
  return {
    referencia: base.referencia,
    abrangencia: base.abrangencia,
    situacao: base.situacao,
    observacao: base.observacao ?? null,
  };
}
