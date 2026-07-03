import { Routes } from '@angular/router';

/**
 * Rotas da feature Modalidade de concorrência (Piloto B — lista + tela dedicada).
 * A lista é a tela primária; a criação/edição usa **tela dedicada** (rota própria),
 * não drawer, por causa dos condicionais cruzados (natureza↔regra↔args, composição↔origem).
 */
export const MODALIDADES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./modalidades-list.page').then((m) => m.ModalidadesListPage),
  },
  {
    path: 'novo',
    data: { breadcrumb: 'Nova modalidade' },
    loadComponent: () =>
      import('./modalidade-form.page').then((m) => m.ModalidadeFormPage),
  },
  {
    path: ':id',
    data: { breadcrumb: 'Editar modalidade' },
    loadComponent: () =>
      import('./modalidade-form.page').then((m) => m.ModalidadeFormPage),
  },
];
