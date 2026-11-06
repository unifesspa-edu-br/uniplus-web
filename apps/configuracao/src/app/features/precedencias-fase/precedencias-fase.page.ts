import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa, focoEstaLivre } from '../../shared/foco';
import { EdicaoDasPrecedencias } from './edicao-das-precedencias';
import { FasesDoGrafoStore } from './fases-do-grafo.store';
import { PrecedenciaFormularioComponent } from './precedencia-formulario.component';
import { PrecedenciasFaseListaComponent } from './precedencias-fase-lista.component';
import { PrecedenciasFaseStore } from './precedencias-fase.store';

@Component({
  selector: 'cfg-precedencias-fase-page',
  standalone: true,
  imports: [
    AlertComponent,
    PrecedenciasFaseListaComponent,
    PrecedenciaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [FasesDoGrafoStore, PrecedenciasFaseStore, EdicaoDasPrecedencias],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './precedencias-fase.page.html',
  host: { class: 'cfg-page' },
})
export class PrecedenciasFasePage {
  protected readonly fases = inject(FasesDoGrafoStore);
  protected readonly store = inject(PrecedenciasFaseStore);
  protected readonly edicao = inject(EdicaoDasPrecedencias);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-precedencias-fase-list-title'),
  );

  private readonly novaTentativaDasFases = focarAposNovaTentativa(
    this.fases.pendente,
    this.fases.avisoDeFalha,
    () => document.getElementById('cfg-precedencias-fase-list-title'),
  );
  private readonly novaTentativaDasFasesNoFormulario = focarAposNovaTentativa(
    this.fases.pendente,
    this.fases.avisoDeFalha,
    () =>
      document.getElementById('cfg-precedencia-antecessora') ??
      document.getElementById('cfg-precedencia-par'),
  );
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      if (!this.edicao.devolverFocoAoTitulo()) return;
      untracked(() => {
        this.edicao.focoDevolvidoAoTitulo();
        afterNextRender(
          () => {
            if (focoEstaLivre())
              document.getElementById('cfg-precedencias-fase-list-title')?.focus();
          },
          { injector: this.injector },
        );
      });
    });
  }

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

  protected tentarNovamenteAsFases(): void {
    this.novaTentativaDasFases.executar(() => this.fases.recarregar());
  }

  protected tentarNovamenteAsFasesNoFormulario(): void {
    this.novaTentativaDasFasesNoFormulario.executar(() => this.fases.recarregar());
  }
}
