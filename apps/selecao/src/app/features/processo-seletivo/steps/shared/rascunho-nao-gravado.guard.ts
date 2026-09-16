import { Injectable, inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import type { ProcessoSeletivoPage } from '../../processo-seletivo.page';

/**
 * Impede que sair do editor apague, sem aviso, o bloco do ato que o operador transcreveu do
 * Diário Oficial e ainda não gravou.
 *
 * Pergunta apenas quando há **edição não gravada**, nunca quando há "algo digitado": um aviso
 * que dispara toda vez que existe texto na tela é o aviso que se aprende a descartar sem ler.
 *
 * Não cobre recarregar nem fechar a aba — isso o roteador não enxerga, e é do `beforeunload` da
 * própria página. Também não cobre trocar de passo dentro do wizard, que não perde nada.
 */
export const rascunhoNaoGravadoGuard: CanDeactivateFn<ProcessoSeletivoPage> = (pagina) => {
  if (!pagina.rascunhoPendente()) return true;

  return inject(ConfirmacaoDeSaida).confirmar(
    'O rascunho da publicação tem alterações que ainda não foram salvas. Sair agora descarta o que você transcreveu.',
  );
};

/**
 * A pergunta em si, isolada num serviço para que o teste da guarda possa responder sem abrir um
 * diálogo nativo — `window.confirm` não é substituível de dentro do spec.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmacaoDeSaida {
  confirmar(mensagem: string): boolean {
    return globalThis.confirm(mensagem);
  }
}
