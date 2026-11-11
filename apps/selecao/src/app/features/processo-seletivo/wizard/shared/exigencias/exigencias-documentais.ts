import {
  ABRANGENCIAS_ESCOLHIVEIS,
  ABRANGENCIA_PADRAO,
  baseLegalNova,
  CONSEQUENCIAS_ESCOLHIVEIS as CONSEQUENCIAS_DO_DOCUMENTO,
  CONSEQUENCIA_REENVIO,
  STATUS_BASE_LEGAL_ESCOLHIVEIS,
  STATUS_BASE_LEGAL_RESOLVIDO,
  temNormaResolvida,
} from '@uniplus/shared-utils';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../../processo-seletivo.models';

import { limitesDoArquivo, type RestricaoDeArquivo } from './arquivo-da-exigencia';

/**
 * Tradução entre o rascunho do wizard e a árvore de exigências documentais do contrato
 * (`PUT …/documentos-exigidos`, `ProcessoSeletivoDto.raizesExigencia`).
 *
 * O rascunho guarda a MESMA árvore que o contrato, menos as referências que não sobrevivem a
 * uma gravação de cronograma — fase por código em vez de id, aqui e na idade máxima. O resto
 * é cópia campo a campo, e é isso que faz o que a tela não edita sobreviver: o `PUT`
 * substitui a árvore inteira, e o que o wizard sintetizasse do zero apagaria grupo `OU`,
 * cardinalidade qualificada e repetição por entidade a cada salvamento.
 *
 * A hidratação lê `raizesExigencia`, a árvore, e não `documentosExigidos`, a lista plana:
 * a lista plana não diz quem é filho de qual grupo.
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
    // Sem declaração, vale o formulário efetivo: o único que a fase responde, ou a escolha que a
    // fase dividida entre inscrição e isenção pede ao operador.
    finalidade: null,
    aplicabilidade: APLICABILIDADE_GERAL,
    obrigatorio: true,
    consequenciaIndeferimento: '',
    condicoes: [],
    basesLegais: [baseLegalNova()],
    idadeMaximaEmissao: null,
    ...limitesDoArquivo(restricao),
    modelo: null,
  };
}

/**
 * Acrescenta a exigência como declaração de RAIZ, sem tocar no resto da árvore.
 *
 * É a operação que o alcance por todas as fases precisa, e que `comExigencia` não faz: aquela
 * substitui a PRIMEIRA folha que casa por (documento, fase), e essa primeira pode ser a
 * alternativa dentro de um grupo OU — sobrescrevê-la transformaria "este documento serve" em
 * "este documento é exigido", que é outra coisa.
 */
export function comExigenciaNaRaiz(
  exigencias: ExigenciasDoRascunho,
  documento: ExigenciaDeDocumento,
): ExigenciasDoRascunho {
  return { ...exigencias, raizes: [...exigencias.raizes, folhaDe(documento)] };
}

/** A folha do rascunho que envolve uma exigência. */
export function folhaDe(documento: ExigenciaDeDocumento): NoDeExigencia {
  return {
    tipo: 'FOLHA',
    documento,
    quantidadeMinima: null,
    consequencia: null,
    basesLegais: null,
    filhos: null,
    chaveDistincao: null,
    dataReferencia: null,
    ocorrenciasEsperadas: null,
    repetePorEntidade: null,
  };
}

/** O rascunho sem exigência nenhuma. */
export function exigenciasVazias(): ExigenciasDoRascunho {
  return { raizes: [], emTodasAsFases: [] };
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
  STATUS_BASE_LEGAL_ESCOLHIVEIS,
  STATUS_BASE_LEGAL_RESOLVIDO,
  temNormaResolvida,
};

/**
 * Se a exigência decide sozinha o resultado de quem não a cumpre: é obrigatória ou declara
 * consequência para a falta. É a exigência que a publicação só aceita com norma resolvida.
 */
