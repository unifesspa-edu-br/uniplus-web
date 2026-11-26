import { inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { of, type Observable } from 'rxjs';
import { apiOk, type ApiResult } from '@uniplus/shared-core/http';
import { GeoApi, type CidadeResumoDto } from './geo.api';

/** Quantos municípios a busca devolve: o bastante para o nome digitado, pouco para a lista. */
const MUNICIPIOS_POR_BUSCA = 20;
/** O Geo aceita termos de busca com até 256 caracteres. */
const TERMO_MAXIMO_DO_GEO = 256;

/**
 * A busca de municípios por nome no Geo, na forma que o editor de condições, o formulário do
 * candidato e o endereço recebem por injeção; com a UF, o Geo devolve só os municípios dela.
 * Fábrica de provider (`useFactory`): roda no contexto de injeção de quem a provê.
 */
export function buscaDeMunicipiosNoGeo(): (
  termo: string,
  uf?: string,
) => Observable<ApiResult<readonly CidadeResumoDto[]>> {
  const geo = inject(GeoApi);
  return (termo, uf) =>
    termo.length > TERMO_MAXIMO_DO_GEO
      ? of(apiOk([], 200, new HttpHeaders()))
      : geo.listarCidades({ q: termo, limit: MUNICIPIOS_POR_BUSCA, ...(uf ? { uf } : {}) });
}
