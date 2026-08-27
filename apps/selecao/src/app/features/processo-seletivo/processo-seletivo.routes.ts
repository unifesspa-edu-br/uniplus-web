import { Routes } from '@angular/router';
import { ROTA_REUSE_KEY } from '../../editor-route-reuse.strategy';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { ProcessosSeletivosListaPage } from './processos-seletivos-lista.page';

/**
 * As duas rotas do editor são a mesma tela: a criação acontece no meio do
 * cadastro, e a passagem de `novo` para `:id` não pode recriar a página.
 */
const EDITOR_PROCESSO_SELETIVO = 'editor-processo-seletivo';

/**
 * A rota base é a listagem administrativa; `novo` inicia um cadastro vazio e
 * `:id` retoma um processo existente.
 *
 * `novo` é declarada antes de `:id` porque o roteador casa na ordem — sem
 * isso, `/processo-seletivo/novo` seria lido como um id chamado "novo".
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
      [ROTA_REUSE_KEY]: EDITOR_PROCESSO_SELETIVO,
    },
  },
  {
    path: ':id',
    component: ProcessoSeletivoPage,
    data: {
      breadcrumb: 'Processo Seletivo',
      [ROTA_REUSE_KEY]: EDITOR_PROCESSO_SELETIVO,
    },
  },
];
