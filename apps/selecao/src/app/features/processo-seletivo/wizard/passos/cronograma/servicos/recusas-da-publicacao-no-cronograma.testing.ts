import type { Provider } from '@angular/core';

import { RecusasDaPublicacaoNoCronograma } from './recusas-da-publicacao-no-cronograma.service';

/** Para quem testa a recusa da gravação sozinha: a última publicação não recusou nada. */
export const SEM_RECUSAS_DA_PUBLICACAO: Provider = {
  provide: RecusasDaPublicacaoNoCronograma,
  useValue: { recusasDaFase: () => [], recusasDaEtapa: () => [] },
};
