import { STATUS_HTTP, ehRecusaDefinitiva, type ProblemDetails } from '@uniplus/shared-core/http';

/** Uma leitura que a página explica em vez de tentar de novo: o título e o texto para a pessoa. */
export interface RecusaDoComprovante {
  readonly titulo: string;
  readonly texto: string;
}

const INSCRICAO_CANCELADA = 'uniplus.selecao.inscricao.comprovante_de_inscricao_cancelada';
const VERSAO_AUSENTE = 'uniplus.selecao.snapshot.vigente_ausente';

export const COMPROVANTE_NAO_ENCONTRADO: RecusaDoComprovante = {
  titulo: 'Comprovante não encontrado',
  texto: 'Não encontramos este comprovante. Confira o endereço ou volte às suas inscrições.',
};

const SEM_ACESSO: RecusaDoComprovante = {
  titulo: 'Acesso negado',
  texto:
    'Este comprovante não está disponível para a sua conta. Entre com a conta que fez a inscrição ou volte às suas inscrições.',
};

const RECUSAS_DE_NEGOCIO = new Map<string, RecusaDoComprovante>([
  [
    INSCRICAO_CANCELADA,
    {
      titulo: 'Esta inscrição foi cancelada',
      texto:
        'Uma inscrição cancelada não tem comprovante para consultar ou imprimir. Na lista das suas inscrições você vê o número e a data do cancelamento.',
    },
  ],
  [
    VERSAO_AUSENTE,
    {
      titulo: 'Não foi possível montar o comprovante',
      texto:
        'O comprovante desta inscrição não pôde ser montado agora, e repetir não resolve. Sua inscrição continua registrada. Procure a Unifesspa e informe o número da inscrição.',
    },
  ],
]);

/**
 * A explicação da recusa da leitura, quando repetir não adianta: o comprovante que não existe ou não
 * é do titular (404, 401 e 403) e as duas recusas de negócio que o comprovante tem. Qualquer outra
 * falha segue como falha, com "Tentar novamente".
 */
export function recusaDoComprovante(problema: ProblemDetails): RecusaDoComprovante | null {
  if (ehRecusaDefinitiva(problema)) {
    return problema.status === STATUS_HTTP.NAO_ENCONTRADO ? COMPROVANTE_NAO_ENCONTRADO : SEM_ACESSO;
  }
  return problema.status === STATUS_HTTP.RECUSA_DE_NEGOCIO
    ? (RECUSAS_DE_NEGOCIO.get(problema.code) ?? null)
    : null;
}
