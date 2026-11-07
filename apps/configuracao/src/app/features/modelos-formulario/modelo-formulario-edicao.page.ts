import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  BUSCA_DE_MUNICIPIOS,
  EditorDeFormularioComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';
import { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';
import { ModeloFormularioCabecalhoComponent } from './modelo-formulario-cabecalho.component';
import { ModeloFormularioDocumentosComponent } from './modelo-formulario-documentos.component';
import { ModeloFormularioIdentificacaoComponent } from './modelo-formulario-identificacao.component';
import { ModeloFormularioRodapeComponent } from './modelo-formulario-rodape.component';

@Component({
  selector: 'cfg-modelo-formulario-edicao-page',
  imports: [
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    SpinnerComponent,
    EditorDeFormularioComponent,
    ModeloFormularioCabecalhoComponent,
    ModeloFormularioDocumentosComponent,
    ModeloFormularioIdentificacaoComponent,
    ModeloFormularioRodapeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ModeloFormularioEdicaoStore,
    EdicaoDoConteudoDoModelo,
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
  ],
  templateUrl: './modelo-formulario-edicao.page.html',
  host: { class: 'cfg-page' },
})
export class ModeloFormularioEdicaoPage {
  protected readonly store = inject(ModeloFormularioEdicaoStore);
  protected readonly edicao = inject(EdicaoDoConteudoDoModelo);
  protected readonly comMunicipios = inject(BUSCA_DE_MUNICIPIOS, { optional: true }) !== null;
  private readonly editor = viewChild(EditorDeFormularioComponent);

  constructor() {
    acompanharFocoDoEnvio({
      salvando: this.edicao.somenteLeitura,
      aberto: computed(() => this.store.modelo() !== null),
    });
  }

  protected salvar(): void {
    if (this.edicao.salvar()) void this.editor()?.focarPrimeiroCampoInvalido();
  }
}
