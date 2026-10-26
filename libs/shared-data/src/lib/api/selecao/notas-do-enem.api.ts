import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

export type LeiauteDoInepDto = components['schemas']['LeiauteDoInepDto'];
export type GeracaoDeEnvioDto = components['schemas']['GeracaoDeEnvioDto'];
export type OpcaoDeCursoDoLoteDto = components['schemas']['OpcaoDeCursoDoLoteDto'];
export type AusenteDoLoteDto = components['schemas']['AusenteDoLoteDto'];
export type OcorrenciaDoLoteDto = components['schemas']['OcorrenciaDoLoteDto'];
export type LoteDeNotasDoEnemDto = components['schemas']['LoteDeNotasDoEnemDto'];

/** O leiaute escolhido no catálogo: o par que a API usa para identificá-lo. */
export interface LeiauteEscolhido {
  readonly leiauteCodigo: string;
  readonly leiauteVersao: string;
}

export type TipoDeLeiaute = 'envio' | 'retorno';

/**
 * Cliente do envio de CPFs ao INEP e da importação das notas do ENEM, por etapa e edição do
 * processo seletivo.
 */
@Injectable({ providedIn: 'root' })
export class NotasDoEnemApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** GET `/api/selecao/leiautes-de-arquivo-do-inep` — o catálogo de leiautes ativos do tipo. */
  listarLeiautes(tipo: TipoDeLeiaute): Observable<ApiResult<readonly LeiauteDoInepDto[]>> {
    return this.http.get<ApiResult<readonly LeiauteDoInepDto[]>>(
      `${this.basePath}/api/selecao/leiautes-de-arquivo-do-inep`,
      {
        params: new HttpParams().set('tipo', tipo),
        context: withVendorMime('leiaute-de-arquivo-do-inep', 1),
      },
    );
  }

  /**
   * POST `…/envios-ao-inep` — gera o arquivo de envio e devolve o texto dele, um CPF por linha.
   *
   * A resposta é texto: com `observe: 'body'` o `HttpClient` rejeitaria o envelope que o
   * interceptor coloca no lugar do corpo, e com `blob` o `problem+json` de uma recusa chegaria
   * ilegível. Sem `Idempotency-Key`, de propósito: a chave guardaria a resposta, que é a lista de
   * CPFs, e cada geração é um ato registrado.
   */
  gerarEnvio(
    processoSeletivoId: string,
    etapaId: string,
    edicao: string,
    leiaute: LeiauteEscolhido,
  ): Observable<ApiResult<string>> {
    return this.http
      .post(`${this.rota(processoSeletivoId, etapaId, edicao)}/envios-ao-inep`, leiaute, {
        responseType: 'text',
        observe: 'response',
      })
      .pipe(map((resposta) => resposta.body as unknown as ApiResult<string>));
  }

  /** GET `…/envios-ao-inep` — as gerações de envio da edição, da mais recente para a mais antiga. */
  listarEnvios(
    processoSeletivoId: string,
    etapaId: string,
    edicao: string,
  ): Observable<ApiResult<readonly GeracaoDeEnvioDto[]>> {
    return this.http.get<ApiResult<readonly GeracaoDeEnvioDto[]>>(
      `${this.rota(processoSeletivoId, etapaId, edicao)}/envios-ao-inep`,
      { context: withVendorMime('envio-ao-inep', 1) },
    );
  }

  /**
   * POST `…/lotes-de-notas` — importa o arquivo de retorno do INEP. Devolve o lote com as
   * ocorrências: 201 quando o lote é novo, 200 quando o arquivo é o do lote vigente.
   *
   * O `Content-Type` multipart é definido pelo navegador, com o boundary. Sem `Idempotency-Key`:
   * reenviar o mesmo arquivo já é idempotente pelo hash dele.
   */
  importarNotas(
    processoSeletivoId: string,
    etapaId: string,
    edicao: string,
    arquivo: File,
    leiaute: LeiauteEscolhido,
  ): Observable<ApiResult<LoteDeNotasDoEnemDto>> {
    const formulario = new FormData();
    formulario.append('arquivo', arquivo, arquivo.name);
    formulario.append('leiauteCodigo', leiaute.leiauteCodigo);
    formulario.append('leiauteVersao', leiaute.leiauteVersao);
    return this.http.post<ApiResult<LoteDeNotasDoEnemDto>>(
      `${this.rota(processoSeletivoId, etapaId, edicao)}/lotes-de-notas`,
      formulario,
      { context: withVendorMime('lote-de-notas-do-enem', 1) },
    );
  }

  /** GET `…/lotes-de-notas` — os lotes da edição, sem as ocorrências. */
  listarLotes(
    processoSeletivoId: string,
    etapaId: string,
    edicao: string,
  ): Observable<ApiResult<readonly LoteDeNotasDoEnemDto[]>> {
    return this.http.get<ApiResult<readonly LoteDeNotasDoEnemDto[]>>(
      `${this.rota(processoSeletivoId, etapaId, edicao)}/lotes-de-notas`,
      { context: withVendorMime('lote-de-notas-do-enem', 1) },
    );
  }

  /** GET `…/lotes-de-notas/{loteId}` — um lote com as ocorrências. */
  obterLote(
    processoSeletivoId: string,
    etapaId: string,
    edicao: string,
    loteId: string,
  ): Observable<ApiResult<LoteDeNotasDoEnemDto>> {
    return this.http.get<ApiResult<LoteDeNotasDoEnemDto>>(
      `${this.rota(processoSeletivoId, etapaId, edicao)}/lotes-de-notas/${encodeURIComponent(loteId)}`,
      { context: withVendorMime('lote-de-notas-do-enem', 1) },
    );
  }

  private rota(processoSeletivoId: string, etapaId: string, edicao: string): string {
    return (
      `${this.basePath}/api/selecao/processos-seletivos/${encodeURIComponent(processoSeletivoId)}` +
      `/etapas/${encodeURIComponent(etapaId)}/edicoes-do-enem/${encodeURIComponent(edicao)}`
    );
  }
}
