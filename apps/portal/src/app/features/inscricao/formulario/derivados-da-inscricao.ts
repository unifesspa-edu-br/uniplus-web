import type { FormularioApresentadoDoProcessoDto } from '@uniplus/shared-data/selecao';
import {
  type DerivadoDoSistema,
  type ValorJson,
  derivadosDoSistema,
} from '@uniplus/shared-inscricao/formulario';

/** Um fato que o sistema calcula, com o rótulo que o formulário dá a ele. */
export interface DerivadoNaTela extends DerivadoDoSistema {
  readonly rotulo: string;
}

/** Os fatos calculados que o formulário cita, com o rótulo de lá. */
export function derivadosDoFormulario(
  formulario: FormularioApresentadoDoProcessoDto,
  respostas: Readonly<Record<string, ValorJson>>,
): DerivadoNaTela[] {
  const { pressupostos } = formulario.formulario;
  const citados = new Map(pressupostos.fatos.map((p) => [p.fatoCodigo, p]));
  return derivadosDoSistema(respostas, pressupostos.dataReferenciaFatos)
    .filter((d) => citados.has(d.fatoCodigo))
    .map((d) => ({ ...d, rotulo: citados.get(d.fatoCodigo)?.rotulo ?? d.fatoCodigo }));
}

/** Os fatos calculados de todos os formulários, cada um uma vez. */
export function derivadosSemRepeticao(
  porFormulario: ReadonlyMap<string, readonly DerivadoNaTela[]>,
): DerivadoNaTela[] {
  const todos = [...porFormulario.values()].flat();
  return todos.filter((d, i) => todos.findIndex((o) => o.fatoCodigo === d.fatoCodigo) === i);
}

/** O que o formulário recebe como pressupostos: os fatos calculados que ele cita, pelo código. */
export function pressupostosDe(
  derivados: readonly DerivadoNaTela[],
): Readonly<Record<string, ValorJson>> {
  return Object.fromEntries(derivados.map((d) => [d.fatoCodigo, d.valor]));
}
