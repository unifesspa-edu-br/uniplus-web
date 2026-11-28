import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

/**
 * Guarda a recusa sob a chave do controle que a corrige, na ordem em que chega, e só uma vez: a
 * mesma mensagem com o mesmo código não informa nada a mais ao lado do campo.
 */
export function acrescentarRecusaDoControle<Chave>(
  porControle: Map<Chave, RecusaDoCampo[]>,
  chave: Chave,
  recusa: RecusaDoCampo,
): void {
  const recusas = porControle.get(chave) ?? [];
  if (!recusas.some((r) => r.mensagem === recusa.mensagem && r.codigo === recusa.codigo)) {
    recusas.push(recusa);
  }
  porControle.set(chave, recusas);
}
