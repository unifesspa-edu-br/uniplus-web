import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  BUSCA_DE_MUNICIPIOS,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { buscaDeMunicipiosDaConfiguracao } from '../../shared/geo/busca-de-municipios-da-configuracao';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { BaseLegalDoFadaFormularioComponent } from './base-legal-do-fada-formulario.component';
import { BaseLegalDoFadaListaComponent } from './base-legal-do-fada-lista.component';
import { BaseLegalDoFadaStore } from './base-legal-do-fada.store';
import { CatalogoDeTiposDeInstrumento } from './catalogo-de-tipos-de-instrumento';
import { EdicaoDasBasesLegais } from './edicao-das-bases-legais';
import { MunicipiosDaBaseLegal } from './municipios-da-base-legal';
import { TiposDeInstrumento } from './tipos-de-instrumento';

/** Cadastro de bases legais do Fator de Atenuação: compõe a lista, o formulário e a remoção. */
@Component({
  selector: 'cfg-base-legal-do-fada-page',
  standalone: true,
  imports: [
    BaseLegalDoFadaFormularioComponent,
    BaseLegalDoFadaListaComponent,
    ConfirmacaoDeRemocaoComponent,
    FalhaDeLeituraComponent,
  ],
  providers: [
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosDaConfiguracao },
    BaseLegalDoFadaStore,
    CatalogoDeTiposDeInstrumento,
    EdicaoDasBasesLegais,
    MunicipiosDaBaseLegal,
    TiposDeInstrumento,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './base-legal-do-fada.page.html',
  host: { class: 'cfg-page' },
})
export class BaseLegalDoFadaPage {
  protected readonly store = inject(BaseLegalDoFadaStore);
  protected readonly edicao = inject(EdicaoDasBasesLegais);
  protected readonly municipios = inject(MunicipiosDaBaseLegal);
  protected readonly tipos = inject(TiposDeInstrumento);
  protected readonly leitura = acompanharLeitura({
    assunto: 'bases legais',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-base-legal-list-title'),
  });
}
