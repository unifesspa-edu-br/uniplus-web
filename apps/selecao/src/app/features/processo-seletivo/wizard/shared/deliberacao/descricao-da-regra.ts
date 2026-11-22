import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { ehColegiada } from './regra-de-deliberacao';

export const SEM_REGRA_DE_DELIBERACAO = 'Sem regra de deliberação declarada';

function rotuloDe(
  regra: RegraDeDeliberacaoDaBanca,
  campo: keyof NonNullable<RegraDeDeliberacaoDaBanca['rotulos']>,
): string {
  const opcao = regra.rotulos?.[campo];
  return opcao?.codigo === regra[campo] ? opcao.rotulo : '';
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
    rotuloDe(regra, 'criterio'),
    `encerra: ${rotuloDe(regra, 'encerramento')}`,
  ];
  if (regra.desempate !== '') partes.push(`desempate: ${rotuloDe(regra, 'desempate')}`);
  if (regra.semUnanimidade !== '') {
    partes.push(`sem unanimidade: ${rotuloDe(regra, 'semUnanimidade')}`);
  }
  return partes;
}

/** A regra em uma linha, para a leitura em consulta e o resumo. */
export function descricaoDaRegra(regra: RegraDeDeliberacaoDaBanca | null): string {
  if (regra === null) return SEM_REGRA_DE_DELIBERACAO;
  const partes = [composicao(regra), rotuloDe(regra, 'modo')].filter(Boolean);
  if (ehColegiada(regra)) return [...partes, ...votacao(regra)].join('; ');
  if (
    [regra.quorum, regra.criterio, regra.encerramento, regra.desempate, regra.semUnanimidade].some(
      Boolean,
    )
  ) {
    partes.push(`recurso: ${votacao(regra).join('; ')}`);
  }
  return partes.join('; ');
}
