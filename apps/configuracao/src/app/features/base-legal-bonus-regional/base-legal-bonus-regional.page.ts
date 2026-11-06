import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
} from '@uniplus/shared-ui/components';
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
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
    AlertaNovaTentativaComponent,
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
  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'bases legais',
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-base-legal-list-title'),
  });

  protected readonly rotuloDoTipo = (codigo: string): ResolucaoDeVinculo =>
    this.tipos.resolver(codigo);

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
