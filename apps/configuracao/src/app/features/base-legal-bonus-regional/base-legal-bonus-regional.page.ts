import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  BUSCA_DE_MUNICIPIOS,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { buscaDeMunicipiosDaConfiguracao } from '../../shared/geo/busca-de-municipios-da-configuracao';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { BaseLegalBonusRegionalFormularioComponent } from './base-legal-bonus-regional-formulario.component';
import { BaseLegalBonusRegionalListaComponent } from './base-legal-bonus-regional-lista.component';
import { BaseLegalBonusRegionalStore } from './base-legal-bonus-regional.store';
import { CatalogoDeTiposDeInstrumento } from './catalogo-de-tipos-de-instrumento';
import { EdicaoDasBasesLegais } from './edicao-das-bases-legais';
import { MunicipiosDaBaseLegal } from './municipios-da-base-legal';
import { TiposDeInstrumento } from './tipos-de-instrumento';

/** Cadastro de bases legais do bônus regional: compõe a lista, o formulário e a remoção. */
@Component({
  selector: 'cfg-base-legal-bonus-regional-page',
  standalone: true,
  imports: [
    BaseLegalBonusRegionalFormularioComponent,
    BaseLegalBonusRegionalListaComponent,
    ConfirmacaoDeRemocaoComponent,
    FalhaDeLeituraComponent,
  ],
  providers: [
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosDaConfiguracao },
    BaseLegalBonusRegionalStore,
    CatalogoDeTiposDeInstrumento,
    EdicaoDasBasesLegais,
    MunicipiosDaBaseLegal,
    TiposDeInstrumento,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './base-legal-bonus-regional.page.html',
  host: { class: 'cfg-page' },
})
export class BaseLegalBonusRegionalPage {
  protected readonly store = inject(BaseLegalBonusRegionalStore);
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
