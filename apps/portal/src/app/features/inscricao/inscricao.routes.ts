import { Routes } from '@angular/router';
import { buscaDeCepNoGeo, buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import { BUSCA_DE_CEP, BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';

import { InscricaoDoCandidatoEmMemoria } from './formulario/inscricao-do-candidato.mock';
import { InscricaoDoCandidatoService } from './formulario/inscricao-do-candidato.service';
import { InscricaoListaPage } from './inscricao-lista.page';

export const INSCRICAO_ROUTES: Routes = [
  { path: '', component: InscricaoListaPage },
  {
    path: ':processoId',
    loadComponent: () =>
      import('./formulario/inscricao-do-candidato.page').then((m) => m.InscricaoDoCandidatoPage),
    providers: [
      // A tela anda contra a inscrição em memória até a integração com a API.
      { provide: InscricaoDoCandidatoService, useClass: InscricaoDoCandidatoEmMemoria },
      // O endereço resolve o CEP e lista os municípios no Geo.
      { provide: BUSCA_DE_CEP, useFactory: buscaDeCepNoGeo },
      { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
    ],
  },
];
