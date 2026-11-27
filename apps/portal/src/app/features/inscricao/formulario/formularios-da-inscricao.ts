import type {
  FormularioApresentadoDoProcessoDto,
  InscricaoDto,
} from '@uniplus/shared-data/selecao';
import {
  type DependenciasDaAvaliacao,
  type MunicipiosGravados,
  type MunicipiosSeparados,
  type SimulacaoDoFormulario,
  type ValorJson,
  separarMunicipiosGravados,
} from '@uniplus/shared-inscricao/formulario';

import { type ContaDoCandidato, respostasIniciaisDoNomeSocial } from './respostas-da-conta';

type Ocorrencias = NonNullable<SimulacaoDoFormulario['grupos']>;
type Respostas = Readonly<Record<string, ValorJson>>;

/**
 * Um formulário obrigatório da inscrição como a tela o recebe: o que a API publica e o que a inscrição
 * já gravou dele. As respostas de partida são só as que ele mesmo coleta: nenhum formulário parte da
 * resposta de outro da lista (UNI-REQ-0144).
 */
export interface FormularioCarregado {
  readonly formulario: FormularioApresentadoDoProcessoDto;
  readonly inicial: SimulacaoDoFormulario;
  /** Os termos que a inscrição já aceitou neste formulário, pelo código do termo. */
  readonly termosAceitos: readonly string[];
  readonly municipiosGravados: MunicipiosGravados;
  /** Os códigos de município que chegaram sem o nome gravado. */
  readonly municipiosSemNome: readonly string[];
}

function soDosCodigos<T>(
  gravado: Readonly<Record<string, T>>,
  codigos: ReadonlySet<string>,
): Record<string, T> {
  return Object.fromEntries(Object.entries(gravado).filter(([codigo]) => codigos.has(codigo)));
}

function respostasDoFormulario(
  formulario: FormularioApresentadoDoProcessoDto,
  inscricao: InscricaoDto,
): Respostas {
  const codigos = new Set(formulario.formulario.coleta.itens.map((i) => i.fatoCodigo));
  return soDosCodigos(inscricao.formulario.respostas as Respostas, codigos);
}

function gruposDoFormulario(
  formulario: FormularioApresentadoDoProcessoDto,
  inscricao: InscricaoDto,
): Ocorrencias {
  const codigos = new Set(formulario.formulario.coleta.grupos.map((g) => g.codigo));
  return soDosCodigos(inscricao.formulario.grupos as Ocorrencias, codigos);
}

function partidaDoFormulario(
  formulario: FormularioApresentadoDoProcessoDto,
  inscricao: InscricaoDto,
  conta: ContaDoCandidato | null,
): MunicipiosSeparados {
  const gravadas = respostasDoFormulario(formulario, inscricao);
  return separarMunicipiosGravados(formulario.formulario, {
    respostas: { ...respostasIniciaisDoNomeSocial(conta, gravadas, formulario), ...gravadas },
    grupos: gruposDoFormulario(formulario, inscricao),
  });
}

function termosAceitosDe(
  formulario: FormularioApresentadoDoProcessoDto,
  inscricao: InscricaoDto,
): string[] {
  return inscricao.formulario.aceites
    .filter((aceite) => aceite.formularioCodigo === formulario.codigo)
    .map((aceite) => aceite.codigo);
}

/** O formulário da lista com a partida que a inscrição gravada dá a ele, e só a dele. */
export function formularioCarregado(
  formulario: FormularioApresentadoDoProcessoDto,
  inscricao: InscricaoDto,
  conta: ContaDoCandidato | null,
): FormularioCarregado {
  const partida = partidaDoFormulario(formulario, inscricao, conta);
  return {
    formulario,
    inicial: { respostas: partida.respostas, grupos: partida.grupos },
    termosAceitos: termosAceitosDe(formulario, inscricao),
    municipiosGravados: partida.gravados,
    municipiosSemNome: partida.semNome,
  };
}

function semRepeticao(listas: readonly (readonly string[])[]): string[] {
  return [...new Set(listas.flat())];
}

/**
 * Os fatos e grupos de que a avaliação depende, de todos os formulários da inscrição, sem repetição;
 * nulo quando nenhum formulário declara dependência.
 */
export function dependenciasDaInscricao(
  formularios: readonly FormularioApresentadoDoProcessoDto[],
): DependenciasDaAvaliacao | null {
  const declaradas = formularios.flatMap((f) =>
    f.dependenciasDaAvaliacao ? [f.dependenciasDaAvaliacao] : [],
  );
  if (declaradas.length === 0) return null;
  return {
    fatos: semRepeticao(declaradas.map((d) => d.fatos)),
    grupos: semRepeticao(declaradas.map((d) => d.grupos)),
  };
}

/**
 * As simulações dos formulários numa só, para a avaliação e a gravação da inscrição, que são únicas.
 * A junção é calculada a cada leitura: não há cópia guardada.
 */
export function juntarSimulacoes(
  simulacoes: readonly SimulacaoDoFormulario[],
): SimulacaoDoFormulario {
  return {
    respostas: Object.assign({}, ...simulacoes.map((s) => s.respostas ?? {})),
    grupos: Object.assign({}, ...simulacoes.map((s) => s.grupos ?? {})),
    paginasConcluidas: simulacoes.flatMap((s) => s.paginasConcluidas ?? []),
    pressupostos: Object.assign({}, ...simulacoes.map((s) => s.pressupostos ?? {})),
    envio: simulacoes[0]?.envio ?? null,
  };
}

/** A partida da inscrição inteira: a de cada formulário, juntas. */
export function inicialDaInscricao(
  formularios: readonly FormularioCarregado[],
): SimulacaoDoFormulario {
  return juntarSimulacoes(formularios.map((f) => f.inicial));
}

/** O título do formulário na tela; sem título publicado, o nome genérico. */
export function tituloDoFormulario(formulario: FormularioApresentadoDoProcessoDto): string {
  return formulario.formulario.titulo?.trim() || 'Formulário da inscrição';
}
