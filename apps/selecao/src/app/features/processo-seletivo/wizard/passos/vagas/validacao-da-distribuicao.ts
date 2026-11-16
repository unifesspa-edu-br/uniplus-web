import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { repetidos } from '../../shared/repetidos';
import { decimalDoCampo, inteiroDoCampo } from '../../shared/numero-do-campo';

import {
  problemasDeModalidadeForaDoCatalogo,
  problemasDeModalidadeForaDoRol,
  problemasDeModalidades,
  problemasDeQuadro,
  problemasDeReferencias,
} from './dependencias-do-quadro';
import { ModalidadeDoCatalogo } from './modalidades-da-distribuicao';
import { comEscopo, ProblemaDaDistribuicao } from './problema-da-distribuicao';
import { problemaDeSomaDoQuadro } from './teto-e-soma-do-quadro';
import { ehRamoFederal, ehRamoReconhecido } from './composicao-de-vagas';

const PR_MINIMO = 0.5;
const PR_MAXIMO = 1;
const CASAS_DECIMAIS_PR = 4;

/**
 * Antecipa as invariantes que o agregado declara, para o operador não
 * descobri-las depois de preencher a tela inteira.
 *
 * Não replica o cálculo do quadro: a conferência da reserva legal e o ajuste do quadro fixado
 * vêm da simulação, e reimplementar a Lei de Cotas aqui seria a
 * divergência mais provável desta tela. A API é árbitra.
 */
export function problemasDaDistribuicao(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  rol: readonly string[] | null = null,
): ProblemaDaDistribuicao[] {
  return regraSemRamoReconhecido(distribuicao)
    ? problemasDaRegraSemRamo(distribuicao)
    : problemasDaRegraComRamo(distribuicao, catalogo, rol);
}

/** Regra escolhida cujo ramo a API não declara: o que depende do ramo não tem como ser conferido. */
function regraSemRamoReconhecido(distribuicao: DistribuicaoDeVagas): boolean {
  return (
    distribuicao.regraDistribuicaoCodigo !== '' &&
    !ehRamoReconhecido(distribuicao.ramoDaDistribuicao)
  );
}

function problemasDaRegraSemRamo(distribuicao: DistribuicaoDeVagas): ProblemaDaDistribuicao[] {
  return [
    ...comEscopo('preenchimento', problemasDeVoBase(distribuicao.voBase)),
    ...comEscopo('padrao', [
      'A regra de distribuição não declara o ramo do quadro (Lei 12.711 ou quadro fixado no edital): escolha outra regra.',
    ]),
  ];
}

function problemasDaRegraComRamo(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  rol: readonly string[] | null,
): ProblemaDaDistribuicao[] {
  const federal = ehRamoFederal(distribuicao.ramoDaDistribuicao);
  return [
    ...comEscopo('preenchimento', problemasDeVoBase(distribuicao.voBase)),
    ...problemasDoPadrao(distribuicao, catalogo, federal),
    ...problemasDeModalidadeIndisponivel(distribuicao, catalogo, rol),
    ...problemasDeQuadro(distribuicao, catalogo, federal),
    ...comEscopo('padrao', problemasDeReferencias(distribuicao, federal)),
    ...comEscopo('oferta', problemasDeExcessoDoQuadro(distribuicao, catalogo)),
  ];
}

function problemasDoPadrao(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): ProblemaDaDistribuicao[] {
  return [
    ...comEscopo('padrao', federal ? problemasDePr(distribuicao.pr) : []),
    ...comEscopo('padrao', problemasDeModalidades(distribuicao, catalogo, federal)),
  ];
}

function problemasDeModalidadeIndisponivel(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  rol: readonly string[] | null,
): ProblemaDaDistribuicao[] {
  return [
    ...comEscopo('oferta', problemasDeModalidadeForaDoCatalogo(distribuicao, catalogo)),
    ...comEscopo('oferta', problemasDeModalidadeForaDoRol(distribuicao, rol)),
  ];
}

function problemasDeExcessoDoQuadro(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): string[] {
  const excesso = problemaDeSomaDoQuadro(distribuicao, catalogo);
  return excesso === null ? [] : [excesso];
}

function problemasDeVoBase(voBase: string): string[] {
  const numero = inteiroDoCampo(voBase);
  return numero === null || numero <= 0
    ? ['Informe o total de vagas da oferta como número inteiro maior que zero.']
    : [];
}

function problemasDePr(pr: string): string[] {
  const numero = decimalDoCampo(pr);
  if (numero === null) {
    return [
      'Informe o percentual de reserva no padrão desta distribuição — um número entre 0,5 e 1,0.',
    ];
  }

  const problemas: string[] = [];
  if (numero < PR_MINIMO || numero > PR_MAXIMO) {
    problemas.push('O percentual de reserva fica entre 0,5 e 1,0 (art. 10, II da Lei 12.711).');
  }
  if (casasDecimais(pr) > CASAS_DECIMAIS_PR) {
    problemas.push(`O percentual de reserva aceita no máximo ${CASAS_DECIMAIS_PR} casas decimais.`);
  }
  return problemas;
}

/** Ofertas repetidas no mesmo processo — UNI-REQ-0134. */
export function ofertasRepetidas(distribuicoes: readonly DistribuicaoDeVagas[]): readonly string[] {
  return repetidos(distribuicoes.map((distribuicao) => distribuicao.ofertaCursoId));
}

function casasDecimais(texto: string): number {
  const fracao = texto.trim().replace(',', '.').split('.')[1];
  return fracao?.length ?? 0;
}
