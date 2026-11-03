/**
 * De onde vem cada recusa, e por isso onde ela deve ser dita.
 *
 * `padrao` vale para todas as ofertas — repeti-la por linha faria o operador
 * ler três vezes que falta um campo só. `preenchimento` é campo vazio, já
 * marcado na própria célula. `oferta` é o que só aquela linha tem.
 */
export type EscopoDoProblema = 'padrao' | 'preenchimento' | 'oferta';

export interface ProblemaDaDistribuicao {
  readonly escopo: EscopoDoProblema;
  readonly mensagem: string;
}

export function comEscopo(
  escopo: EscopoDoProblema,
  mensagens: readonly string[],
): ProblemaDaDistribuicao[] {
  return mensagens.map((mensagem) => ({ escopo, mensagem }));
}
