import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type AvaliacaoPortavel = components['schemas']['AvaliacaoPortavel'];
export type FormularioPortavel = components['schemas']['FormularioPortavel'];

/**
 * As regras de um formulário e as respostas simuladas. As regras vão como vieram — de um arquivo
 * importado, de um modelo ou de um processo — porque é a API que confere a forma delas; os
 * dicionários de respostas levam o valor em JSON, que o schema gerado tipa como `Record<string, never>`.
 */
export interface AvaliacaoDeFormularioInput {
  readonly regras: unknown;
  readonly respostas: Readonly<Record<string, unknown>> | null;
  readonly grupos: Readonly<
    Record<
      string,
      | readonly {
          readonly id: string;
          readonly respostas?: Readonly<Record<string, unknown>> | null;
        }[]
      | null
    >
  > | null;
  readonly etapasConcluidas: readonly string[] | null;
  readonly pressupostos: Readonly<Record<string, unknown>> | null;
}

/**
 * A avaliação autoritativa de um formulário sem cadastro (ADR-0139 da API): o mesmo avaliador da
 * inscrição, sem gravar nada, para a simulação conferir o que o interpretador do front decidiu.
 */
@Injectable({ providedIn: 'root' })
export class AvaliacoesDeFormularioApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** POST `/api/configuracao/admin/avaliacoes-de-formulario` — é leitura: não leva Idempotency-Key. */
  avaliar(input: AvaliacaoDeFormularioInput): Observable<ApiResult<AvaliacaoPortavel>> {
    return this.http.post<ApiResult<AvaliacaoPortavel>>(
      `${this.basePath}/api/configuracao/admin/avaliacoes-de-formulario`,
      input,
      {
        context: withVendorMime('avaliacao-de-formulario', 1),
      },
    );
  }
}
