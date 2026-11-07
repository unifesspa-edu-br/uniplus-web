import type {
  DocumentoExigidoDto,
  BaseLegalDto,
  NoExigenciaDto,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import type {
  BaseLegalConfig,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../../processo-seletivo.models';

import { exigenciasDaRaiz } from './consulta-das-exigencias';

/**
 * A árvore de exigências como o rascunho a guarda, lida de `raizesExigencia`.
 *
 * Lê a ÁRVORE, não a lista plana `documentosExigidos`: a lista plana não diz quem é filho de
 * qual grupo, e reconstruir tudo como folha solta apagaria o grupo `OU` e a consequência
 * própria dele na gravação seguinte.
 */
export function exigenciasDe(dto: ProcessoSeletivoDto): ExigenciasDoRascunho {
  const codigoPorFaseId = new Map((dto.cronogramaFases ?? []).map((f) => [f.id, f.codigo]));
  const raizes = (dto.raizesExigencia ?? [])
    .map((no) => noDe(no, codigoPorFaseId))
    .filter((no): no is NoDeExigencia => no !== null);

  const fases = [...codigoPorFaseId.values()];
  return {
    raizes,
    emTodasAsFases: alcanceDeTodasAsFasesReconstruido({ raizes, emTodasAsFases: [] }, fases),
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
function alcanceDeTodasAsFasesReconstruido(
  exigencias: ExigenciasDoRascunho,
  fases: readonly string[],
): readonly string[] {
  if (fases.length < 2) return [];

  const candidatos = new Set(exigenciasDaRaiz(exigencias).map((e) => e.tipoDocumentoId));

  // Só declarações de RAIZ, pela mesma razão que a materialização: a folha dentro de um grupo
  // OU é alternativa, não exigência. Contá-la como presença fazia o documento que é exigido
  // numa fase e apenas alternativo noutra ser lido como global — e a gravação seguinte
  // materializaria exigências novas, transformando a alternativa em documento cobrado.
  const daRaiz = exigencias.raizes.filter(
    (no): no is NoDeExigencia & { readonly documento: ExigenciaDeDocumento } =>
      no.tipo === 'FOLHA' && no.documento !== null,
  );

  return [...candidatos].filter((tipoDocumentoId) => {
    const porFase = fases.map((faseCodigo) =>
      daRaiz.filter(
        (no) =>
          no.documento.tipoDocumentoId === tipoDocumentoId &&
          no.documento.faseCodigo === faseCodigo,
      ),
    );

    // Uma declaração por fase, em todas elas — duas na mesma fase já são configuração que o
    // alcance global não sabe reproduzir.
    if (!porFase.every((declaracoes) => declaracoes.length === 1)) return false;

    // A repetição é da folha, não do documento, e entra na comparação: "um por membro" numa fase e
    // "um por candidato" noutra são declarações diferentes, que a materialização igualaria.
    const assinatura = (no: NoDeExigencia & { readonly documento: ExigenciaDeDocumento }): string =>
      `${assinaturaDaDeclaracao(no.documento)}|${no.repetePorEntidade ?? ''}`;
    const referencia = assinatura(porFase[0][0]);
    return porFase.every(([declaracao]) => assinatura(declaracao) === referencia);
  });
}

/**
 * O que precisa coincidir entre fases para as declarações serem a MESMA coisa dita em cada uma.
 *
 * Fica de fora o que é por definição próprio de cada fase — a fase e a etapa que coleta. O
 * resto é o conteúdo da exigência: se algum deles diverge, são declarações independentes.
 */
function assinaturaDaDeclaracao(exigencia: ExigenciaDeDocumento): string {
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

function noDe(
  no: NoExigenciaDto,
  codigoPorFaseId: ReadonlyMap<string, string>,
): NoDeExigencia | null {
  const tipo = no.tipo as NoDeExigencia['tipo'];

  if (tipo === 'FOLHA') {
    const documento = documentoDe(no.documento, codigoPorFaseId);
    // Exigência cuja fase não está no cronograma lido: não há código estável a guardar, e
    // inventar um faria a gravação seguinte pedir uma fase que o processo não tem.
    if (documento === null) return null;
    return { ...camposDoNo(no), tipo, documento, filhos: null };
  }

  const filhos = (no.filhos ?? [])
    .map((filho: NoExigenciaDto) => noDe(filho, codigoPorFaseId))
    .filter((filho): filho is NoDeExigencia => filho !== null);
  if (filhos.length === 0) return null;

  return { ...camposDoNo(no), tipo, documento: null, filhos };
}

function camposDoNo(no: NoExigenciaDto): Omit<NoDeExigencia, 'tipo' | 'documento' | 'filhos'> {
  return {
    quantidadeMinima: no.quantidadeMinima ?? null,
    consequencia: no.consequencia,
    // A leitura devolve lista vazia para o nó que não tem norma própria; a escrita distingue
    // "sem norma" de "lista vazia" — o contrato só aceita a coleção quando há consequência
    // declarada, e mandar `[]` onde nunca houve nada seria declarar o que ninguém declarou.
    basesLegais:
      no.basesLegais === null || no.basesLegais === undefined || no.basesLegais.length === 0
        ? null
        : no.basesLegais.map(baseLegalDe),
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

  return {
    // O DTO de leitura nomeia o tipo como `origemId`; a escrita o recebe como
    // `tipoDocumentoId`. É a única renomeação entre os dois lados.
    tipoDocumentoId: dto.tipoDocumentoOrigemId,
    tipoDocumentoNome: dto.tipoDocumentoNome,
    faseCodigo,
    etapaId: dto.exigidoNaEtapaId ?? null,
    finalidade: dto.finalidade ?? null,
    aplicabilidade: dto.aplicabilidade,
    obrigatorio: dto.obrigatorio,
    consequenciaIndeferimento: dto.consequenciaIndeferimento ?? '',
    condicoes: dto.condicoes.map((condicao) => ({
      clausula: condicao.clausula ?? 1,
      fato: condicao.fato,
      operador: condicao.operador,
      valor: condicao.valor,
    })),
    basesLegais: dto.basesLegais.map(baseLegalDe),
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
    observacao: base.observacao ?? '',
  };
}
