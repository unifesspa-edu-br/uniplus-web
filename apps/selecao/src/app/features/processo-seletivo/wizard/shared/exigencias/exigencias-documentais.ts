import {
  ABRANGENCIAS_ESCOLHIVEIS,
  ABRANGENCIA_PADRAO,
  baseLegalNova,
  CONSEQUENCIAS_ESCOLHIVEIS as CONSEQUENCIAS_DO_DOCUMENTO,
  CONSEQUENCIA_REENVIO,
  SITUACAO_BASE_LEGAL_ESCOLHIVEIS,
  SITUACAO_BASE_LEGAL_RESOLVIDO,
  temNormaResolvida,
} from '@uniplus/shared-utils';

import type {
  ExigenciaDeDocumento,
  RegraDaExigenciaDeDocumento,
  CriteriosDoComprovante,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';

import { transformar } from './composicao-das-regras';

export { semAFase, semAEtapa } from './composicao-das-regras';

import { limitesDoArquivo, type RestricaoDeArquivo } from './arquivo-da-exigencia';

/**
 * Tradução entre o rascunho do wizard e a estrutura de regras de exigências documentais do contrato
 * (`PUT …/documentos-exigidos`, `ProcessoSeletivoDto.regrasDeComprovacao`).
 *
 * O rascunho guarda a MESMA estrutura de regras que o contrato, menos as referências que não sobrevivem a
 * uma gravação de cronograma — fase por código em vez de id, aqui e na idade máxima. O resto
 * é cópia campo a campo, e é isso que faz o que a tela não edita sobreviver: o `PUT`
 * substitui a estrutura de regras inteira, e o que o wizard sintetizasse do zero apagaria grupo de alternativas,
 * cardinalidade qualificada e repetição por entidade a cada salvamento.
 *
 * A hidratação lê `regrasDeComprovacao`, a estrutura de regras, e não `documentosExigidos`, a lista plana:
 * a lista plana não diz quem é item de qual grupo.
 */

/** Aplicabilidade e gatilho, no vocabulário do wire. */
export const APLICABILIDADE_GERAL = 'GERAL';
export const APLICABILIDADE_CONDICIONAL = 'CONDICIONAL';
export const FATO_MODALIDADE = 'MODALIDADE';

/**
 * Uma exigência recém-declarada, antes de o operador dizer qualquer coisa sobre ela. Nasce
 * obrigatória porque é o caso comum — documento pedido no edital é documento que decide a
 * análise —, e é por isso que a tela pede a base legal em seguida.
 *
 * A restrição de arquivo vem do cadastro do tipo de documento, que é onde o CEPS a declara —
 * ter uma segunda fonte no wizard seria pior que não ter nenhuma.
 */
export function exigenciaNova(
  tipoDocumentoId: string,
  faseCodigo: string,
  restricao?: RestricaoDeArquivo,
): ExigenciaDeDocumento {
  return {
    tipoDocumentoId,
    faseCodigo,
    etapaId: null,
    finalidade: null,
    ...regraInicialDaExigencia(),
    ...criteriosIniciaisDoComprovante(restricao),
  };
}

function regraInicialDaExigencia(): RegraDaExigenciaDeDocumento {
  return {
    aplicabilidade: APLICABILIDADE_GERAL,
    obrigatorio: true,
    consequenciaIndeferimento: '',
    condicoes: [],
    basesLegais: [baseLegalNova()],
  };
}

function criteriosIniciaisDoComprovante(restricao?: RestricaoDeArquivo): CriteriosDoComprovante {
  return {
    idadeMaximaEmissao: null,
    ...limitesDoArquivo(restricao),
    modelo: null,
  };
}

/**
 * Acrescenta a exigência como declaração de regra principal, sem tocar no resto da estrutura de regras.
 *
 * É a operação que o alcance por todas as fases precisa, e que `comExigencia` não faz: aquela
 * substitui a PRIMEIRA regra de documento que casa por (documento, fase), e essa primeira pode ser a
 * alternativa dentro de um grupo de alternativas — sobrescrevê-la transformaria "este documento serve" em
 * "este documento é exigido", que é outra coisa.
 */
export function comExigenciaSemGrupo(
  exigencias: ExigenciasDoRascunho,
  documento: ExigenciaDeDocumento,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: [...exigencias.regrasDeComprovacao, regraDeDocumento(documento)],
  };
}

