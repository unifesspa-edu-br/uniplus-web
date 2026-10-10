import { Routes } from '@angular/router';
import { buscaDeCepNoGeo, buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import { BUSCA_DE_CEP, BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';

import { InscricaoDoCandidatoHttp } from './formulario/inscricao-do-candidato.http';
import { InscricaoDoCandidatoService } from './formulario/inscricao-do-candidato.service';
import { InscricaoListaPage } from './inscricao-lista.page';

export const INSCRICAO_ROUTES: Routes = [
  { path: '', component: InscricaoListaPage },
  {
    path: ':processoId/comprovante',
    loadComponent: () =>
      import('./comprovante/comprovante-da-inscricao.page').then(
        (m) => m.ComprovanteDaInscricaoPage,
      ),
  },
  {
    path: ':processoId/comprovantes/:numero',
    loadComponent: () =>
      import('./comprovante/comprovante-da-inscricao.page').then(
        (m) => m.ComprovanteDaInscricaoPage,
      ),
  },
  {
    path: ':processoId',
    loadComponent: () =>
      import('./formulario/inscricao-do-candidato.page').then((m) => m.InscricaoDoCandidatoPage),
    providers: [
      { provide: InscricaoDoCandidatoService, useClass: InscricaoDoCandidatoHttp },
      // O endereço resolve o CEP e lista os municípios no Geo.
      { provide: BUSCA_DE_CEP, useFactory: buscaDeCepNoGeo },
      { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
    ],
  },
];
