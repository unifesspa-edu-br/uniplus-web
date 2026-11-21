import { haRecusaAtiva, type RecusaOrdenada } from '../recusas/ordem-das-recusas';

/** O que a tela mostra e declara a quem usa leitor de tela para um controle da regra da banca. */
export interface EstadoDoControle {
  /** A conferência feita na tela. */
  readonly erro: string | undefined;
  readonly recusas: readonly RecusaOrdenada[];
  /** Há erro da tela ou recusa que ainda vale. */
  readonly invalido: boolean;
  /** Os `id` que descrevem o controle: a dica, o erro da tela e as recusas do servidor. */
  readonly descritoPor: string | null;
}

function idsQueDescrevem(
  id: string,
  dica: boolean,
  erro: boolean,
  recusas: boolean,
): string | null {
  const ids = [
    ...(dica ? [`${id}-dica`] : []),
    ...(erro ? [`${id}-erro`] : []),
    ...(recusas ? [`${id}-recusas`] : []),
  ];
  return ids.length === 0 ? null : ids.join(' ');
}

/** Reúne o erro da tela e as recusas do servidor de um controle, ligados ao `id` dele. */
export function estadoDoControle(
  id: string,
  erroDaTela: string | undefined,
  recusas: readonly RecusaOrdenada[],
  comDica = false,
): EstadoDoControle {
  return {
    erro: erroDaTela,
    recusas,
    invalido: !!erroDaTela || haRecusaAtiva(recusas),
    descritoPor: idsQueDescrevem(id, comDica, erroDaTela !== undefined, recusas.length > 0),
  };
}
