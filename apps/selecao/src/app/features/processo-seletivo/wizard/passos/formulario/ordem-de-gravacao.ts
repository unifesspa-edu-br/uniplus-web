import {
  fatosCitadosPeloConteudo,
  type ConteudoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';

import { fatosColetadosPor } from './formulario-do-processo';

/** Um formulário na gravação: o que o servidor tem, quando tem, e o que o rascunho quer. */
export interface FormularioNaGravacao {
  readonly codigo: string;
  /** Se é o que o candidato responde ao se inscrever: os outros citam o que ele coleta. */
  readonly daInscricao: boolean;
  readonly servidor: ConteudoDoFormulario | null;
  readonly desejado: ConteudoDoFormulario;
}

const coletados = (conteudo: ConteudoDoFormulario | null): ReadonlySet<string> =>
  new Set(conteudo === null ? [] : fatosColetadosPor(conteudo));
const citados = (conteudo: ConteudoDoFormulario | null): ReadonlySet<string> =>
  conteudo === null ? new Set() : fatosCitadosPeloConteudo(conteudo);
const diferenca = (um: ReadonlySet<string>, outro: ReadonlySet<string>): readonly string[] =>
  [...um].filter((fato) => !outro.has(fato));
const algumEm = (fatos: readonly string[], conjunto: ReadonlySet<string>): boolean =>
  fatos.some((fato) => conjunto.has(fato));

/**
 * A ordem em que os formulários gravam. Cada PUT é conferido contra o que os OUTROS têm gravado,
 * então a ordem decide se a gravação passa:
 * - o fato que muda de formulário sai de um antes de entrar no outro, ou o segundo é recusado por
 *   coletar o que o primeiro ainda coleta (produtor único);
 * - a inscrição que ganha um fato grava antes do formulário que passa a citá-lo, ou a citação é
 *   recusada por apontar fato que ninguém coleta;
 * - a inscrição que perde um fato que outro formulário cita no servidor grava depois dele, ou a
 *   inscrição é recusada por deixar aquela citação órfã.
 *
 * Sem dependência, vale a ordem recebida. Dependências em ciclo não têm ordem que passe; o resto
 * vai na ordem recebida e a recusa da API aponta o conflito.
 */
export function ordemDeGravacao(formularios: readonly FormularioNaGravacao[]): readonly string[] {
  return ordenarPelasDependencias(formularios, dependenciasDeGravacao(formularios));
}

/** Para cada formulário, os que precisam gravar antes dele. */
type AntesDe = ReadonlyMap<string, ReadonlySet<string>>;
type Exigir = (primeiro: string, depois: string) => void;

function dependenciasDeGravacao(formularios: readonly FormularioNaGravacao[]): AntesDe {
  const antesDe = new Map<string, Set<string>>(
    formularios.map((formulario) => [formulario.codigo, new Set<string>()]),
  );
  const exigir: Exigir = (primeiro, depois) => {
    if (primeiro !== depois) antesDe.get(depois)?.add(primeiro);
  };

  exigirSaidaAntesDaEntrada(formularios, exigir);
  exigirOrdemDasInscricoes(formularios, exigir);
  return antesDe;
}

function exigirOrdemDasInscricoes(
  formularios: readonly FormularioNaGravacao[],
  exigir: Exigir,
): void {
  for (const inscricao of formularios.filter((formulario) => formulario.daInscricao)) {
    exigirOrdemEmTornoDaInscricao(inscricao, formularios, exigir);
  }
}

function exigirSaidaAntesDaEntrada(
  formularios: readonly FormularioNaGravacao[],
  exigir: Exigir,
): void {
  for (const perde of formularios) {
    const perdidos = diferenca(coletados(perde.servidor), coletados(perde.desejado));
    for (const ganha of formularios) {
      if (algumEm(perdidos, coletados(ganha.desejado))) exigir(perde.codigo, ganha.codigo);
    }
  }
}

function exigirOrdemEmTornoDaInscricao(
  inscricao: FormularioNaGravacao,
  formularios: readonly FormularioNaGravacao[],
  exigir: Exigir,
): void {
  const ganhos = diferenca(coletados(inscricao.desejado), coletados(inscricao.servidor));
  const perdas = diferenca(coletados(inscricao.servidor), coletados(inscricao.desejado));
  for (const outro of formularios) {
    if (algumEm(ganhos, citados(outro.desejado))) exigir(inscricao.codigo, outro.codigo);
    if (algumEm(perdas, citados(outro.servidor))) exigir(outro.codigo, inscricao.codigo);
  }
}

function ordenarPelasDependencias(
  formularios: readonly FormularioNaGravacao[],
  antesDe: AntesDe,
): readonly string[] {
  const pendentes = formularios.map((formulario) => formulario.codigo);
  const ordem: string[] = [];
  while (pendentes.length > 0) {
    const livre = pendentes.findIndex((codigo) =>
      [...(antesDe.get(codigo) ?? [])].every((anterior) => ordem.includes(anterior)),
    );
    ordem.push(...pendentes.splice(livre === -1 ? 0 : livre, 1));
  }
  return ordem;
}
