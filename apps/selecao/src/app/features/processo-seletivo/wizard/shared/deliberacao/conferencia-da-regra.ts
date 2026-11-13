import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { inteiroDoCampo } from '../numero-do-campo';
import {
  ehColegiada,
  pedeDesempate,
  pedeResultadoSemUnanimidade,
  quorumSegueOsIntegrantes,
  type CampoDaRegra,
} from './regra-de-deliberacao';

export interface ProblemaDaRegra {
  readonly campo: CampoDaRegra;
  readonly mensagem: string;
}

const MENSAGEM: Readonly<Record<string, string>> = {
  integrantes: 'Informe quantos titulares a banca tem: um número inteiro, de 1 em diante.',
  suplentes: 'Informe quantos suplentes a banca tem, ou 0 se não houver.',
  quorum: 'O quórum é um número inteiro de 1 até o número de integrantes.',
  criterio: 'Escolha o critério: maioria simples, maioria absoluta ou unanimidade.',
  encerramento: 'Diga como a votação se encerra.',
  desempate: 'Escolha o desempate: voto da presidência ou nova votação.',
  semUnanimidade: 'Diga o que vale quando não há unanimidade.',
};

type Conferencia = readonly [falha: boolean, campo: CampoDaRegra];

/** Os campos cuja conferência falhou, cada um com a orientação que lhe cabe. */
const falhas = (...conferencias: readonly Conferencia[]): readonly ProblemaDaRegra[] =>
  conferencias
    .filter(([falha]) => falha)
    .map(([, campo]) => ({ campo, mensagem: MENSAGEM[campo] }));

function problemasDaComposicao(regra: RegraDeDeliberacaoDaBanca): readonly ProblemaDaRegra[] {
  const integrantes = inteiroDoCampo(regra.integrantes);
  return falhas(
    [integrantes === null || integrantes < 1, 'integrantes'],
    [inteiroDoCampo(regra.suplentes) === null, 'suplentes'],
  );
}

function quorumForaDoIntervalo(regra: RegraDeDeliberacaoDaBanca): boolean {
  if (quorumSegueOsIntegrantes(regra)) return false;
  const quorum = inteiroDoCampo(regra.quorum);
  const integrantes = inteiroDoCampo(regra.integrantes) ?? 0;
  return quorum === null || quorum < 1 || quorum > integrantes;
}

function problemasDaVotacao(regra: RegraDeDeliberacaoDaBanca): readonly ProblemaDaRegra[] {
  return falhas(
    [regra.criterio === '', 'criterio'],
    [regra.encerramento === '', 'encerramento'],
    [quorumForaDoIntervalo(regra), 'quorum'],
    [pedeDesempate(regra) && regra.desempate === '', 'desempate'],
    [pedeResultadoSemUnanimidade(regra) && regra.semUnanimidade === '', 'semUnanimidade'],
  );
}

/** Os campos da regra declarada que a API recusaria; a regra ausente não é problema do rascunho. */
export function problemasDaRegra(regra: RegraDeDeliberacaoDaBanca): readonly ProblemaDaRegra[] {
  return [
    ...problemasDaComposicao(regra),
    ...(ehColegiada(regra) ? problemasDaVotacao(regra) : []),
  ];
}

/** O que a conferência acusa, por campo; a regra ausente não acusa nada. */
export function problemasDaRegraPorCampo(
  regra: RegraDeDeliberacaoDaBanca | null,
): ReadonlyMap<CampoDaRegra, string> {
  const problemas = regra === null ? [] : problemasDaRegra(regra);
  return new Map(problemas.map(({ campo, mensagem }) => [campo, mensagem]));
}
