import type { Provider } from '@angular/core';
import { buscaDeCepNoGeo, buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import { BUSCA_DE_CEP, BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';

/** O Geo que o componente de endereço usa: a resolução de CEP e a busca de municípios. */
export const ENDERECO_NO_GEO: Provider[] = [
  { provide: BUSCA_DE_CEP, useFactory: buscaDeCepNoGeo },
  { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
];
