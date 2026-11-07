import { Signal, WritableSignal } from '@angular/core';
import {
  CursorPagina,
  ProblemDetails,
  ehCursorDePaginacaoExpirado,
  useCursorObsoletoRecovery,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';

export interface OpcoesDaRecuperacaoDeCursor {
  readonly problem: Signal<ProblemDetails | null>;
  readonly pagina: WritableSignal<CursorPagina | undefined>;
  readonly notificacoes: NotificationService;
}

/**
 * Cursor que não continua a consulta (400) ou que expirou (410): recomeça a paginação sem cursor e
 * avisa a pessoa, porque repetir a leitura com o mesmo cursor falharia sem fim. O sinal devolvido
 * é `true` no intervalo entre a resposta recusada e a nova leitura, e a listagem o soma a
 * `carregando` para a tentativa pedida não ser dada como concluída nem falha nesse intervalo.
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 */
export function recuperarDeCursorObsoleto(opcoes: OpcoesDaRecuperacaoDeCursor): Signal<boolean> {
  const { problem, pagina, notificacoes } = opcoes;
  return useCursorObsoletoRecovery({
    problem,
    pagina,
    reiniciarPagina: () => pagina.set(undefined),
    aoRecuperar: (recusado) =>
      notificacoes.info(
        recusado && ehCursorDePaginacaoExpirado(recusado)
          ? 'A listagem ficou aberta tempo demais e a consulta expirou.'
          : 'A paginação foi reiniciada porque a consulta mudou.',
        'Recarregamos a listagem do começo.',
      ),
  });
}
