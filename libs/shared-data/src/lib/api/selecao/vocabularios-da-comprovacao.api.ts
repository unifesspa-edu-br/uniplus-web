import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

export type FormaDeComprovacaoDto = components['schemas']['FormaDeComprovacao'];
export interface OpcaoDeComprovacaoDto {
  readonly codigo: string;
  readonly rotulo: string;
}

export type OpcoesDoVocabulario = readonly OpcaoDeComprovacaoDto[];

@Injectable({ providedIn: 'root' })
export class VocabulariosDaComprovacaoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  listarFormasDeComprovacao(): Observable<ApiResult<readonly FormaDeComprovacaoDto[]>> {
    return this.http.get<ApiResult<readonly FormaDeComprovacaoDto[]>>(
      this.rotas.doVocabulario('formas-comprovacao'),
      { context: withVendorMime('forma-de-comprovacao', 1) },
    );
  }

  listarFormatosPermitidos(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('formatos-permitidos'),
      { context: withVendorMime('formato-permitido', 1) },
    );
  }

  listarCriteriosDeDistincaoDeApresentacoes(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('criterios-distincao-apresentacoes'),
      { context: withVendorMime('criterio-distincao-apresentacoes', 1) },
    );
  }

  listarConsequenciasDeIndeferimento(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('consequencias-do-descumprimento'),
      { context: withVendorMime('consequencias-do-descumprimento', 1) },
    );
  }
}
