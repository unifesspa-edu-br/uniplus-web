import { STATUS_HTTP, type ProblemDetails } from '@uniplus/shared-core/http';
import type { RecusaDoComprovante } from '@uniplus/shared-inscricao/comprovante';

export const COMPROVANTE_NAO_ENCONTRADO: RecusaDoComprovante = {
  titulo: 'Comprovante não encontrado',
  texto:
    'Este comprovante não existe nesta inscrição ou não está disponível para você. Confira o endereço ou volte à inscrição.',
};

/**
 * A explicação da recusa da leitura, quando repetir não adianta: o comprovante que não existe ou não
 * está ao alcance da pessoa (404). Quem não pode emitir não chega aqui: a rota o leva a "Acesso
 * negado" antes da leitura. Qualquer outra falha segue como falha, com "Tentar novamente".
 */
export function recusaDoComprovante(problema: ProblemDetails): RecusaDoComprovante | null {
  return problema.status === STATUS_HTTP.NAO_ENCONTRADO ? COMPROVANTE_NAO_ENCONTRADO : null;
}
