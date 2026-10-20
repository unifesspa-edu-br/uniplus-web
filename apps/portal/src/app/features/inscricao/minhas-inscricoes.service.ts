import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, type Observable, of, switchMap, tap } from 'rxjs';
import { type ApiResult, apiOk } from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { GeoApi } from '@uniplus/shared-data/geo';
import {
  certamePublicoRequest,
  type CertamePublicadoDto,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  InscricoesApi,
  type MinhaInscricaoDto,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';

/** As inscrições do candidato, os comprovantes de cada uma e o que se faz com elas: descartar e cancelar. */
@Injectable({ providedIn: 'root' })
export class MinhasInscricoesService {
  private readonly api = inject(InscricoesApi);
  private readonly geo = inject(GeoApi);
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private cancelamentoEmCurso: { readonly chave: string; readonly assinatura: string } | null =
    null;

  /** As inscrições do dono do token, cada uma com os comprovantes emitidos, em ordem de emissão. */
  listar(): Observable<ApiResult<readonly MinhaInscricaoDto[]>> {
    return this.api.minhas();
  }

  /**
   * O certame publicado do processo; nulo quando não está publicado (404). As demais falhas seguem
   * como falha: tomá-las por "não publicado" esconderia o curso e o prazo sem oferecer nova tentativa.
   */
  certame(processoId: string): Observable<ApiResult<CertamePublicadoDto | null>> {
    const { url, context } = certamePublicoRequest(this.basePath, processoId);
    return this.http
      .get<ApiResult<CertamePublicadoDto>>(url, { context })
      .pipe(
        map((certame) =>
          !certame.ok && certame.status === 404
            ? apiOk(null, certame.status, certame.headers)
            : certame,
        ),
      );
  }

  /** O formulário da versão que a inscrição fixou: dá os rótulos do que o comprovante mostra. */
  formulario(processoId: string): Observable<ApiResult<FormularioRenderizavelDto>> {
    return this.api.obterFormulario(processoId);
  }

  /**
   * Os municípios pelo código IBGE, como "Nome — UF", com uma leitura por código. O que o Geo não
   * devolve fica de fora: quem mostra cai no código.
   */
  nomesDosMunicipios(codigos: readonly string[]): Observable<ReadonlyMap<string, string>> {
    if (codigos.length === 0) return of(new Map());
    return forkJoin(
      codigos.map((codigo) =>
        this.geo
          .obterCidade(codigo)
          .pipe(
            map((cidade) =>
              cidade.ok ? [[codigo, `${cidade.data.nome} — ${cidade.data.uf}`] as const] : [],
            ),
          ),
      ),
    ).pipe(map((nomes) => new Map(nomes.flat())));
  }

  /** O comprovante do envio `numero` da inscrição `inscricaoId`, também a cancelada. */
  comprovante(inscricaoId: string, numero: number): Observable<ApiResult<ComprovanteInscricaoDto>> {
    return this.api.obterComprovante(inscricaoId, numero);
  }

  /** Descarta o rascunho do processo, com o ETag que a inscrição tem agora. */
  descartar(processoId: string): Observable<ApiResult<void>> {
    return this.comETagAtual(processoId, (eTag) => this.api.descartar(processoId, eTag));
  }

  /**
   * Cancela a inscrição enviada do processo. A mesma Idempotency-Key acompanha a repetição do mesmo
   * pedido (rede que cai), e uma nova vale quando a falha já registrou resposta na API.
   */
  cancelar(processoId: string, motivo: string | null): Observable<ApiResult<void>> {
    const assinatura = JSON.stringify([processoId, motivo]);
    if (this.cancelamentoEmCurso?.assinatura !== assinatura) {
      this.cancelamentoEmCurso = { chave: idempotencyKey.create(), assinatura };
    }
    const { chave } = this.cancelamentoEmCurso;
    return this.comETagAtual(processoId, (eTag) =>
      this.api.cancelar(processoId, { motivo }, eTag, withIdempotencyKey(chave)),
    ).pipe(
      tap((resultado) => {
        if (resultado.ok || deveRotacionarIdempotencyKey(resultado.problem)) {
          this.cancelamentoEmCurso = null;
        }
      }),
    );
  }

  /** O `If-Match` pede a revisão corrente: lê a inscrição antes e só age se a leitura deu certo. */
  private comETagAtual(
    processoId: string,
    agir: (eTag: string) => Observable<ApiResult<void>>,
  ): Observable<ApiResult<void>> {
    return this.api
      .obter(processoId)
      .pipe(switchMap((inscricao) => (inscricao.ok ? agir(inscricao.data.eTag) : of(inscricao))));
  }
}
