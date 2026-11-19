import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';

/** Banca colegiada de cinco titulares, maioria simples, com a presidência desempatando. */
export const COLEGIADA: RegraDeDeliberacaoDaBanca = {
  modo: ModoDeDeliberacao.colegiadaComVotacao,
  integrantes: '5',
  suplentes: '2',
  quorum: '3',
  criterio: 'maioriaSimples',
  desempate: 'votoDaPresidencia',
  encerramento: 'presidenciaNoQuorum',
  semUnanimidade: '',
};

/** Banca de um só avaliador: decide sozinho, sem quórum nem votação. */
export const ATO_INDIVIDUAL: RegraDeDeliberacaoDaBanca = {
  modo: ModoDeDeliberacao.atoIndividual,
  integrantes: '1',
  suplentes: '0',
  quorum: '',
  criterio: '',
  desempate: '',
  encerramento: '',
  semUnanimidade: '',
};

export const comRegra = (
  parcial: Partial<RegraDeDeliberacaoDaBanca>,
  base: RegraDeDeliberacaoDaBanca = COLEGIADA,
): RegraDeDeliberacaoDaBanca => ({ ...base, ...parcial });
