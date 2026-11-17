import type { DocumentoDaConfiguracaoProcedimentoDeRecurso } from '@uniplus/shared-data/selecao';

import type { IdentidadeDoProcedimento } from '../../documento/edicoes/procedimentos-de-recurso.edicao';

type Procedimento = DocumentoDaConfiguracaoProcedimentoDeRecurso;
type Alvo = Procedimento['alvo'] | null;

/** A ausência de alvo, inclusive um objeto vazio importado, representa a decisão inteira. */
export function mesmoAlvo(um: Alvo, outro: Alvo): boolean {
  return (
    um?.itemDeAvaliacaoChave === outro?.itemDeAvaliacaoChave && um?.areaDoEnem === outro?.areaDoEnem
  );
}

/** Confere somente a janela recebida; procedimentos de outro produtor não participam. */
export function impedimentoDaDeclaracao(
  procedimentos: readonly Procedimento[],
  identidade: IdentidadeDoProcedimento,
): 'duplicado' | 'conflitante' | null {
  const doTipo = procedimentos.filter((atual) => atual.tipoDeDecisao === identidade.tipoDeDecisao);
  if (doTipo.some((atual) => mesmoAlvo(atual.alvo, identidade.alvo))) return 'duplicado';
  const inteiro = mesmoAlvo(identidade.alvo, null);
  return doTipo.some((atual) => mesmoAlvo(atual.alvo, null) !== inteiro) ? 'conflitante' : null;
}
