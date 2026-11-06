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
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
  destinoAcessivel,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focoEstaLivre } from '../../shared/foco';
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
    AlertaNovaTentativaComponent,
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
  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'precedências',
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-precedencias-fase-list-title'),
  });

  /** O aviso das fases está na página e no formulário (um drawer): uma só tentativa, uma só fase. */
  protected readonly novaTentativaDasFases = acompanharNovaTentativa({
    assunto: 'fases',
    pendente: this.fases.pendente,
    falhou: this.fases.avisoDeFalha,
    destino: () =>
      destinoAcessivel(
        document.getElementById('cfg-precedencia-antecessora') ??
          document.getElementById('cfg-precedencia-par'),
        document.getElementById('cfg-precedencias-fase-list-title'),
      ),
  });
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
}