/** A regra de documento do rascunho que envolve uma exigência. */
export function regraDeDocumento(documento: ExigenciaDeDocumento): RegraDeComprovacao {
  return {
    forma: 'DOCUMENTO',
    documento,
    quantidadeMinima: null,
    consequencia: null,
    basesLegais: null,
    itens: null,
    criterioDeDistincao: null,
    dataReferencia: null,
    ocorrenciasEsperadas: null,
    grupoDoFormularioParaRepeticao: null,
  };
}

/** O rascunho sem exigência nenhuma. */
export function exigenciasVazias(): ExigenciasDoRascunho {
  return { regrasDeComprovacao: [], emTodasAsFases: [] };
}

/**
 * O vocabulário e as regras puras da base legal são os mesmos do modelo de formulário, definidos
 * em `@uniplus/shared-utils` e reexportados daqui para que o módulo tenha um só lugar de onde
 * importar. A norma recém-declarada nasce no caso comum: o edital, resolvida.
 */
export {
  ABRANGENCIAS_ESCOLHIVEIS,
  ABRANGENCIA_PADRAO,
  baseLegalNova,
  CONSEQUENCIA_REENVIO,
  SITUACAO_BASE_LEGAL_ESCOLHIVEIS,
  SITUACAO_BASE_LEGAL_RESOLVIDO,
  temNormaResolvida,
};

/**
 * Se a exigência decide sozinha o resultado de quem não a cumpre: é obrigatória ou declara
 * consequência para a falta. É a exigência que a publicação só aceita com norma resolvida.
 */
export function exigenciaDecideResultado(
  exigencia: Pick<RegraDaExigenciaDeDocumento, 'obrigatorio' | 'consequenciaIndeferimento'>,
): boolean {
  return exigencia.obrigatorio || exigencia.consequenciaIndeferimento !== '';
}

/**
 * Se a publicação recusaria a exigência por falta de norma: ela decide o resultado e nenhuma das
 * normas está resolvida. É a única definição da regra; a tela da fase e a revisão a usam.
 */
export function exigenciaSemNormaResolvida(
  exigencia: Pick<
    RegraDaExigenciaDeDocumento,
    'obrigatorio' | 'consequenciaIndeferimento' | 'basesLegais'
  >,
): boolean {
  return exigenciaDecideResultado(exigencia) && !temNormaResolvida(exigencia.basesLegais);
}

/**
 * O que acontece com quem não entrega o documento, ou tem a entrega indeferida. Vazio é
 * escolha legítima: a exigência que não decide sozinha não precisa declarar consequência.
 */
export const CONSEQUENCIAS_ESCOLHIVEIS = [
  { valor: '', rotulo: 'Não decide sozinha' },
  ...CONSEQUENCIAS_DO_DOCUMENTO,
] as const;

/**
 * Substitui a exigência de (documento, fase) pelo resultado da edição, ou a acrescenta como
 * regra de documento na regra principal quando ainda não existe.
 *
 * A regra de documento nova entra na regra principal, nunca dentro de um grupo existente: um grupo de alternativas declara
 * alternativas entre si e todas as suas regras de documento pertencem à mesma fase — acrescentar ali
 * mudaria o sentido do grupo sem o operador ter pedido.
 */
