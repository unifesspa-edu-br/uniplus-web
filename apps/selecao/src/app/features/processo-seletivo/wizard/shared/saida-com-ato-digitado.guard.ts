import { Injectable, inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import type { ProcessoSeletivoPage } from '../../processo-seletivo.page';

/**
 * A pergunta, uma só.
 *
 * O ato digitado na Revisão vive só na memória da página: não é guardado com o rascunho, e sair
 * o descarta. Trocar de processo mudando apenas o `:id` reusa a rota, o componente nunca é
 * desativado e a página limpa o editor por conta própria; a guarda da rota e essa troca perguntam
 * a mesma coisa, com as mesmas palavras.
 */
export const AVISO_DE_ATO_DIGITADO =
  'O ato da publicação e os anexos que você preencheu ainda não foram publicados e não ficam guardados. Se sair agora, tudo o que foi preenchido será perdido.';

/**
 * Pergunta apenas quando há ato digitado a perder, para o aviso não virar ruído que se aprende a
 * ignorar. Recarregar ou fechar a aba o roteador não enxerga: é do `beforeunload` da página.
 * Trocar de passo dentro do wizard também não perde nada.
 */
export const saidaComAtoDigitadoGuard: CanDeactivateFn<ProcessoSeletivoPage> = (pagina) => {
  if (!pagina.atoDigitadoPendente()) return true;

  return inject(ConfirmacaoDeSaida).confirmar(AVISO_DE_ATO_DIGITADO);
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
