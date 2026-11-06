import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { FaseCanonicaFormularioComponent } from './fase-canonica-formulario.component';
import { FasesCanonicasListaComponent } from './fases-canonicas-lista.component';
import { FasesCanonicasStore } from './fases-canonicas.store';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';

@Component({
  selector: 'cfg-fases-canonicas-page',
  standalone: true,
  imports: [
    AlertComponent,
    FasesCanonicasListaComponent,
    FaseCanonicaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [FasesCanonicasStore, EdicaoDasFasesCanonicas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fases-canonicas.page.html',
  host: { class: 'cfg-page' },
})
export class FasesCanonicasPage {
  protected readonly store = inject(FasesCanonicasStore);
  protected readonly edicao = inject(EdicaoDasFasesCanonicas);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-fases-canonicas-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
