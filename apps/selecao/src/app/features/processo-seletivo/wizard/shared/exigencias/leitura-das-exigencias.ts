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

import { documentosExigidosEmTodasAsFases } from './em-todas-as-fases';
import { lerPrazoEValidade } from './prazo-e-validade';
import { lerFormatosAceitos } from './formatos-aceitos';
import { criarIdentificadorDaRegra } from './identificador-da-regra';

/** O que a leitura de cada exigência consulta do processo: o código da fase e a chave da etapa, por identificador. */
interface ContextoDaLeitura {
  readonly codigoPorFaseId: ReadonlyMap<string, string>;
  readonly chavePorEtapaId: ReadonlyMap<string, string>;
}

/**
 * A estrutura de regras de exigências como o rascunho a guarda, lida de `regrasDeComprovacao`.
 *
 * Lê a estrutura de regras, não a lista plana `documentosExigidos`: a lista plana não diz quem é item de
 * qual grupo, e reconstruir tudo como regra de documento solta apagaria o grupo de alternativas e a consequência
 * própria dele na gravação seguinte.
 */
export function exigenciasDe(dto: ProcessoSeletivoDto): ExigenciasDoRascunho {
  const codigoPorFaseId = new Map((dto.cronogramaFases ?? []).map((f) => [f.id, f.codigo]));
  const chavePorEtapaId = new Map((dto.etapas ?? []).map((e) => [e.id, e.chave]));
  const regrasDeComprovacao = lerExigencias(dto.regrasDeComprovacao ?? [], {
    codigoPorFaseId,
    chavePorEtapaId,
  });
  return {
    regrasDeComprovacao,
    emTodasAsFases: documentosExigidosEmTodasAsFases(regrasDeComprovacao, [
      ...codigoPorFaseId.values(),
    ]),
  };
}

function lerExigencias(
  regras: readonly RegraDeComprovacaoDto[],
  contexto: ContextoDaLeitura,
): RegraDeComprovacao[] {
  return regras.map((regra) => lerExigencia(regra, contexto)).filter((regra) => regra !== null);
}

function lerExigencia(
  regra: RegraDeComprovacaoDto,
  contexto: ContextoDaLeitura,
): RegraDeComprovacao | null {
  if (regra.forma.codigo === 'DOCUMENTO') return lerDocumentoExigido(regra, contexto);
  return lerGrupoDeExigencias(regra, contexto);
}

function lerDocumentoExigido(
  regra: RegraDeComprovacaoDto,
  contexto: ContextoDaLeitura,
): RegraDeComprovacao | null {
  const documento = documentoDe(regra.documento, contexto);
  if (documento === null) return null;
  return { ...camposDaRegra(regra), forma: 'DOCUMENTO', documento, itens: null };
}

function lerGrupoDeExigencias(
  regra: RegraDeComprovacaoDto,
  contexto: ContextoDaLeitura,
): RegraDeComprovacao | null {
  const itensDoGrupo = lerExigencias(regra.itens ?? [], contexto);
  const forma = regra.forma.codigo;
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
    consequencia: indeferimento.consequenciaDoDescumprimento?.codigo ?? null,
    abrePrazoParaReenvio: indeferimento.abrePrazoParaReenvio,
    basesLegais: indeferimento.basesLegais.length
      ? indeferimento.basesLegais.map(baseLegalDe)
      : null,
    ...distincaoDaRegra(regra),
    grupoDoFormularioParaRepeticao: regra.grupoDoFormularioParaRepeticao,
  };
}

function distincaoDaRegra({ cardinalidade }: RegraDeComprovacaoDto) {
  return {
    criterioDeDistincao: cardinalidade.distincao?.criterioDeDistincao?.codigo ?? null,
    dataReferencia: cardinalidade.distincao?.dataReferencia ?? null,
    ocorrenciasEsperadas: cardinalidade.distincao?.ocorrenciasEsperadas ?? null,
  };
}

function documentoDe(
  dto: DocumentoExigidoDto | null | undefined,
  contexto: ContextoDaLeitura,
): ExigenciaDeDocumento | null {
  if (dto === null || dto === undefined) return null;
  return documentoNaFase(dto, contexto);
}

function documentoNaFase(
  dto: DocumentoExigidoDto,
  contexto: ContextoDaLeitura,
): ExigenciaDeDocumento {
  return {
    ...identidadeDoDocumentoLida(dto),
    ...momentoDoDocumentoLido(dto.momento, contexto),
    ...regraDaExigenciaLida(dto),
    ...criteriosDoComprovanteLidos(dto.requisitos, contexto.codigoPorFaseId),
  };
}

function identidadeDoDocumentoLida({ chave, tipoDocumento }: DocumentoExigidoDto) {
  return {
    chave,
    tipoDocumentoId: tipoDocumento.id,
    tipoDocumentoCodigo: tipoDocumento.codigo,
    tipoDocumentoNome: tipoDocumento.nome,
  };
}

function momentoDoDocumentoLido(
  momento: DocumentoExigidoDto['momento'],
  { codigoPorFaseId, chavePorEtapaId }: ContextoDaLeitura,
) {
  return {
    ...faseDoDocumento(momento.faseId, codigoPorFaseId),
    etapaChave: chaveDaEtapa(momento.etapaId, chavePorEtapaId),
    formularioCodigo: momento.formularioCodigo,
  };
}

function chaveDaEtapa(
  etapaId: string | null,
  chavePorEtapaId: ReadonlyMap<string, string>,
): string | null {
  return etapaId === null ? null : (chavePorEtapaId.get(etapaId) ?? null);
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
    aplicabilidade: aplicabilidade.tipo.codigo,
    obrigatorio: indeferimento.obrigatorio,
    consequenciaIndeferimento: indeferimento.consequenciaDoDescumprimento?.codigo ?? '',
    abrePrazoParaReenvio: indeferimento.abrePrazoParaReenvio,
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
    ...lerPrazoEValidade(requisitos, codigoPorFaseId),
    formatosPermitidos: lerFormatosAceitos(requisitos.formatosPermitidos),
    tamanhoMaximoBytes: requisitos.tamanhoMaximoBytes,
    modelo: modeloDe(requisitos.modelo),
  };
}

function modeloDe(
  modelo: DocumentoExigidoDto['requisitos']['modelo'],
): ExigenciaDeDocumento['modelo'] {
  if (modelo === null) return null;
  return {
    modeloId: modelo.modeloId,
    nomeArquivo: modelo.nomeArquivo,
    formato: modelo.formato.codigo,
    hashSha256: modelo.hashSha256,
  };
}

function baseLegalDe(base: BaseLegalDto): BaseLegalConfig {
  return {
    referencia: base.referencia,
    abrangencia: base.abrangencia.codigo,
    situacao: base.situacao.codigo,
    observacao: base.observacao ?? null,
  };
}
