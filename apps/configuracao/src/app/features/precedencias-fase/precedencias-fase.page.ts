import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focoEstaLivre, novaTentativaAnunciada } from '../../shared/foco';
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
  /** Os alertas mantidos na tela durante a tentativa não mudam de texto; esta região anuncia cada tentativa. */
  protected readonly anuncioDaLeitura = signal('');
  private readonly novaTentativa = novaTentativaAnunciada({
    nome: 'precedências',
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-precedencias-fase-list-title'),
    anuncio: this.anuncioDaLeitura,
  });

  private readonly novaTentativaDasFases = novaTentativaAnunciada({
    nome: 'nomes das fases',
    pendente: this.fases.pendente,
    falhou: this.fases.avisoDeFalha,
    destino: () => document.getElementById('cfg-precedencias-fase-list-title'),
    anuncio: this.anuncioDaLeitura,
  });
  /** O formulário é um drawer modal: o anúncio da tentativa acionada dentro dele tem região própria, dentro dele. */
  protected readonly anuncioDoFormulario = signal('');
  private readonly novaTentativaDasFasesNoFormulario = novaTentativaAnunciada({
    nome: 'nomes das fases',
    pendente: this.fases.pendente,
    falhou: this.fases.avisoDeFalha,
    destino: () =>
      document.getElementById('cfg-precedencia-antecessora') ??
      document.getElementById('cfg-precedencia-par'),
    anuncio: this.anuncioDoFormulario,
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

  protected tentarNovamenteAsFasesNoFormulario(): void {
    this.novaTentativaDasFasesNoFormulario.executar(() => this.fases.recarregar());
  }
}
