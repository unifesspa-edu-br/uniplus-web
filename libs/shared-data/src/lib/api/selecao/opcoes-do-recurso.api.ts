import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Uma unidade do prazo de recurso: o código que se grava e o nome que a tela mostra. */
export type UnidadeDoPrazoDeRecursoDto = components['schemas']['UnidadePrazo'];

/** Uma opção de efeito suspensivo, com a explicação do que ela faz. */
export type EfeitoSuspensivoDto = components['schemas']['EfeitoSuspensivoComDescricao'];

/** Uma opção de guarda da vaga, com a explicação do que ela faz. */
export type GuardaDaVagaDto = components['schemas']['GuardaDaVagaComDescricao'];

/**
 * Cliente dos vocabulários de configuração do recurso da Seleção: as unidades do prazo, os efeitos
 * suspensivos e as guardas da vaga que a API aceita.
 *
 * As listas vêm da API e não são escritas aqui de propósito: o vocabulário é do domínio, e uma
 * cópia no cliente ficaria defasada em silêncio a cada opção acrescentada.
 */
@Injectable({ providedIn: 'root' })
export class OpcoesDoRecursoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /** GET `/api/selecao/unidades-do-prazo-de-recurso`. */
  listarUnidadesDePrazo(): Observable<ApiResult<readonly UnidadeDoPrazoDeRecursoDto[]>> {
    return this.http.get<ApiResult<readonly UnidadeDoPrazoDeRecursoDto[]>>(
      this.rotas.doCatalogo('unidades-do-prazo-de-recurso'),
      { context: withVendorMime('unidade-do-prazo-de-recurso', 1) },
    );
  }

  /** GET `/api/selecao/efeitos-suspensivos`. */
  listarEfeitosSuspensivos(): Observable<ApiResult<readonly EfeitoSuspensivoDto[]>> {
    return this.http.get<ApiResult<readonly EfeitoSuspensivoDto[]>>(
      this.rotas.doCatalogo('efeitos-suspensivos'),
      { context: withVendorMime('efeito-suspensivo', 1) },
    );
  }

  /** GET `/api/selecao/guardas-da-vaga`. */
  listarGuardasDaVaga(): Observable<ApiResult<readonly GuardaDaVagaDto[]>> {
    return this.http.get<ApiResult<readonly GuardaDaVagaDto[]>>(
      this.rotas.doCatalogo('guardas-da-vaga'),
      { context: withVendorMime('guarda-da-vaga', 1) },
    );
  }
}
