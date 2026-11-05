import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import { BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';
import { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';
import { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';
import { ModeloFormularioDetalheComponent } from './modelo-formulario-detalhe.component';

@Component({
  selector: 'cfg-modelo-formulario-edicao-page',
  imports: [ModeloFormularioDetalheComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ModeloFormularioEdicaoStore,
    EdicaoDoConteudoDoModelo,
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
  ],
  templateUrl: './modelo-formulario-edicao.page.html',
})
export class ModeloFormularioEdicaoPage {
  protected readonly store = inject(ModeloFormularioEdicaoStore);
  protected readonly edicao = inject(EdicaoDoConteudoDoModelo);
  protected readonly comMunicipios = inject(BUSCA_DE_MUNICIPIOS, { optional: true }) !== null;
  private readonly detalhe = viewChild(ModeloFormularioDetalheComponent);
  protected salvar(): void {
    if (this.edicao.salvar()) this.detalhe()?.focarPrimeiroCampoInvalido();
  }
}
