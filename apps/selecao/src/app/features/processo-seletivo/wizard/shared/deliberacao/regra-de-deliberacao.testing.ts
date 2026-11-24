import { signal } from '@angular/core';
import { VocabulariosDaDeliberacaoService } from './vocabularios-da-deliberacao.service';
import {
  CriterioDeVotacaoCodigo,
  DesempateDaVotacaoCodigo,
  EncerramentoDaVotacaoCodigo,
  ModoDeDeliberacao,
  ResultadoSemUnanimidadeCodigo,
} from '@uniplus/shared-data/selecao';
import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';

export const MODOS = {
  colegiadaComVotacao: {
    codigo: ModoDeDeliberacao.colegiadaComVotacao,
    rotulo: 'Colegiada, com votação',
  },
  atoIndividual: { codigo: ModoDeDeliberacao.atoIndividual, rotulo: 'Ato individual' },
};
export const CRITERIOS = {
  maioriaSimples: { codigo: CriterioDeVotacaoCodigo.maioriaSimples, rotulo: 'Maioria simples' },
  maioriaAbsoluta: { codigo: CriterioDeVotacaoCodigo.maioriaAbsoluta, rotulo: 'Maioria absoluta' },
  unanimidade: { codigo: CriterioDeVotacaoCodigo.unanimidade, rotulo: 'Unanimidade' },
};
export const DESEMPATES = {
  votoDaPresidencia: {
    codigo: DesempateDaVotacaoCodigo.votoDaPresidencia,
    rotulo: 'Voto da presidência',
  },
  novaVotacao: { codigo: DesempateDaVotacaoCodigo.novaVotacao, rotulo: 'Nova votação' },
};
export const ENCERRAMENTOS = {
  todosOsTitulares: {
    codigo: EncerramentoDaVotacaoCodigo.todosOsTitulares,
    rotulo: 'Todos os titulares votam',
  },
  presidenciaNoQuorum: {
    codigo: EncerramentoDaVotacaoCodigo.presidenciaNoQuorum,
    rotulo: 'A presidência encerra ao atingir o quórum',
  },
};
export const RESULTADOS = {
  favoravel: { codigo: ResultadoSemUnanimidadeCodigo.favoravel, rotulo: 'Favorável' },
  desfavoravel: { codigo: ResultadoSemUnanimidadeCodigo.desfavoravel, rotulo: 'Desfavorável' },
  novaVotacao: { codigo: ResultadoSemUnanimidadeCodigo.novaVotacao, rotulo: 'Nova votação' },
};
export const COLEGIADA: RegraDeDeliberacaoDaBanca = {
  modo: MODOS.colegiadaComVotacao,
  integrantes: '5',
  suplentes: '2',
  quorum: '3',
  criterio: CRITERIOS.maioriaSimples,
  desempate: DESEMPATES.votoDaPresidencia,
  encerramento: ENCERRAMENTOS.presidenciaNoQuorum,
  semUnanimidade: null,
};
export const ATO_INDIVIDUAL: RegraDeDeliberacaoDaBanca = {
  modo: MODOS.atoIndividual,
  integrantes: '1',
  suplentes: '0',
  quorum: '',
  criterio: null,
  desempate: null,
  encerramento: null,
  semUnanimidade: null,
};
export const comRegra = (
  parcial: Partial<RegraDeDeliberacaoDaBanca>,
  base: RegraDeDeliberacaoDaBanca = COLEGIADA,
): RegraDeDeliberacaoDaBanca => ({ ...base, ...parcial });

const opcoesParaTeste = {
  modos: [MODOS.colegiadaComVotacao, MODOS.atoIndividual],
  criterios: [CRITERIOS.maioriaSimples, CRITERIOS.maioriaAbsoluta, CRITERIOS.unanimidade],
  desempates: [DESEMPATES.votoDaPresidencia, DESEMPATES.novaVotacao],
  encerramentos: [ENCERRAMENTOS.todosOsTitulares, ENCERRAMENTOS.presidenciaNoQuorum],
  resultados: [RESULTADOS.favoravel, RESULTADOS.desfavoravel, RESULTADOS.novaVotacao],
};

export function proverVocabulariosDaDeliberacao() {
  return {
    provide: VocabulariosDaDeliberacaoService,
    useValue: {
      opcoes: signal(opcoesParaTeste),
      carregando: signal(false),
      erro: signal(false),
    },
  };
}
