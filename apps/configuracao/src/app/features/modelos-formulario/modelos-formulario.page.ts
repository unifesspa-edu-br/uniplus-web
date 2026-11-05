import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { EdicaoDosModelosFormulario } from './edicao-dos-modelos-formulario';
import { ModelosFormularioStore } from './modelos-formulario.store';
import { ModelosFormularioListaComponent } from './modelos-formulario-lista.component';
import { ModeloFormularioCriacaoComponent } from './modelo-formulario-criacao.component';

@Component({
  selector: 'cfg-modelos-formulario-page',
  imports: [AlertComponent, ModelosFormularioListaComponent, ModeloFormularioCriacaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelos-formulario.page.html',
  host: { class: 'cfg-page' },
  providers: [ModelosFormularioStore, EdicaoDosModelosFormulario],
})
export class ModelosFormularioPage {
  protected readonly edicao = inject(EdicaoDosModelosFormulario);
  protected readonly store = inject(ModelosFormularioStore);
  protected readonly errorMessage = this.store.mensagemDeErro;
  protected readonly loading = this.store.carregando;
  protected tentarNovamente(): void {
    this.store.tentarNovamente();
  }
}
