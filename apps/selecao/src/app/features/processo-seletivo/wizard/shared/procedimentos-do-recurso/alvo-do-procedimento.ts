import type { AlvoDoProcedimentoDeRecurso } from '../../processo-seletivo.models';

/** O alvo como o contrato o troca com a API: no máximo um dos dois campos vem preenchido. */
export interface AlvoNoContrato {
  readonly itemDeAvaliacaoId: string | null;
  readonly areaDoEnem: string | null;
}

/** Se os dois alvos contestam a mesma coisa; sem alvo, o tipo de decisão inteiro. */
export function mesmoAlvo(
  um: AlvoDoProcedimentoDeRecurso | null,
  outro: AlvoDoProcedimentoDeRecurso | null,
): boolean {
  if (um === null || outro === null) return um === outro;
  if ('itemDeAvaliacaoId' in um) {
    return 'itemDeAvaliacaoId' in outro && um.itemDeAvaliacaoId === outro.itemDeAvaliacaoId;
  }
  return 'areaDoEnem' in outro && um.areaDoEnem === outro.areaDoEnem;
}

/** O alvo que o servidor devolveu; sem item nem área, o procedimento vale para o tipo inteiro. */
export function alvoLidoDoServidor(
  alvo: AlvoNoContrato | null,
): AlvoDoProcedimentoDeRecurso | null {
  if (alvo?.itemDeAvaliacaoId) return { itemDeAvaliacaoId: alvo.itemDeAvaliacaoId };
  if (alvo?.areaDoEnem) return { areaDoEnem: alvo.areaDoEnem };
  return null;
}

/** O alvo como o comando o recebe: o campo que a forma não tem vai nulo. */
export function alvoParaComando(alvo: AlvoDoProcedimentoDeRecurso | null): AlvoNoContrato | null {
  if (alvo === null) return null;
  if ('itemDeAvaliacaoId' in alvo)
    return { itemDeAvaliacaoId: alvo.itemDeAvaliacaoId, areaDoEnem: null };
  return { itemDeAvaliacaoId: null, areaDoEnem: alvo.areaDoEnem };
}
