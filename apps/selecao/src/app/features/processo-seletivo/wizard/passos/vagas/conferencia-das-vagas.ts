import { codigoComNome } from '@uniplus/shared-utils';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { inteiroNaForma } from '../../shared/numero-do-campo';
import { erroDasOpcoes } from './opcoes-de-curso';
import { voBaseValido } from './teto-e-soma-do-quadro';
import { quantidadeDoQuadro } from './totais-do-quadro';

export function frase(quantas: number): string {
  return quantas === 1 ? '1 oferta' : `${quantas} ofertas`;
}

/** Enumeração em português: vírgulas até o último, que entra com "e". */
function lista(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * O campo em falta é apontado nele mesmo, não numa frase abaixo da linha.
 *
 * A checagem aqui é de preenchimento, para marcar a célula; a validação de verdade continua em
 * `problemasDaDistribuicao`, que é quem conhece as invariantes do agregado.
 */
export function voBaseInvalido(distribuicao: DistribuicaoDeVagas): boolean {
  return !voBaseValido(distribuicao.voBase);
}

export function quantidadeInvalida(
  distribuicao: DistribuicaoDeVagas,
  modalidadeId: string,
): boolean {
  return inteiroNaForma(quantidadeDoQuadro(distribuicao, modalidadeId)) === null;
}

/**
 * O que falta no quadro, contado por tipo em vez de repetido por linha.
 *
 * Vinte ofertas sem a mesma quantidade produziriam vinte frases idênticas, e o operador leria
 * vinte vezes o que precisa saber uma. A célula em falta fica marcada; aqui vai só quantas são.
 */
export function pendenciasDoQuadro(
  distribuicoes: readonly DistribuicaoDeVagas[],
  colunasDeQuantidade: readonly ColunaDeQuantidade[],
): readonly string[] {
  const semVo = distribuicoes.filter((item) => voBaseInvalido(item)).length;
  const pendencias = [...rotulosPorQuantidadeDeOfertas(distribuicoes, colunasDeQuantidade)].map(
    ([quantas, rotulos]) => `${frase(quantas)} sem a quantidade de ${lista(rotulos)}`,
  );
  return semVo > 0 ? [`${frase(semVo)} sem o total de vagas`, ...pendencias] : pendencias;
}

interface ColunaDeQuantidade {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

/**
 * Agrupado por quantas ofertas: com dez modalidades declaradas e nenhuma preenchida, dizer
 * "3 ofertas sem a quantidade de X" dez vezes esconde a informação, que é uma só.
 */
function rotulosPorQuantidadeDeOfertas(
  distribuicoes: readonly DistribuicaoDeVagas[],
  colunas: readonly ColunaDeQuantidade[],
): ReadonlyMap<number, readonly string[]> {
  const grupos = new Map<number, string[]>();
  for (const modalidade of colunas) {
    const quantas = distribuicoes.filter((item) => quantidadeInvalida(item, modalidade.id)).length;
    if (quantas > 0)
      grupos.set(quantas, [
        ...(grupos.get(quantas) ?? []),
        codigoComNome(modalidade.codigo, modalidade.nome),
      ]);
  }
  return grupos;
}

export interface EntradaDaConferencia {
  readonly numeroDeOpcoes: string;
  readonly distribuicoes: readonly DistribuicaoDeVagas[];
  readonly ofertasForaDoPadrao: number;
  readonly faltaSimular: boolean;
  readonly problemasDoPadrao: readonly string[];
  readonly pendenciasDoQuadro: readonly string[];
  readonly problemasEspecificos: readonly string[];
  readonly ofertasRepetidas: readonly string[];
  readonly rotuloDaOferta: (ofertaCursoId: string) => string;
}

/**
 * O que impede de gravar o quadro. Tudo aqui é erro a corrigir, e não declaração do operador
 * sobre ter lido a tela: a conferência virou o diálogo que a página abre no instante da gravação.
 */
export function pendenciasQueImpedemGravar(entrada: EntradaDaConferencia): readonly string[] {
  const opcoes = pendenciasDasOpcoes(entrada);
  if (entrada.distribuicoes.length === 0) return [...opcoes, SEM_OFERTA_CONFIGURADA];
  return [
    ...opcoes,
    ...pendenciasDoPadraoEmTela(entrada),
    ...entrada.pendenciasDoQuadro.map((pendencia) => `${pendencia}.`),
    ...entrada.problemasEspecificos,
    ...pendenciasDeOfertasRepetidas(entrada),
  ];
}

const SEM_OFERTA_CONFIGURADA = 'Configure a distribuição de vagas de ao menos uma oferta de curso.';

function pendenciasDasOpcoes(entrada: EntradaDaConferencia): readonly string[] {
  const erro = erroDasOpcoes(entrada.numeroDeOpcoes, entrada.distribuicoes.length);
  return erro === null ? [] : [erro];
}

function pendenciasDoPadraoEmTela(entrada: EntradaDaConferencia): readonly string[] {
  const foraDoPadrao = `${frase(entrada.ofertasForaDoPadrao)} têm regra, percentual ou modalidades diferentes do padrão em tela. Aplique o padrão a todas antes de gravar.`;
  return [
    ...(entrada.ofertasForaDoPadrao === 0 ? [] : [foraDoPadrao]),
    ...(entrada.faltaSimular
      ? ['Simule o quadro: é a conferência de quantas vagas cada modalidade recebe.']
      : []),
    ...entrada.problemasDoPadrao,
  ];
}

function pendenciasDeOfertasRepetidas(entrada: EntradaDaConferencia): readonly string[] {
  return entrada.ofertasRepetidas.map(
    (ofertaCursoId) =>
      `${entrada.rotuloDaOferta(ofertaCursoId)} aparece em mais de uma distribuição.`,
  );
}
