import { inject } from '@angular/core';
import {
  criarVocabulario,
  VocabulariosDeConfiguracaoApi,
  type VocabulariosDeConfiguracao,
  type Vocabulario,
} from '@uniplus/shared-data/configuracao';
import { acompanharLeitura } from '@uniplus/shared-ui/components';

export function lerVocabularioDoFato<K extends keyof VocabulariosDeConfiguracao>(
  nome: K,
  assunto: string,
  id: string,
) {
  const api = inject(VocabulariosDeConfiguracaoApi);
  const vocabulario = criarVocabulario(
    () => api.listar(nome),
    `Não foi possível carregar ${assunto}.`,
  );
  const leitura = acompanharVocabulario(vocabulario, assunto, id);
  vocabulario.carregar();
  return { vocabulario, leitura };
}

function acompanharVocabulario<K extends keyof VocabulariosDeConfiguracao>(
  vocabulario: Vocabulario<VocabulariosDeConfiguracao[K]>,
  assunto: string,
  id: string,
) {
  return acompanharLeitura({
    falha: vocabulario.erro,
    pendente: vocabulario.carregando,
    recarregar: () => vocabulario.recarregar(),
    destino: () => document.getElementById(id),
    assunto,
  });
}

/** Mantém na lista o valor já gravado, para que ele continue visível se a lista não chegou ou mudou. */
export function comOpcaoAtual<T extends { readonly codigo: string }>(
  itens: readonly T[],
  atual: T | null | undefined,
): readonly T[] {
  if (!atual || itens.some((item) => item.codigo === atual.codigo)) return itens;
  return [atual, ...itens];
}
