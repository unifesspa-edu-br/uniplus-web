import { Routes } from '@angular/router';
import {
  buscaDeCepNoGeo,
  buscaDeMunicipiosNoGeo,
  leituraDeMunicipioNoGeo,
} from '@uniplus/shared-data/geo';
import {
  BUSCA_DE_CEP,
  BUSCA_DE_MUNICIPIOS,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
} from '@uniplus/shared-ui/components';

import { EnvioDeDocumentosDaInscricao } from './formulario/envio-de-documentos-da-inscricao';
import { InscricaoDoCandidatoHttp } from './formulario/inscricao-do-candidato.http';
import { InscricaoDoCandidatoService } from './formulario/inscricao-do-candidato.service';
import { ComprovanteDaInscricaoPage } from './comprovante/comprovante-da-inscricao.page';
import { InscricaoListaPage } from './inscricao-lista.page';

export const INSCRICAO_ROUTES: Routes = [
  { path: '', component: InscricaoListaPage },
  // O comprovante fica no chunk da feature, como a lista: separado, ele dividiria os tokens que o
  // carregamento inicial já traz em mais um chunk.
  // O comprovante vai pelo id da inscrição, não pelo do processo, e sempre pelo número do envio: a
  // lista e o recibo da submissão informam o número.
  { path: 'comprovante/:inscricaoId/:numero', component: ComprovanteDaInscricaoPage },
  {
    path: ':processoId',
    loadComponent: () =>
      import('./formulario/inscricao-do-candidato.page').then((m) => m.InscricaoDoCandidatoPage),
    providers: [
      { provide: InscricaoDoCandidatoService, useClass: InscricaoDoCandidatoHttp },
      EnvioDeDocumentosDaInscricao,
      // O endereço resolve o CEP e lista os municípios no Geo.
      { provide: BUSCA_DE_CEP, useFactory: buscaDeCepNoGeo },
      { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
      { provide: LEITURA_DE_MUNICIPIO_POR_CODIGO, useFactory: leituraDeMunicipioNoGeo },
    ],
  },
];
