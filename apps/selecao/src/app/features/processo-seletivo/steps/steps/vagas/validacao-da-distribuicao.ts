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
import { ehRamoFederal } from './composicao-de-vagas';

const PR_MINIMO = 0.5;
const PR_MAXIMO = 1;
const CASAS_DECIMAIS_PR = 4;

/**
 * Antecipa as invariantes que o agregado declara, para o operador não
 * descobri-las depois de preencher a tela inteira.
 *
 * Não replica o cálculo do quadro: `vrNominal`, `vrFinal`, `estouro` e
 * `capadoEmVo` vêm da simulação, e reimplementar a Lei de Cotas aqui seria a
 * divergência mais provável desta tela. A API é árbitra.
 */
export function problemasDaDistribuicao(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  rol: readonly string[] | null = null,
): ProblemaDaDistribuicao[] {
  const federal = ehRamoFederal(distribuicao.regraDistribuicaoCodigo);
  const excesso = problemaDeSomaDoQuadro(distribuicao, catalogo);

  return [
    ...comEscopo('preenchimento', problemasDeVoBase(distribuicao.voBase)),
    ...comEscopo('padrao', problemasDePr(distribuicao.pr)),
    ...comEscopo('padrao', problemasDeModalidades(distribuicao, catalogo, federal)),
    ...comEscopo('oferta', problemasDeModalidadeForaDoCatalogo(distribuicao, catalogo)),
    ...comEscopo('oferta', problemasDeModalidadeForaDoRol(distribuicao, rol)),
    ...problemasDeQuadro(distribuicao, catalogo, federal),
    ...comEscopo('padrao', problemasDeReferencias(distribuicao, federal)),
    ...comEscopo('oferta', excesso === null ? [] : [excesso]),
  ];
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