export function comExigencia(
  exigencias: ExigenciasDoRascunho,
  documento: ExigenciaDeDocumento,
): ExigenciasDoRascunho {
  const { regrasDeComprovacao, alterou } = transformarPrimeiraExigencia(
    exigencias.regrasDeComprovacao,
    pertenceAFaseETipoDeDocumento(documento.faseCodigo, documento.tipoDocumentoId),
    () => documento,
  );
  const regras = alterou
    ? regrasDeComprovacao
    : [...regrasDeComprovacao, regraDeDocumento(documento)];
  return { ...exigencias, regrasDeComprovacao: regras };
}

function pertenceAFaseETipoDeDocumento(faseCodigo: string, tipoDocumentoId: string) {
  return (documento: ExigenciaDeDocumento | null) =>
    documento?.faseCodigo === faseCodigo && documento.tipoDocumentoId === tipoDocumentoId;
}

/** Uma exigência independente e uma alternativa de grupo podem pedir o mesmo documento. */
function transformarPrimeiraExigencia(
  regras: readonly RegraDeComprovacao[],
  corresponde: (documento: ExigenciaDeDocumento) => boolean,
  alteracao: (documento: ExigenciaDeDocumento) => ExigenciaDeDocumento | null,
) {
  let alterou = false;
  const regrasDeComprovacao = transformar(regras, (documento) => {
    if (alterou || !corresponde(documento)) return documento;
    alterou = true;
    return alteracao(documento);
  });
  return { regrasDeComprovacao, alterou };
}

/**
 * Declara pelas ocorrências de que grupo repetível a exigência de (documento, fase) se repete, ou
 * `null` para uma por candidato. Escreve na regra de documento, a primeira que casa, pela mesma razão de
 * `comExigencia`; a repetição herdada de um grupo de alternativas é do grupo, que a tela não edita.
 */
export function comRepeticao(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  faseCodigo: string,
  grupo: string | null,
): ExigenciasDoRascunho {
  const corresponde = pertenceAFaseETipoDeDocumento(faseCodigo, tipoDocumentoId);
  const regras = definirRepeticaoDaPrimeiraExigencia(
    exigencias.regrasDeComprovacao,
    corresponde,
    grupo,
  );
  return { ...exigencias, regrasDeComprovacao: regras };
}

/** Atualiza a repetição sem remover exigências nem mudar a quantidade mínima dos grupos. */
function definirRepeticaoDaPrimeiraExigencia(
  regras: readonly RegraDeComprovacao[],
  corresponde: (documento: ExigenciaDeDocumento | null) => boolean,
  grupo: string | null,
): readonly RegraDeComprovacao[] {
  let alterou = false;
  const editar = (regra: RegraDeComprovacao): RegraDeComprovacao => {
    if (alterou) return regra;
    if (regra.forma !== 'DOCUMENTO') return { ...regra, itens: (regra.itens ?? []).map(editar) };
    if (!corresponde(regra.documento)) return regra;
    alterou = true;
    return { ...regra, grupoDoFormularioParaRepeticao: grupo };
  };
  return regras.map(editar);
}

/**
 * Declara a repetição em todas as declarações de regra principal do documento: o que vale em todas as fases é
 * a mesma declaração em cada uma, e a fase ainda não materializada a recebe do modelo de regra principal.
 */
export function comRepeticaoEmTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  grupo: string | null,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: exigencias.regrasDeComprovacao.map((regra) =>
      regra.forma === 'DOCUMENTO' && regra.documento?.tipoDocumentoId === tipoDocumentoId
        ? { ...regra, grupoDoFormularioParaRepeticao: grupo }
        : regra,
    ),
  };
}

/** Remove a exigência de (documento, fase), colapsando o grupo que ficar vazio. */
export function semAExigencia(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  faseCodigo: string,
): ExigenciasDoRascunho {
  const { regrasDeComprovacao } = transformarPrimeiraExigencia(
    exigencias.regrasDeComprovacao,
    pertenceAFaseETipoDeDocumento(faseCodigo, tipoDocumentoId),
    () => null,
  );
  return { ...exigencias, regrasDeComprovacao };
}
