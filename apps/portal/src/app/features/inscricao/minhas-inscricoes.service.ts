import { Injectable, inject } from '@angular/core';
import { type Observable, of, switchMap, tap } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import {
  type ComprovanteDaInscricaoDto,
  InscricoesApi,
  type MinhaInscricaoDto,
} from '@uniplus/shared-data/selecao';

/** As inscrições do candidato, o comprovante de cada uma e o que se faz com elas: descartar e cancelar. */
@Injectable({ providedIn: 'root' })
export class MinhasInscricoesService {
  private readonly api = inject(InscricoesApi);
  private cancelamentoEmCurso: { readonly chave: string; readonly assinatura: string } | null =
    null;

  /** As inscrições do dono do token, cada uma com o número do último comprovante. */
  listar(): Observable<ApiResult<readonly MinhaInscricaoDto[]>> {
    return this.api.minhas();
  }

  /** O comprovante do envio `numero` da inscrição `inscricaoId`; a cancelada não o tem (422). */
  comprovante(
    inscricaoId: string,
    numero: number,
  ): Observable<ApiResult<ComprovanteDaInscricaoDto>> {
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
