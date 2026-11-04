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
/**
 * A pergunta, uma só.
 *
 * A guarda da rota não é o único lugar onde o editor perde a transcrição: trocar de processo
 * mudando apenas o `:id` reusa a rota, o componente nunca é desativado, e a página faz a
 * limpeza por conta própria. Os dois caminhos perguntam a mesma coisa, com as mesmas palavras.
 */
export const AVISO_DE_RASCUNHO_NAO_GRAVADO =
  'O rascunho da publicação tem alterações que ainda não foram salvas. Sair agora descarta o que você transcreveu.';

export const rascunhoNaoGravadoGuard: CanDeactivateFn<ProcessoSeletivoPage> = (pagina) => {
  if (!pagina.rascunhoPendente()) return true;

  return inject(ConfirmacaoDeSaida).confirmar(AVISO_DE_RASCUNHO_NAO_GRAVADO);
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
