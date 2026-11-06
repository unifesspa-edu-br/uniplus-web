import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { CondicaoAtendimentoFormularioComponent } from './condicao-atendimento-formulario.component';
import { CondicoesAtendimentoListaComponent } from './condicoes-atendimento-lista.component';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';
import { EdicaoDasCondicoesAtendimento } from './edicao-das-condicoes-atendimento';

@Component({
  selector: 'cfg-condicoes-atendimento-page',
  standalone: true,
  imports: [
    AlertComponent,
    CondicoesAtendimentoListaComponent,
    CondicaoAtendimentoFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [CondicoesAtendimentoStore, EdicaoDasCondicoesAtendimento],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './condicoes-atendimento.page.html',
  host: { class: 'cfg-page' },
})
export class CondicoesAtendimentoPage {
  protected readonly store = inject(CondicoesAtendimentoStore);
  protected readonly edicao = inject(EdicaoDasCondicoesAtendimento);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-condicoes-atendimento-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