export function exigenciaDecideResultado(
  exigencia: Pick<ExigenciaDeDocumento, 'obrigatorio' | 'consequenciaIndeferimento'>,
): boolean {
  return exigencia.obrigatorio || exigencia.consequenciaIndeferimento !== '';
}

/**
 * Se a publicação recusaria a exigência por falta de norma: ela decide o resultado e nenhuma das
 * normas está resolvida. É a única definição da regra; a tela da fase e a revisão a usam.
 */
export function exigenciaSemNormaResolvida(
  exigencia: Pick<
    ExigenciaDeDocumento,
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
 * Percorre a árvore aplicando uma transformação a cada folha; folha que a transformação
 * descarta sai, e grupo que fica sem filho nenhum sai junto, em cascata.
 *
 * O colapso em cascata é o mesmo que a raiz faz no servidor ao remover uma fase: grupo sem
 * alternativa não exige nada, e mandá-lo vazio faria o `PUT` recusar a árvore inteira.
 */
export function transformar(
  nos: readonly NoDeExigencia[],
  transformacao: (documento: ExigenciaDeDocumento) => ExigenciaDeDocumento | null,
): readonly NoDeExigencia[] {
  const vivos: NoDeExigencia[] = [];

  for (const no of nos) {
    if (no.tipo === 'FOLHA') {
      const documento = no.documento === null ? null : transformacao(no.documento);
      if (documento !== null) vivos.push({ ...no, documento });
      continue;
    }

    const filhos = transformar(no.filhos ?? [], transformacao);
    if (filhos.length === 0) continue;
    vivos.push({
      ...no,
      filhos,
      quantidadeMinima: coubeNoGrupo(no.quantidadeMinima, filhos.length),
    });
  }

  return vivos;
}

/**
 * A quantidade mínima que ainda cabe no grupo depois da poda.
 *
 * Um grupo que pedia duas alternativas e ficou com uma só continuaria pedindo duas: o agregado
 * recusa, e a recusa chega depois de as etapas, o cronograma e o formulário já terem sido
 * gravados — falando de um campo que esta tela não mostra. Reduzir preserva a intenção
 * possível: continuar pedindo o máximo que o grupo ainda oferece.
 */
function coubeNoGrupo(quantidadeMinima: number | null, filhos: number): number | null {
  if (quantidadeMinima === null) return null;
  return Math.min(quantidadeMinima, filhos);
}

/**
 * As exigências sem a fase removida do cronograma. A exigência que valia só ali deixa de
 * existir; o mesmo documento em outra fase continua, porque são exigências distintas.
 *
 * A idade máxima que ancorava nessa fase perde a âncora em vez de apontar para fase que saiu
 * — a recusa do servidor falaria de um campo que a tela não mostra.
 */
export function semAFase(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): ExigenciasDoRascunho {
  const raizes = transformar(exigencias.raizes, (documento) => {
    if (documento.faseCodigo === faseCodigo) return null;
    if (documento.idadeMaximaEmissao?.referenciaFaseCodigo !== faseCodigo) return documento;
    return {
      ...documento,
      idadeMaximaEmissao: { ...documento.idadeMaximaEmissao, referenciaFaseCodigo: null },
    };
  });

  // A marca de alcance global cai junto com a última declaração de raiz que lhe servia de
  // modelo. Sem isso ela fica órfã: a tela segue anunciando o documento como exigido, a
  // materialização não tem de onde copiá-lo, e a gravação sai sem a exigência — sem nada
  // dizendo que ela deixou de existir.
  const comModelo = new Set(
    raizes
      .filter((no) => no.tipo === 'FOLHA' && no.documento !== null)
      .map((no) => (no.documento as ExigenciaDeDocumento).tipoDocumentoId),
  );

  return {
    raizes,
    emTodasAsFases: exigencias.emTodasAsFases.filter((tipo) => comModelo.has(tipo)),
  };
}

/**
 * As exigências sem a etapa removida: quem a apontava como ponto de coleta volta a ser da
 * fase inteira, em vez de reenviar o identificador de uma etapa que não existe mais.
 */
export function semAEtapa(exigencias: ExigenciasDoRascunho, etapaId: string): ExigenciasDoRascunho {
  return {
    ...exigencias,
    raizes: transformar(exigencias.raizes, (documento) =>
      documento.etapaId === etapaId ? { ...documento, etapaId: null } : documento,
    ),
  };
}

/**
 * Substitui a exigência de (documento, fase) pelo resultado da edição, ou a acrescenta como
 * folha na raiz quando ainda não existe.
 *
 * A folha nova entra na raiz, nunca dentro de um grupo existente: um grupo `OU` declara
 * alternativas entre si e todas as suas folhas pertencem à mesma fase — acrescentar ali
 * mudaria o sentido do grupo sem o operador ter pedido.
 */
export function comExigencia(
  exigencias: ExigenciasDoRascunho,
  documento: ExigenciaDeDocumento,
): ExigenciasDoRascunho {
  // Só a PRIMEIRA folha que casa é trocada. O mesmo documento pode aparecer duas vezes na
  // mesma fase — uma solta e outra como alternativa de um grupo `OU` —, e o contrato não
  // proíbe isso; escrever nas duas de uma vez sobrescreveria a alternativa do grupo com a
  // edição feita na outra, sem nada na tela dizendo que havia duas.
  let trocou = false;
  const raizes = transformar(exigencias.raizes, (atual) => {
    if (trocou) return atual;
    if (atual.tipoDocumentoId !== documento.tipoDocumentoId) return atual;
    if (atual.faseCodigo !== documento.faseCodigo) return atual;
    trocou = true;
    return documento;
  });

  return {
    ...exigencias,
    raizes: trocou ? raizes : [...raizes, folhaDe(documento)],
  };
}

/**
 * Declara pelas ocorrências de que grupo repetível a exigência de (documento, fase) se repete, ou
 * `null` para uma por candidato. Escreve na folha, a primeira que casa, pela mesma razão de
 * `comExigencia`; a repetição herdada de um grupo de alternativas é do grupo, que a tela não edita.
 */
export function comRepeticao(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  faseCodigo: string,
  grupo: string | null,
): ExigenciasDoRascunho {
  let trocou = false;
  const naArvore = (nos: readonly NoDeExigencia[]): readonly NoDeExigencia[] =>
    nos.map((no) => {
      if (trocou) return no;
      if (no.tipo !== 'FOLHA') return { ...no, filhos: naArvore(no.filhos ?? []) };
      if (
        no.documento?.tipoDocumentoId !== tipoDocumentoId ||
        no.documento.faseCodigo !== faseCodigo
      )
        return no;
      trocou = true;
      return { ...no, repetePorEntidade: grupo };
    });

  return { ...exigencias, raizes: naArvore(exigencias.raizes) };
}

/**
 * Declara a repetição em todas as declarações de raiz do documento: o que vale em todas as fases é
 * a mesma declaração em cada uma, e a fase ainda não materializada a recebe do modelo de raiz.
 */
export function comRepeticaoEmTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  grupo: string | null,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    raizes: exigencias.raizes.map((no) =>
      no.tipo === 'FOLHA' && no.documento?.tipoDocumentoId === tipoDocumentoId
        ? { ...no, repetePorEntidade: grupo }
        : no,
    ),
  };
}

/** Remove a exigência de (documento, fase), colapsando o grupo que ficar vazio. */
export function semAExigencia(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  faseCodigo: string,
): ExigenciasDoRascunho {
  // Remove só a PRIMEIRA que casa, pela mesma razão de `comExigencia`: desmarcar o documento
  // não pode levar junto a alternativa homônima de um grupo, que é outra declaração.
  let removeu = false;
  return {
    ...exigencias,
    raizes: transformar(exigencias.raizes, (documento) => {
      if (removeu) return documento;
      if (documento.tipoDocumentoId !== tipoDocumentoId) return documento;
      if (documento.faseCodigo !== faseCodigo) return documento;
      removeu = true;
      return null;
    }),
  };
}
