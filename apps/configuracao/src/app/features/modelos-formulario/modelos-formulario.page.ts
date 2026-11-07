import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  destinoAcessivel,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { EdicaoDosModelosFormulario } from './edicao-dos-modelos-formulario';
import { ModelosFormularioStore } from './modelos-formulario.store';
import { ModelosFormularioListaComponent } from './modelos-formulario-lista.component';
import { ModeloFormularioCriacaoComponent } from './modelo-formulario-criacao.component';

@Component({
  selector: 'cfg-modelos-formulario-page',
  imports: [
    FalhaDeLeituraComponent,
    ModelosFormularioListaComponent,
    ModeloFormularioCriacaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelos-formulario.page.html',
  host: { class: 'cfg-page' },
  providers: [ModelosFormularioStore, EdicaoDosModelosFormulario],
})
export class ModelosFormularioPage {
  protected readonly edicao = inject(EdicaoDosModelosFormulario);
  protected readonly store = inject(ModelosFormularioStore);
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.recarregar(),
    destino: () => document.getElementById('cfg-modelos-list-title'),
  });
  /** Os tipos de processo alimentam o filtro da lista e o campo do drawer de criação: uma leitura só. */
  protected readonly leituraDosTipos = acompanharLeitura({
    assunto: 'tipos de processo',
    falha: this.store.falhaDosTipos,
    pendente: this.store.carregandoOsTipos,
    recarregar: () => this.store.recarregarTipos(),
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>(
          '#cfg-modelo-criacao select[formcontrolname="tipoProcessoCodigo"]',
        ),
        document.getElementById('cfg-modelos-list-title'),
      ),
  });
}
