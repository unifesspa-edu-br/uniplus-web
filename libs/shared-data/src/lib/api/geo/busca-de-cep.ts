import { inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import { GeoApi, type CepResolvidoDto } from './geo.api';

/**
 * A resolução de CEP no Geo, na forma que o componente de endereço recebe por injeção.
 * Fábrica de provider (`useFactory`): roda no contexto de injeção de quem a provê.
 */
export function buscaDeCepNoGeo(): (cep: string) => Observable<ApiResult<CepResolvidoDto>> {
  const geo = inject(GeoApi);
  return (cep) => geo.obterCep(cep);
}
