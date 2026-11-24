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
    codigo: ModoDeDeliberacao.COLEGIADA_COM_VOTACAO,
    rotulo: 'Colegiada, com votação',
  },
  atoIndividual: { codigo: ModoDeDeliberacao.ATO_INDIVIDUAL, rotulo: 'Ato individual' },
};
export const CRITERIOS = {
  maioriaSimples: { codigo: CriterioDeVotacaoCodigo.MAIORIA_SIMPLES, rotulo: 'Maioria simples' },
  maioriaAbsoluta: { codigo: CriterioDeVotacaoCodigo.MAIORIA_ABSOLUTA, rotulo: 'Maioria absoluta' },
  unanimidade: { codigo: CriterioDeVotacaoCodigo.UNANIMIDADE, rotulo: 'Unanimidade' },
};
export const DESEMPATES = {
  votoDaPresidencia: {
    codigo: DesempateDaVotacaoCodigo.VOTO_DA_PRESIDENCIA,
    rotulo: 'Voto da presidência',
  },
  novaVotacao: { codigo: DesempateDaVotacaoCodigo.NOVA_VOTACAO, rotulo: 'Nova votação' },
};
export const ENCERRAMENTOS = {
  todosOsTitulares: {
    codigo: EncerramentoDaVotacaoCodigo.TODOS_OS_TITULARES,
    rotulo: 'Todos os titulares votam',
  },
  presidenciaNoQuorum: {
    codigo: EncerramentoDaVotacaoCodigo.PRESIDENCIA_NO_QUORUM,
    rotulo: 'A presidência encerra ao atingir o quórum',
  },
};
export const RESULTADOS = {
  favoravel: { codigo: ResultadoSemUnanimidadeCodigo.FAVORAVEL, rotulo: 'Favorável' },
  desfavoravel: { codigo: ResultadoSemUnanimidadeCodigo.DESFAVORAVEL, rotulo: 'Desfavorável' },
  novaVotacao: { codigo: ResultadoSemUnanimidadeCodigo.NOVA_VOTACAO, rotulo: 'Nova votação' },
};
export const COLEGIADA: RegraDeDeliberacaoDaBanca = {
  modo: MODOS.colegiadaComVotacao.codigo,
  integrantes: '5',
  suplentes: '2',
  quorum: '3',
  criterio: CRITERIOS.maioriaSimples.codigo,
  desempate: DESEMPATES.votoDaPresidencia.codigo,
  encerramento: ENCERRAMENTOS.presidenciaNoQuorum.codigo,
  semUnanimidade: '',
};
export const ATO_INDIVIDUAL: RegraDeDeliberacaoDaBanca = {
  modo: MODOS.atoIndividual.codigo,
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
