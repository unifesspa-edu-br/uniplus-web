import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import { referenciaQueVale, type RegraEscolhida } from '../regra-escolhida';
import { escalaQueVale, inteiroQueVale, textoQueVale } from '../valor-que-vale';
import { comCampo, comCodigo, naSecao } from './secao-do-documento';

/**
 * As edições da fórmula mexem só nos campos dela. A eliminação e o desempate moram na mesma
 * seção e voltam como estavam.
 */
export function definirRegraDeCalculo(
  documento: DocumentoDaConfiguracao,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (classificacao) =>
    comCampo(classificacao, 'regraCalculo', referenciaQueVale(classificacao.regraCalculo, regra)),
  );
}

export function definirRegraDeArredondamento(
  documento: DocumentoDaConfiguracao,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (classificacao) =>
    comCampo(
      classificacao,
      'regraArredondamento',
      referenciaQueVale(classificacao.regraArredondamento, regra),
    ),
  );
}

export function definirCasasDeArredondamento(
  documento: DocumentoDaConfiguracao,
  texto: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (classificacao) =>
    comCampo(
      classificacao,
      'casasArredondamento',
      inteiroQueVale(classificacao.casasArredondamento, texto),
    ),
  );
}

/** A escala só entra quando o texto é um número que a API aceita; senão a escala sai. */
export function definirEscalaDaNotaFinal(
  documento: DocumentoDaConfiguracao,
  texto: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (classificacao) =>
    comCampo(classificacao, 'escalaNotaFinal', escalaQueVale(classificacao.escalaNotaFinal, texto)),
  );
}

export function definirRegraDeOrdemDeAlocacao(
  documento: DocumentoDaConfiguracao,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (classificacao) =>
    comCampo(
      classificacao,
      'regraOrdemAlocacao',
      referenciaQueVale(classificacao.regraOrdemAlocacao, regra),
    ),
  );
}

/** `null` é "ainda não declarado": a chave sai, e declarar que não é baseada em ENEM é `false`. */
export function definirBaseadoEmEnem(
  documento: DocumentoDaConfiguracao,
  baseadoEmEnem: boolean | null,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (classificacao) =>
    comCampo(classificacao, 'baseadoEmEnem', baseadoEmEnem ?? undefined),
  );
}

/**
 * O quadro de pesos é a cópia que a API fez da resolução: ele acompanha o código. Trocar ou limpar
 * a resolução descarta o quadro, e repetir a mesma resolução o mantém.
 */
export function definirResolucaoDoPesoPorArea(
  documento: DocumentoDaConfiguracao,
  resolucao: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (classificacao) =>
    comCodigo(
      classificacao,
      'resolucaoPesoAreaEnem',
      textoQueVale(classificacao.resolucaoPesoAreaEnem, resolucao),
      ['quadroPesoAreaEnem'],
    ),
  );
}
