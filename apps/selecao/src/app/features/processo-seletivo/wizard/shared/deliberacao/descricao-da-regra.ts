import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import {
  CRITERIOS_DE_VOTACAO,
  DESEMPATES_DA_VOTACAO,
  ENCERRAMENTOS_DA_VOTACAO,
  RESULTADOS_SEM_UNANIMIDADE,
  ehColegiada,
  type OpcaoDaRegra,
} from './regra-de-deliberacao';

export const SEM_REGRA_DE_DELIBERACAO = 'Sem regra de deliberação declarada';

function rotuloDe<T extends string>(opcoes: readonly OpcaoDaRegra<T>[], valor: T | ''): string {
  return opcoes.find((opcao) => opcao.valor === valor)?.rotulo.toLowerCase() ?? '';
}

const quantidade = (valor: string, singular: string, plural: string): string =>
  `${valor} ${valor === '1' ? singular : plural}`;

const suplentes = (valor: string): string =>
  valor === '0' ? 'sem suplentes' : quantidade(valor, 'suplente', 'suplentes');

function composicao(regra: RegraDeDeliberacaoDaBanca): string {
  return `${quantidade(regra.integrantes, 'titular', 'titulares')}, ${suplentes(regra.suplentes)}`;
}

function votacao(regra: RegraDeDeliberacaoDaBanca): readonly string[] {
  const partes = [
    `quórum ${regra.quorum}`,
    rotuloDe(CRITERIOS_DE_VOTACAO, regra.criterio),
    `encerra: ${rotuloDe(ENCERRAMENTOS_DA_VOTACAO, regra.encerramento)}`,
  ];
  if (regra.desempate !== '')
    partes.push(`desempate: ${rotuloDe(DESEMPATES_DA_VOTACAO, regra.desempate)}`);
  if (regra.semUnanimidade !== '') {
    partes.push(`sem unanimidade: ${rotuloDe(RESULTADOS_SEM_UNANIMIDADE, regra.semUnanimidade)}`);
  }
  return partes;
}

/** A regra em uma linha, para a leitura em consulta e o resumo. */
export function descricaoDaRegra(regra: RegraDeDeliberacaoDaBanca | null): string {
  if (regra === null) return SEM_REGRA_DE_DELIBERACAO;
  const partes = [composicao(regra), ...(ehColegiada(regra) ? votacao(regra) : ['ato individual'])];
  return partes.join('; ');
}
