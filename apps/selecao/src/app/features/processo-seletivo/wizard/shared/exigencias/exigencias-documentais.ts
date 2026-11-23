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

import { criarIdentificadorDaRegra } from './identificador-da-regra';

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
    prazoDeEmissao: null,
    validade: null,
    ...limitesDoArquivo(restricao),
    modelo: null,
  };
}

/**
 * Acrescenta a exigência como declaração de regra principal, sem tocar no resto da estrutura de regras.
 *
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
    identificadorNoRascunho: criarIdentificadorDaRegra(),
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

/** Atualiza a declaração identificada no rascunho. */
export function comExigencia(
  exigencias: ExigenciasDoRascunho,
  identificadorNoRascunho: string,
  documento: ExigenciaDeDocumento,
): ExigenciasDoRascunho {
  return comRegraAlterada(exigencias, identificadorNoRascunho, (regra) => ({
    ...regra,
    documento,
  }));
}

/** Define a repetição da declaração identificada no rascunho. */
export function comRepeticao(
  exigencias: ExigenciasDoRascunho,
  identificadorNoRascunho: string,
  grupo: string | null,
): ExigenciasDoRascunho {
  return comRegraAlterada(exigencias, identificadorNoRascunho, (regra) => ({
    ...regra,
    grupoDoFormularioParaRepeticao: grupo,
  }));
}

function comRegraAlterada(
  exigencias: ExigenciasDoRascunho,
  identificador: string,
  alteracao: (regra: RegraDeComprovacao) => RegraDeComprovacao,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: alterarRegra(exigencias.regrasDeComprovacao, identificador, alteracao),
  };
}

function alterarRegra(
  regras: readonly RegraDeComprovacao[],
  identificador: string,
  alteracao: (regra: RegraDeComprovacao) => RegraDeComprovacao,
): readonly RegraDeComprovacao[] {
  return regras.map((regra) => {
    if (regra.identificadorNoRascunho === identificador) return alteracao(regra);
    if (regra.forma === 'DOCUMENTO') return regra;
    return { ...regra, itens: alterarRegra(regra.itens ?? [], identificador, alteracao) };
  });
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

/** Remove a declaração identificada e os grupos que ficarem vazios. */
export function semAExigencia(
  exigencias: ExigenciasDoRascunho,
  identificadorNoRascunho: string,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: removerRegra(exigencias.regrasDeComprovacao, identificadorNoRascunho),
  };
}

function removerRegra(
  regras: readonly RegraDeComprovacao[],
  identificador: string,
): readonly RegraDeComprovacao[] {
  return regras.flatMap((regra) => {
    if (regra.identificadorNoRascunho === identificador) return [];
    if (regra.forma === 'DOCUMENTO') return [regra];
    const itens = removerRegra(regra.itens ?? [], identificador);
    if (itens.length === 0) return [];
    const quantidadeMinima =
      regra.quantidadeMinima === null ? null : Math.min(regra.quantidadeMinima, itens.length);
    return [{ ...regra, itens, quantidadeMinima }];
  });
}
