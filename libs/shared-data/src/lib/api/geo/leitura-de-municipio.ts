import { inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import { GeoApi, type CidadeDetalheDto } from './geo.api';

/**
 * A leitura de um município pelo código IBGE no Geo, na forma que o formulário do candidato recebe
 * por injeção. Fábrica de provider (`useFactory`): roda no contexto de injeção de quem a provê.
 */
export function leituraDeMunicipioNoGeo(): (
  codigoIbge: string,
) => Observable<ApiResult<CidadeDetalheDto>> {
  const geo = inject(GeoApi);
  return (codigoIbge) => geo.obterCidade(codigoIbge);
}
