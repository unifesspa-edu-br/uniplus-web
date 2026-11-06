import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { avisoDeFalhaDoLookup } from '../../shared/foco';
import { FaseCanonicaFormularioComponent } from './fase-canonica-formulario.component';
import { FasesCanonicasListaComponent } from './fases-canonicas-lista.component';
import { FasesCanonicasStore } from './fases-canonicas.store';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';

@Component({
  selector: 'cfg-fases-canonicas-page',
  standalone: true,
  imports: [
    AlertaNovaTentativaComponent,
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
  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'fases canônicas',
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-fases-canonicas-list-title'),
  });

  protected readonly avisoDasUnidades = avisoDeFalhaDoLookup(this.store.unidades);
  protected readonly novaTentativaDasUnidades = acompanharNovaTentativa({
    assunto: 'unidades',
    pendente: this.store.unidades.pendente,
    falhou: this.avisoDasUnidades,
    destino: () =>
      document.querySelector<HTMLElement>('select[formcontrolname="unidadeSugeridaId"]'),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

  protected tentarNovamenteAsUnidades(): void {
    this.novaTentativaDasUnidades.executar(() => this.store.unidades.recarregar());
  }
}
