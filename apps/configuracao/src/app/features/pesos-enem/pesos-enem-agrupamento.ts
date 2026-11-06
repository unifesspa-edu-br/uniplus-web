import { PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';

/** Agrupa as linhas por resolução e ordena cada grupo pela ordem dos grupos da API. Um código
 *  que a lista não traga vai para o fim, em vez de sumir da tela. */
export function agruparPorResolucao(
  pesos: readonly PesoAreaEnemDto[],
  ordemDosGrupos: ReadonlyMap<string, number>,
): Map<string, PesoAreaEnemDto[]> {
  const mapa = new Map<string, PesoAreaEnemDto[]>();
  for (const peso of pesos) {
    const grupo = mapa.get(peso.resolucao);
    if (grupo) {
      grupo.push(peso);
    } else {
      mapa.set(peso.resolucao, [peso]);
    }
  }
  const posicao = (linha: PesoAreaEnemDto): number =>
    ordemDosGrupos.get(linha.grupoCurso.codigo) ?? Number.MAX_SAFE_INTEGER;
  for (const linhas of mapa.values()) {
    linhas.sort((a, b) => posicao(a) - posicao(b));
  }
  return mapa;
}

function maxCriadoEm(linhas: readonly PesoAreaEnemDto[]): number {
  return linhas.reduce((max, linha) => Math.max(max, Date.parse(linha.criadoEm)), 0);
}

/** As resoluções da mais recente para a mais antiga; empate, pelo identificador. */
export function resolucoesDaMaisRecente(
  porResolucao: ReadonlyMap<string, readonly PesoAreaEnemDto[]>,
): string[] {
  return [...porResolucao.entries()]
    .sort(([resolucaoA, linhasA], [resolucaoB, linhasB]) => {
      const diff = maxCriadoEm(linhasB) - maxCriadoEm(linhasA);
      return diff !== 0 ? diff : resolucaoB.localeCompare(resolucaoA, 'pt-BR');
    })
    .map(([resolucao]) => resolucao);
}

/** Texto seguro para `id` de elemento, a partir do identificador da resolução. */
export function slug(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .toLowerCase();
}
