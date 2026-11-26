import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import type { BuscaDeMunicipios } from '@uniplus/shared-ui/components';

/** Busca no Geo e avisa falhas do servidor como as demais telas da Configuração. */
export function buscaDeMunicipiosDaConfiguracao(): BuscaDeMunicipios {
  const buscar = buscaDeMunicipiosNoGeo();
  const notificacoes = inject(NotificationService);
  return (termo, uf) =>
    buscar(termo, uf).pipe(
      tap((resultado) => {
        if (!resultado.ok && resultado.problem.status >= 500) {
          notificacoes.errorFromProblem(resultado.problem);
        }
      }),
    );
}
