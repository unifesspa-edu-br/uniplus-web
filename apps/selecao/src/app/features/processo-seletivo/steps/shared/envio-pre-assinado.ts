import { HttpEventType } from '@angular/common/http';
import {
  isApiOk,
  type ApiResult,
  type ProblemDetails,
  type SignedUploadClient,
} from '@uniplus/shared-core/http';

/**
 * O envio direto ao storage que o edital e o modelo de documento compartilham: a API registra
 * o arquivo pendente e devolve uma URL pré-assinada de PUT; o navegador envia os bytes direto ao
 * object store, sem passar pela API; a API confirma lendo o objeto e o sela como imutável. A
 * conferência do arquivo confirmado segue o mesmo desenho — uma URL de leitura emitida por
 * pedido, com prazo curto.
 */

/** O que a iniciação devolve para o PUT: a URL assinada, o content type que ela exige e o prazo. */
export interface DestinoPreAssinado {
  readonly urlUpload: string;
  readonly contentTypeExigido: string;
  readonly expiraEm: string;
}

/**
 * Falha do envio ao storage. `expirada` separa o caso em que repetir o mesmo PUT é inútil — a
 * assinatura da URL não volta a valer.
 */
export interface EnvioFalhou {
  readonly ok: false;
  readonly status: number;
  readonly expirada: boolean;
}

export type ResultadoEnvio = { readonly ok: true } | EnvioFalhou;

/**
 * O PUT ao storage não passa pelos interceptors nem pelo contrato REST do Uni+: quem responde é o
 * object store, e ele recusa assinatura inválida com 403. `STATUS_HTTP` cataloga o que a
 * `uniplus-api` devolve, e lá 403 é falta de papel na rota — outra coisa. O nome fica local para
 * não afirmar a autorização da aplicação onde ela não está em jogo.
 */
const STATUS_ASSINATURA_RECUSADA_PELO_STORAGE = 403;

/**
 * Envia o arquivo direto ao storage, relatando o progresso em percentual.
 *
 * A falha chega como erro HTTP de verdade, porque o PUT não passa pelos interceptors. 403 é como o
 * storage recusa assinatura inválida — na prática, URL expirada: repetir o mesmo PUT nunca
 * funciona, e quem chama precisa recomeçar da iniciação.
 */
export function enviarAoStorage(
  upload: SignedUploadClient,
  destino: DestinoPreAssinado,
  arquivo: File,
  onProgresso: (percentual: number) => void,
): Promise<ResultadoEnvio> {
  return new Promise<ResultadoEnvio>((resolve) => {
    upload.enviar(destino.urlUpload, arquivo, destino.contentTypeExigido).subscribe({
      next: (evento) => {
        if (evento.type === HttpEventType.UploadProgress) {
          onProgresso(percentualDe(evento.loaded, evento.total));
        }
      },
      error: (erro: unknown) => {
        const status = statusDe(erro);
        resolve({ ok: false, status, expirada: status === STATUS_ASSINATURA_RECUSADA_PELO_STORAGE });
      },
      complete: () => {
        onProgresso(100);
        resolve({ ok: true });
      },
    });
  });
}

/** A URL pré-assinada tem TTL curto; passado o prazo, só uma nova iniciação serve. */
export function destinoExpirado(destino: Pick<DestinoPreAssinado, 'expiraEm'>): boolean {
  const expiraEm = Date.parse(destino.expiraEm);
  return Number.isNaN(expiraEm) || expiraEm <= Date.now();
}

/** Como terminou o pedido de abertura de um arquivo confirmado. */
export type DesfechoDaAbertura =
  | { readonly situacao: 'aberta' }
  | { readonly situacao: 'bloqueada' }
  | { readonly situacao: 'abandonada' }
  | { readonly situacao: 'recusada'; readonly problem: ProblemDetails };

/**
 * Abre um arquivo confirmado numa aba nova, pedindo o acesso à API no clique.
 *
 * A URL assinada é credencial de acesso ao objeto: não vai para o store, não é guardada em campo
 * de componente e não vira `href` de link — o servidor a emite por pedido justamente para que o
 * prazo comece agora e para que ela não sobreviva à ação. Sai daqui direto para a aba e nada mais
 * a retém.
 *
 * Tem de ser chamada dentro do clique: a aba nasce antes do primeiro `await`.
 *
 * @param aindaVale se a tela ainda trata do mesmo processo quando o acesso chega; abrir depois de
 *   o editor passar a outro mostraria o arquivo de um processo que já saiu da tela.
 */
export async function abrirAcessoEmNovaAba(
  pedirAcesso: () => Promise<ApiResult<{ readonly url: string }>>,
  aindaVale: () => boolean,
): Promise<DesfechoDaAbertura> {
  // A aba nasce aqui, ainda dentro do clique. Abri-la depois do `await` custaria a ativação do
  // usuário que o navegador exige, e o bloqueador de pop-ups recusaria a abertura justamente no
  // caminho feliz — sem erro de API para explicar por que nada aconteceu.
  //
  // Sem `noopener` na chamada, e de propósito: com ele `window.open` devolve `null` por
  // especificação, e é justamente a referência que se precisa para levar a aba ao endereço quando
  // ele chegar. O desacoplamento vem depois, zerando `opener` antes de navegar.
  const aba = window.open('', '_blank');
  // Recusa antes de pedir o acesso: a URL é emitida por requisição, com o prazo correndo a partir
  // dela, e pedir uma que não será usada é exatamente o que o endpoint sob demanda existe para
  // evitar.
  if (aba === null) return { situacao: 'bloqueada' };

  try {
    const resultado = await pedirAcesso();
    if (!aindaVale()) {
      aba.close();
      return { situacao: 'abandonada' };
    }
    if (!isApiOk(resultado)) {
      aba.close();
      return { situacao: 'recusada', problem: resultado.problem };
    }

    // Zerado antes de navegar: a aba passa a carregar um endereço assinado do storage, fora do
    // controle da aplicação, e não deve alcançar esta janela pelo `window.opener`.
    aba.opener = null;
    aba.location.href = resultado.data.url;
    return { situacao: 'aberta' };
  } catch (erro) {
    aba.close();
    throw erro;
  }
}

function percentualDe(loaded: number, total: number | undefined): number {
  if (total === undefined || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

function statusDe(erro: unknown): number {
  if (typeof erro === 'object' && erro !== null && 'status' in erro) {
    const status = (erro as { status: unknown }).status;
    return typeof status === 'number' ? status : 0;
  }
  return 0;
}
