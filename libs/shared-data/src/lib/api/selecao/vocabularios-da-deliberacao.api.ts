import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

export type ModoDeDeliberacaoDto = components['schemas']['ModoDeDeliberacao'];
export type CriterioDeVotacaoDto = components['schemas']['CriterioDeVotacao'];
export type DesempateDaVotacaoDto = components['schemas']['DesempateDaVotacao'];
export type EncerramentoDaVotacaoDto = components['schemas']['EncerramentoDaVotacao'];
export type ResultadoSemUnanimidadeDto = components['schemas']['ResultadoSemUnanimidade'];

@Injectable({ providedIn: 'root' })
export class VocabulariosDaDeliberacaoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  listarModosDeDeliberacao(): Observable<ApiResult<readonly ModoDeDeliberacaoDto[]>> {
    return this.http.get<ApiResult<readonly ModoDeDeliberacaoDto[]>>(
      this.rotas.doVocabulario('modos-deliberacao'),
      { context: withVendorMime('modo-deliberacao', 1) },
    );
  }

  listarCriteriosDeVotacao(): Observable<ApiResult<readonly CriterioDeVotacaoDto[]>> {
    return this.http.get<ApiResult<readonly CriterioDeVotacaoDto[]>>(
      this.rotas.doVocabulario('criterios-votacao'),
      { context: withVendorMime('criterio-votacao', 1) },
    );
  }

  listarDesempatesDaVotacao(): Observable<ApiResult<readonly DesempateDaVotacaoDto[]>> {
    return this.http.get<ApiResult<readonly DesempateDaVotacaoDto[]>>(
      this.rotas.doVocabulario('desempates-votacao'),
      { context: withVendorMime('desempate-votacao', 1) },
    );
  }

  listarEncerramentosDaVotacao(): Observable<ApiResult<readonly EncerramentoDaVotacaoDto[]>> {
    return this.http.get<ApiResult<readonly EncerramentoDaVotacaoDto[]>>(
      this.rotas.doVocabulario('encerramentos-votacao'),
      { context: withVendorMime('encerramento-votacao', 1) },
    );
  }

  listarResultadosSemUnanimidade(): Observable<ApiResult<readonly ResultadoSemUnanimidadeDto[]>> {
    return this.http.get<ApiResult<readonly ResultadoSemUnanimidadeDto[]>>(
      this.rotas.doVocabulario('resultados-sem-unanimidade'),
      { context: withVendorMime('resultado-sem-unanimidade', 1) },
    );
  }
}
