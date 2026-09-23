import { Routes } from '@angular/router';
import { PublicacaoDetalheComponent } from './publicacao-detalhe';
import { PublicacoesListaComponent } from './publicacoes-lista';

export const PUBLICACOES_ROUTES: Routes = [
  { path: '', component: PublicacoesListaComponent },
  { path: ':id', component: PublicacaoDetalheComponent },
];
