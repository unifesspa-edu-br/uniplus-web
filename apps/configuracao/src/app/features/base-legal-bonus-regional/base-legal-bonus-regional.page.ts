import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { AlertaNovaTentativaComponent } from '../../shared/alerta-nova-tentativa';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { BaseLegalBonusRegionalFormularioComponent } from './base-legal-bonus-regional-formulario.component';
import { BaseLegalBonusRegionalListaComponent } from './base-legal-bonus-regional-lista.component';
import { BaseLegalBonusRegionalStore } from './base-legal-bonus-regional.store';
import { EdicaoDasBasesLegais } from './edicao-das-bases-legais';
import { MunicipiosDaBaseLegal } from './municipios-da-base-legal';
import { TiposDeInstrumento } from './tipos-de-instrumento';

/** Cadastro de bases legais do bônus regional: compõe a lista, o formulário e a remoção. */
@Component({
  selector: 'cfg-base-legal-bonus-regional-page',
  standalone: true,
  imports: [
    AlertComponent,
    AlertaNovaTentativaComponent,
    BaseLegalBonusRegionalFormularioComponent,
    BaseLegalBonusRegionalListaComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [
    BaseLegalBonusRegionalStore,
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
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-base-legal-list-title'),
  );

  protected readonly rotuloDoTipo = (codigo: string): ResolucaoDeVinculo =>
    this.tipos.resolver(codigo);

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
