import type { FaseDoCronograma } from '../../../processo-seletivo.models';

export interface BancaEscolhivel {
  readonly id: string;
  readonly nome: string;
}

/**
 * Bancas que o seletor oferece: as do cadastro, mais a que esta fase já exige
 * e saiu dele. A banca congelada continua fazendo parte do edital; fora da
 * lista, ela seguiria sendo enviada a cada gravação sem que o operador a
 * visse — nem pudesse tirá-la.
 */
export function bancasEscolhiveis(
  doCadastro: readonly BancaEscolhivel[],
  fase: FaseDoCronograma | null,
): readonly BancaEscolhivel[] {
  const conhecidas = new Set(doCadastro.map((banca) => banca.id));
  const codigoCongelado = new Map(
    (fase?.congelados?.bancas ?? []).map((banca) => [banca.id, banca.codigo]),
  );

  const congeladas = (fase?.bancasRequeridas ?? [])
    .map((banca) => banca.tipoBancaId)
    .filter((id) => id !== '' && !conhecidas.has(id))
    .map((id) => ({
      id,
      nome: `${codigoCongelado.get(id) ?? 'Banca'} (fora do cadastro atual)`,
    }));

  return [...doCadastro, ...congeladas];
}

export function nomeDaBanca(escolhiveis: readonly BancaEscolhivel[], tipoBancaId: string): string {
  return escolhiveis.find((banca) => banca.id === tipoBancaId)?.nome ?? tipoBancaId;
}
