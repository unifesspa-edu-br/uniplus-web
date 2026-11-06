import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDosRecursosAcessibilidade } from './edicao-dos-recursos-acessibilidade';
import { RecursoAcessibilidadeFormularioComponent } from './recurso-acessibilidade-formulario.component';
import { RecursosAcessibilidadeListaComponent } from './recursos-acessibilidade-lista.component';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'cfg-recurso-acessibilidade-list',
  providers: [RecursosAcessibilidadeStore, EdicaoDosRecursosAcessibilidade],
  imports: [
    AlertComponent,
    RecursosAcessibilidadeListaComponent,
    RecursoAcessibilidadeFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  templateUrl: './recursos-acessibilidade-list.page.html',
  host: { class: 'cfg-page' },
})
export class RecursosAcessibilidadeListPage {
  protected readonly store = inject(RecursosAcessibilidadeStore);
  protected readonly edicao = inject(EdicaoDosRecursosAcessibilidade);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-recursos-acessibilidade-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
