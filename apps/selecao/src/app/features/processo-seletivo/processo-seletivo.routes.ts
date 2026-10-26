import { Routes } from '@angular/router';
import { ROTA_REUSE_KEY } from '../../editor-route-reuse.strategy';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { ProcessosSeletivosListaPage } from './processos-seletivos-lista.page';
import { rascunhoNaoGravadoGuard } from './steps/shared/rascunho-nao-gravado.guard';

/**
 * As duas rotas do editor são a mesma tela: a criação acontece no meio do
 * cadastro, e a passagem de `novo` para `:id` não pode recriar a página.
 */
const EDITOR_PROCESSO_SELETIVO = 'editor-processo-seletivo';

/**
 * A rota base é a listagem administrativa; `novo` inicia um cadastro vazio,
 * `:id` retoma um processo existente, `:id/simulacao/:finalidade` simula um
 * formulário dele, `:id/publicacoes` mostra o que o processo já publicou e `:id/notas-do-enem`
 * trata do envio ao INEP e da importação das notas do ENEM.
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
    canDeactivate: [rascunhoNaoGravadoGuard],
    data: {
      breadcrumb: 'Novo Processo Seletivo',
      [ROTA_REUSE_KEY]: EDITOR_PROCESSO_SELETIVO,
    },
  },
  {
    // A simulação abre fora do editor, em nova aba: não reaproveita a tela do editor nem tem
    // rascunho a guardar.
    path: ':id/simulacao/:finalidade',
    loadComponent: () =>
      import('./simulacao/simulacao-do-processo.page').then((m) => m.SimulacaoDoProcessoPage),
    data: { breadcrumb: 'Simulação do formulário' },
  },
  {
    // Publicações do processo: o que ele já publicou e a publicação de documento avulso. Fora do
    // editor, porque não há rascunho a guardar.
    path: ':id/publicacoes',
    loadComponent: () =>
      import('./publicacoes/publicacoes-do-processo.page').then((m) => m.PublicacoesDoProcessoPage),
    data: { breadcrumb: 'Publicações' },
  },
  {
    // Notas do ENEM: o envio ao INEP e a importação do retorno. Fora do editor, porque não há
    // rascunho a guardar.
    path: ':id/notas-do-enem',
    loadComponent: () =>
      import('./notas-do-enem/notas-do-enem.page').then((m) => m.NotasDoEnemPage),
    data: { breadcrumb: 'Notas do ENEM' },
  },
  {
    path: ':id',
    component: ProcessoSeletivoPage,
    canDeactivate: [rascunhoNaoGravadoGuard],
    data: {
      breadcrumb: 'Processo Seletivo',
      [ROTA_REUSE_KEY]: EDITOR_PROCESSO_SELETIVO,
    },
  },
];
