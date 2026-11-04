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
  colunasDeQuantidade: readonly { readonly id: string; readonly codigo: string }[],
): readonly string[] {
  const semVo = distribuicoes.filter((item) => voBaseInvalido(item)).length;

  // Agrupado por quantas ofertas: com dez modalidades declaradas e nenhuma preenchida, dizer
  // "3 ofertas sem a quantidade de X" dez vezes esconde a informação, que é uma só.
  const porQuantidadeDeOfertas = new Map<number, string[]>();
  for (const modalidade of colunasDeQuantidade) {
    const quantas = distribuicoes.filter((item) => quantidadeInvalida(item, modalidade.id)).length;
    if (quantas === 0) continue;

    porQuantidadeDeOfertas.set(quantas, [
      ...(porQuantidadeDeOfertas.get(quantas) ?? []),
      modalidade.codigo,
    ]);
  }

  const pendencias = [...porQuantidadeDeOfertas].map(
    ([quantas, codigos]) => `${frase(quantas)} sem a quantidade de ${lista(codigos)}`,
  );

  return semVo > 0 ? [`${frase(semVo)} sem o total de vagas`, ...pendencias] : pendencias;
}

export interface EntradaDaConferencia {
  readonly numeroDeOpcoes: string;
  readonly distribuicoes: readonly DistribuicaoDeVagas[];
  readonly ofertasForaDoPadrao: number;
  readonly simulacaoCobreOQuadro: boolean;
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
  const opcoes = erroDasOpcoes(entrada.numeroDeOpcoes, entrada.distribuicoes.length);
  if (entrada.distribuicoes.length === 0) {
    return [
      ...(opcoes === null ? [] : [opcoes]),
      'Configure a distribuição de vagas de ao menos uma oferta de curso.',
    ];
  }

  return [
    ...(opcoes === null ? [] : [opcoes]),
    ...(entrada.ofertasForaDoPadrao === 0
      ? []
      : [
          `${frase(entrada.ofertasForaDoPadrao)} têm regra, percentual ou modalidades diferentes do padrão em tela. Aplique o padrão a todas antes de gravar.`,
        ]),
    ...(entrada.simulacaoCobreOQuadro
      ? []
      : ['Simule o quadro: é a conferência de quantas vagas cada modalidade recebe.']),
    ...entrada.problemasDoPadrao,
    ...entrada.pendenciasDoQuadro.map((pendencia) => `${pendencia}.`),
    ...entrada.problemasEspecificos,
    ...entrada.ofertasRepetidas.map(
      (ofertaCursoId) =>
        `${entrada.rotuloDaOferta(ofertaCursoId)} aparece em mais de uma distribuição.`,
    ),
  ];
}
