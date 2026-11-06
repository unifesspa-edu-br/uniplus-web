import type { FormGroup } from '@angular/forms';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import {
  campoDaRecusa,
  citacoesDaRecusa,
  ehCitacao,
  type EixosEditaveis,
  type GrupoDeCitacoes,
} from './fato-candidato.regras';

/** Os eixos que o tipo do fato pode não editar, com o nome que a tela dá a cada um. */
export const ROTULOS_DOS_EIXOS: Readonly<Record<string, string>> = {
  dominio: 'Tipo de dado',
  cardinalidade: 'Quantos valores',
  fonteValores: 'De onde vêm os valores',
  formato: 'Formato do texto',
  escopo: 'De quem é o dado',
};

/** Põe as recusas de campo da API nos controles do formulário; diz se alguma coube. */
export function aplicarErrosNoFormulario(formulario: FormGroup, problem: ProblemDetails): boolean {
  let aplicou = false;
  for (const erro of problem.errors ?? []) {
    const controle = formulario.get(campoDaRecusa(erro.field));
    if (controle === null) continue;
    controle.setErrors({ backend: { code: erro.code, message: erro.message } });
    controle.markAsTouched();
    aplicou = true;
  }
  return aplicou;
}

/** Para onde foi cada recusa da definição. */
export interface RecusaDaDefinicao {
  /** O que cita o fato e deixaria de valer, agrupado por tipo de citação. */
  readonly citacoes: readonly GrupoDeCitacoes[];
  /** A recusa sem controle na tela (eixo que o tipo não edita, campo desconhecido), em prosa. */
  readonly semControle: string | null;
  /** Alguma recusa coube num campo do formulário. */
  readonly noCampo: boolean;
}

/**
 * A recusa da definição: o campo recusado leva a mensagem junto do eixo; a citação que deixaria de
 * valer vira a lista agrupada; e o que não tem controle na tela vira o texto do alerta da definição.
 */
export function distribuirRecusaDaDefinicao(
  problem: ProblemDetails,
  formulario: FormGroup,
  eixos: EixosEditaveis,
): RecusaDaDefinicao {
  const erros = problem.errors ?? [];
  const doCampo = erros.filter((erro) => !ehCitacao(erro.field));
  const naTela = (campo: string): boolean =>
    formulario.get(campo) !== null &&
    (!(campo in ROTULOS_DOS_EIXOS) || eixos[campo as keyof EixosEditaveis]);
  const ocultos = doCampo.filter((erro) => !naTela(campoDaRecusa(erro.field)));
  const noCampo = aplicarErrosNoFormulario(formulario, {
    ...problem,
    errors: doCampo.filter((erro) => !ocultos.includes(erro)),
  });
  const texto = ocultos
    .map((erro) => `${ROTULOS_DOS_EIXOS[campoDaRecusa(erro.field)] ?? erro.field}: ${erro.message}`)
    .join(' ');
  return {
    citacoes: citacoesDaRecusa(erros),
    semControle: ocultos.length > 0 ? texto : null,
    noCampo,
  };
}
