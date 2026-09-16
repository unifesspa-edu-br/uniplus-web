import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type FatoCandidatoView = components['schemas']['FatoCandidatoView'];
export type FatoValorDominioViewItem = components['schemas']['FatoValorDominioViewItem'];

/**
 * Cliente do catálogo de fatos do candidato — o vocabulário fechado que uma exigência
 * documental cita para dizer de quem ela é cobrada.
 *
 * É catálogo **semeado e governado por código**, não cadastro administrativo: acrescentar um
 * fato é mudança de software, porque um fato só serve se existir o código que sabe resolver o
 * valor dele. Por isso a lista não se escreve no frontend — cada fato traz o domínio, a
 * cardinalidade e os valores declarados, que é exatamente o que a tela precisa para oferecer
 * os operadores certos e as opções certas.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`;
 * versionamento por vendor MIME.
 */
@Injectable({ providedIn: 'root' })
export class FatosCandidatoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/fatos-candidato` — o catálogo inteiro. Conjunto fechado, sem paginação. */
  listar(): Observable<ApiResult<readonly FatoCandidatoView[]>> {
    return this.http.get<ApiResult<readonly FatoCandidatoView[]>>(
      `${this.basePath}/api/configuracao/fatos-candidato`,
      { context: withVendorMime('fato-candidato', 1) },
    );
  }
}
