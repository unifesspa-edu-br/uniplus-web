import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import type { OpcaoDaRegra } from './vocabularios-da-regra.service';

type Campo = keyof NonNullable<RegraDeDeliberacaoDaBanca['rotulos']>;

export function opcoesComValorAtual(
  opcoes: readonly OpcaoDaRegra[],
  regra: RegraDeDeliberacaoDaBanca | null,
  campo: Campo,
): readonly OpcaoDaRegra[] {
  const codigo = regra?.[campo];
  if (!codigo || opcoes.some((opcao) => opcao.codigo === codigo)) return opcoes;
  const lido = regra?.rotulos?.[campo];
  const rotulo = lido?.codigo === codigo && lido.rotulo ? lido.rotulo : 'Valor não reconhecido';
  return [...opcoes, { codigo, rotulo }];
}
