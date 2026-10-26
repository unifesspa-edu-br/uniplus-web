import { HttpEventType, type HttpResponse } from '@angular/common/http';
import { isApiOk, type ApiResult } from './api-result';
import type { ProblemDetails } from './problem-details';
import type { SignedUploadClient } from './signed-upload';

/**
 * O envio direto ao storage que o edital, o modelo de documento e os documentos da inscrição compartilham: a API registra
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

/**
 * `etag` é o `ETag` da resposta do PUT, que identifica a versão do objeto gravado; nulo quando o
 * storage não o expõe ao navegador (CORS sem `ExposeHeaders`).
 */
export type ResultadoEnvio = { readonly ok: true; readonly etag: string | null } | EnvioFalhou;

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
    let etag: string | null = null;
    upload.enviar(destino.urlUpload, arquivo, destino.contentTypeExigido).subscribe({
      next: (evento) => {
        if (evento.type === HttpEventType.UploadProgress) {
          onProgresso(percentualDe(evento.loaded, evento.total));
        } else if (evento.type === HttpEventType.Response) {
          etag = (evento as HttpResponse<unknown>).headers.get('ETag');
        }
      },
      error: (erro: unknown) => {
        const status = statusDe(erro);
        resolve({
          ok: false,
          status,
          expirada: status === STATUS_ASSINATURA_RECUSADA_PELO_STORAGE,
        });
      },
      complete: () => {
        onProgresso(100);
        resolve({ ok: true, etag });
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

/** Como terminou o pedido de download de um arquivo confirmado. */
export type DesfechoDoDownload =
  | { readonly situacao: 'iniciado' }
  | { readonly situacao: 'recusado'; readonly problem: ProblemDetails }
  | { readonly situacao: 'falhou' };

/** O que a URL assinada entregou: o conteúdo e o nome que o armazenamento assinou para ele. */
export interface ArquivoBaixado {
  readonly conteudo: Blob;
  readonly nome: string | null;
}

/**
 * O nome do arquivo na disposição de conteúdo assinada (`filename*=UTF-8''…`, RFC 5987); nulo
 * quando ela não traz um nome legível.
 */
export function nomeDaDisposicao(disposicao: string | null): string | null {
  const codificado = /filename\*=UTF-8''([^;]+)/i.exec(disposicao ?? '')?.[1];
  if (codificado === undefined) return null;
  try {
    return decodeURIComponent(codificado.trim());
  } catch {
    return null;
  }
}

/** Busca o arquivo na URL assinada; nulo quando o armazenamento recusa ou não responde. */
async function buscarNoArmazenamento(url: string): Promise<ArquivoBaixado | null> {
  try {
    const resposta = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!resposta.ok) return null;
    return {
      conteudo: await resposta.blob(),
      nome: nomeDaDisposicao(resposta.headers.get('Content-Disposition')),
    };
  } catch {
    return null;
  }
}

/**
 * Grava o arquivo a partir de um endereço local. O link entra na página para o clique valer em todo
 * navegador, e o endereço só é liberado depois que o download começa.
 */
function salvarComoArquivo(arquivo: ArquivoBaixado): void {
  const endereco = URL.createObjectURL(arquivo.conteudo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = arquivo.nome ?? 'arquivo';
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco));
}

/**
 * Baixa um arquivo confirmado pedindo o acesso à API no clique. O conteúdo vem pela própria página
 * e é salvo de um endereço local: o armazenamento responde em HTTP e levar a janela até ele faria
 * o navegador tratar o anexo como download inseguro de uma página HTTPS. Pelo mesmo motivo de
 * `abrirAcessoEmNovaAba`, a URL é credencial: vive só nesta chamada e nada a retém.
 */
export async function baixarPeloAcesso(
  pedirAcesso: () => Promise<ApiResult<{ readonly url: string }>>,
  buscar: (url: string) => Promise<ArquivoBaixado | null> = buscarNoArmazenamento,
  salvar: (arquivo: ArquivoBaixado) => void = salvarComoArquivo,
): Promise<DesfechoDoDownload> {
  const resultado = await pedirAcesso();
  if (!isApiOk(resultado)) return { situacao: 'recusado', problem: resultado.problem };
  const arquivo = await buscar(resultado.data.url);
  if (arquivo === null) return { situacao: 'falhou' };
  salvar(arquivo);
  return { situacao: 'iniciado' };
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
