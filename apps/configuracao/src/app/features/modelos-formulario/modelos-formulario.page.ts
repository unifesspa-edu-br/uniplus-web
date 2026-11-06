import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
} from '@uniplus/shared-ui/components';
import { EdicaoDosModelosFormulario } from './edicao-dos-modelos-formulario';
import { ModelosFormularioStore } from './modelos-formulario.store';
import { ModelosFormularioListaComponent } from './modelos-formulario-lista.component';
import { ModeloFormularioCriacaoComponent } from './modelo-formulario-criacao.component';

@Component({
  selector: 'cfg-modelos-formulario-page',
  imports: [
    AlertaNovaTentativaComponent,
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
  protected readonly errorMessage = this.store.mensagemDeErro;
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-modelos-list-title'),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
