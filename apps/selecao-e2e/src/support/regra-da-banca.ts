import type { Locator } from '@playwright/test';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import type { BancaDaFaseLida } from './api-das-bancas';

/** A regra de deliberação como a leitura a devolve. */
export type RegraLida = NonNullable<BancaDaFaseLida['regraDeDeliberacao']>;

/** Uma banca colegiada de três titulares, que decide por maioria simples com quórum de dois. */
export const REGRA_COLEGIADA: RegraLida = {
  modo: { codigo: ModoDeDeliberacao.COLEGIADA_COM_VOTACAO, rotulo: 'Colegiada, com votação' },
  integrantes: 3,
  suplentes: 0,
  quorum: 2,
  criterio: {
    codigo: 'MAIORIA_SIMPLES' as NonNullable<RegraLida['criterio']>['codigo'],
    rotulo: 'Maioria simples',
  },
  desempate: {
    codigo: 'VOTO_DA_PRESIDENCIA' as NonNullable<RegraLida['desempate']>['codigo'],
    rotulo: 'Voto da presidência',
  },
  encerramento: {
    codigo: 'PRESIDENCIA_NO_QUORUM' as NonNullable<RegraLida['encerramento']>['codigo'],
    rotulo: 'A presidência encerra ao atingir o quórum',
  },
  semUnanimidade: null,
};

/** O que a pessoa escolhe nos campos da votação, pelo texto que a tela mostra. */
export interface VotacaoEscolhida {
  readonly encerramento: string;
  readonly quorum: string;
  readonly criterio: string;
  readonly desempate?: string;
}

export const modoDaBanca = (banca: Locator): Locator =>
  banca.getByLabel('Deliberação da banca', { exact: true });
export const integrantesDaBanca = (banca: Locator): Locator =>
  banca.getByLabel('Integrantes titulares', { exact: true });
export const encerramentoDaVotacao = (banca: Locator): Locator =>
  banca.getByLabel('Encerramento da votação', { exact: true });
export const quorumDaVotacao = (banca: Locator): Locator =>
  banca.getByLabel('Quórum', { exact: true });
export const criterioDaVotacao = (banca: Locator): Locator =>
  banca.getByLabel('Critério da votação', { exact: true });
export const desempateDaVotacao = (banca: Locator): Locator =>
  banca.getByLabel('Em caso de empate', { exact: true });

/** Escolhe o modo da banca e informa os titulares, que a regra pede em qualquer modo. */
export async function declararOModo(
  banca: Locator,
  modo: 'Ato individual' | 'Colegiada, com votação',
  integrantes: string,
): Promise<void> {
  await modoDaBanca(banca).selectOption({ label: modo });
  await integrantesDaBanca(banca).fill(integrantes);
}

/** Preenche a votação que a banca usa quando julga recurso; o desempate só quando a tela o pede. */
export async function declararAVotacao(banca: Locator, votacao: VotacaoEscolhida): Promise<void> {
  await encerramentoDaVotacao(banca).selectOption({ label: votacao.encerramento });
  await quorumDaVotacao(banca).fill(votacao.quorum);
  await criterioDaVotacao(banca).selectOption({ label: votacao.criterio });
  if (votacao.desempate !== undefined) {
    await desempateDaVotacao(banca).selectOption({ label: votacao.desempate });
  }
}
