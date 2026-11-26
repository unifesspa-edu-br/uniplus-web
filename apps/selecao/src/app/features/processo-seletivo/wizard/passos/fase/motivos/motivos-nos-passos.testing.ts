import type { HttpTestingController } from '@angular/common/http/testing';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';

/**
 * O que a seção de motivos da fase pede a quem monta um passo que a embute, em cenário de outro
 * assunto: a permissão efetiva, sempre negada, e a resposta vazia às leituras que ela faz ao abrir.
 */
export const SEM_PERMISSAO_PARA_OS_MOTIVOS = {
  provide: PermissoesService,
  useValue: { tem: (): boolean => false },
};

/** Responde, com listas vazias, ao cadastro de motivos e à escolha do processo. */
export function responderALeituraDosMotivos(controller: HttpTestingController): void {
  controller
    .match((pedido) => pedido.method === 'GET' && pedido.url.includes('/motivos-de-decisao'))
    .forEach((requisicao) => requisicao.flush([]));
}

/** O fechamento de um passo que não trata dos motivos: responde à leitura deles e confere que nada ficou aberto. */
export function conferirSemPendenciasDosMotivos(controller: HttpTestingController): void {
  responderALeituraDosMotivos(controller);
  controller.verify();
}
