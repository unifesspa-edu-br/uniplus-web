import type { FormGroup } from '@angular/forms';
import { type CausaDeCampo, type ProblemDetails, separarCausas } from '@uniplus/shared-core/http';
import { marcarRecusaDoServidor } from '../../shared/formulario';
import { citacoesDaRecusa, ehCitacao, type GrupoDeCitacoes } from './citacoes-do-fato';
import { campoDaRecusa, type EixosEditaveis } from './fato-candidato.regras';

/** Os eixos que o tipo do fato pode não editar, com o nome que a tela dá a cada um. */
export const ROTULOS_DOS_EIXOS: Readonly<Record<string, string>> = {
  dominio: 'Tipo de dado',
  cardinalidade: 'Quantos valores',
  fonteValores: 'De onde vêm os valores',
  formato: 'Formato do texto',
  escopo: 'De quem é o dado',
};

/** Põe as recusas de campo da API nos controles do formulário; diz se alguma coube. */
export function aplicarErrosNoFormulario(
  formulario: FormGroup,
  erros: readonly CausaDeCampo[],
): boolean {
  let aplicou = false;
  for (const erro of erros) {
    const controle = formulario.get(campoDaRecusa(erro.field));
    if (controle === null) continue;
    marcarRecusaDoServidor(controle, erro.code, erro.message);
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
  const erros = separarCausas(problem.errors).deCampo;
  const doCampo = erros.filter((erro) => !ehCitacao(erro.field));
  const ocultos = doCampo.filter((erro) => !temControleNaTela(erro.field, formulario, eixos));
  const coube = doCampo.filter((erro) => !ocultos.includes(erro));
  return {
    citacoes: citacoesDaRecusa(erros),
    semControle: textoDasRecusasSemControle(ocultos),
    noCampo: aplicarErrosNoFormulario(formulario, coube),
  };
}

function temControleNaTela(
  campoDaApi: string,
  formulario: FormGroup,
  eixos: EixosEditaveis,
): boolean {
  const campo = campoDaRecusa(campoDaApi);
  return (
    formulario.get(campo) !== null &&
    (!(campo in ROTULOS_DOS_EIXOS) || eixos[campo as keyof EixosEditaveis])
  );
}

function textoDasRecusasSemControle(ocultos: readonly CausaDeCampo[]): string | null {
  if (ocultos.length === 0) return null;
  return ocultos
    .map((erro) => `${ROTULOS_DOS_EIXOS[campoDaRecusa(erro.field)] ?? erro.field}: ${erro.message}`)
    .join(' ');
}
