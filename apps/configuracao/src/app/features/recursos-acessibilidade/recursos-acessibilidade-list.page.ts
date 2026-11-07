import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDosRecursosAcessibilidade } from './edicao-dos-recursos-acessibilidade';
import { RecursoAcessibilidadeFormularioComponent } from './recurso-acessibilidade-formulario.component';
import { RecursosAcessibilidadeListaComponent } from './recursos-acessibilidade-lista.component';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'cfg-recurso-acessibilidade-list',
  providers: [RecursosAcessibilidadeStore, EdicaoDosRecursosAcessibilidade],
  imports: [
    FalhaDeLeituraComponent,
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
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-recursos-acessibilidade-list-title'),
  });
}
