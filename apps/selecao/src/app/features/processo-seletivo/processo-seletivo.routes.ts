import { Routes } from '@angular/router';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { ProcessosSeletivosListaPage } from './processos-seletivos-lista.page';

/**
 * A rota base é a listagem administrativa; `novo` inicia um cadastro vazio.
 *
 * A rota `:id` do editor persistente entra junto com a hidratação do detalhe
 * (Story #478, CA-05): antes disso, o wizard nasce sem `processoSeletivoId` e
 * o passo de identificação criaria um processo novo em vez de retomar o que a
 * URL aponta.
 */
export const PROCESSO_SELETIVO_ROUTES: Routes = [
  {
    path: '',
    component: ProcessosSeletivosListaPage,
    data: {
      breadcrumb: 'Processo Seletivo',
    },
  },
  {
    path: 'novo',
    component: ProcessoSeletivoPage,
    data: {
      breadcrumb: 'Novo Processo Seletivo',
    },
  },
];
