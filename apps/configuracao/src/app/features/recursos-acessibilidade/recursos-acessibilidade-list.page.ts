import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  AlertComponent,
  SkeletonComponent,
  SpinnerComponent,
  DialogComponent,
} from '@uniplus/shared-ui/components';
import { RecursosAcessibilidadeListaComponent } from './recursos-acessibilidade-lista.component';
import { RecursoAcessibilidadeFormularioComponent } from './recurso-acessibilidade-formulario.component';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';
import { EdicaoDosRecursosAcessibilidade } from './edicao-dos-recursos-acessibilidade';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'cfg-recurso-acessibilidade-list',
  providers: [RecursosAcessibilidadeStore, EdicaoDosRecursosAcessibilidade],
  imports: [
    AlertComponent,
    SkeletonComponent,
    SpinnerComponent,
    DialogComponent,
    RecursosAcessibilidadeListaComponent,
    RecursoAcessibilidadeFormularioComponent,
  ],
  templateUrl: './recursos-acessibilidade-list.page.html',
  host: { class: 'cfg-page' },
})
export class RecursosAcessibilidadeListPage {
  protected readonly store = inject(RecursosAcessibilidadeStore);
  protected readonly edicao = inject(EdicaoDosRecursosAcessibilidade);
}
