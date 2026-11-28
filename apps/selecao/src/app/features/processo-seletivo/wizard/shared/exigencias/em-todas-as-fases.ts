import type { ExigenciaDeDocumento, RegraDeComprovacao } from '../../processo-seletivo.models';

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
export function documentosExigidosEmTodasAsFases(
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
    abrePrazoParaReenvio: exigencia.abrePrazoParaReenvio,
    condicoes: exigencia.condicoes,
    basesLegais: exigencia.basesLegais,
    criterios: criteriosParaComparacao(exigencia),
  });
}

function criteriosParaComparacao(exigencia: ExigenciaDeDocumento) {
  return {
    prazoDeEmissao: exigencia.prazoDeEmissao,
    validade: exigencia.validade,
    formatosPermitidos: exigencia.formatosPermitidos,
    tamanhoMaximoBytes: exigencia.tamanhoMaximoBytes,
    modeloId: exigencia.modelo?.modeloId ?? null,
  };
}
