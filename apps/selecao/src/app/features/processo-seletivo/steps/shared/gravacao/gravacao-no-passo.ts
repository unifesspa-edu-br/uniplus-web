import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

/**
 * Resposta de um passo cuja gravação terminou depois de o editor passar a outro processo. A
 * página a trata como descarte calado: não há o que exibir nem o que concluir.
 */
export const RESPOSTA_DESCARTADA = Object.freeze({
  valid: false as const,
  messages: [] as never[],
});

export type RespostaDescartada = typeof RESPOSTA_DESCARTADA;

export function respostaFoiDescartada<T>(
  resposta: T | RespostaDescartada,
): resposta is RespostaDescartada {
  return resposta === RESPOSTA_DESCARTADA;
}

/**
 * Envelope de gravação dos passos: trava a edição enquanto o comando corre e descarta a resposta
 * que descreve o processo anterior, pois anunciá-la contaminaria a tela nova. Quem destrava é a
 * geração que travou: o editor novo pode ter comando próprio em curso.
 */
export async function gravarNoPasso<T>(
  store: ProcessoSeletivoStore,
  corpo: () => Promise<T>,
): Promise<T | RespostaDescartada> {
  const geracao = store.geracao();
  store.salvando.set(true);
  try {
    const resposta = await corpo();
    return geracao === store.geracao() ? resposta : RESPOSTA_DESCARTADA;
  } finally {
    if (geracao === store.geracao()) store.salvando.set(false);
  }
}
