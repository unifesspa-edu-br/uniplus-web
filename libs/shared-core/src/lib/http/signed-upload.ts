import { HttpBackend, HttpClient, HttpEvent, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Envia arquivo direto a um storage compatível com S3, por URL pré-assinada.
 *
 * Não é cliente de API do Uni+ e por isso não devolve `ApiResult`: o destino é
 * o storage, a resposta de erro é XML do próprio serviço e não `ProblemDetails`,
 * e o chamador precisa dos eventos de progresso do envio.
 *
 * Roda sobre `HttpBackend`, fora da cadeia de interceptors da aplicação. Isso é
 * deliberado:
 *
 * - o `authErrorInterceptor` navegaria para `/acesso-negado` diante do 403 com
 *   que o storage recusa assinatura inválida (na prática, URL expirada), em vez
 *   de deixar o chamador pedir uma URL nova;
 * - o `apiResultInterceptor` envelopa a resposta e transformaria o erro em
 *   resposta de sucesso com `ApiFailure` dentro;
 * - o `tokenInterceptor` não deve ser consultado para um destino que jamais
 *   recebe o Bearer da aplicação;
 * - o `loadingInterceptor` prenderia o spinner global durante todo o envio.
 */
@Injectable({ providedIn: 'root' })
export class SignedUploadClient {
  private readonly http = new HttpClient(inject(HttpBackend));

  /**
   * `contentType` tem de ser exatamente o exigido por quem assinou a URL — o
   * header entra na assinatura SigV4, e qualquer divergência é recusada com
   * `SignatureDoesNotMatch` antes de qualquer validação de negócio.
   */
  enviar(url: string, arquivo: Blob, contentType: string): Observable<HttpEvent<unknown>> {
    return this.http.put(url, arquivo, {
      headers: new HttpHeaders({ 'Content-Type': contentType }),
      observe: 'events',
      reportProgress: true,
    });
  }
}
