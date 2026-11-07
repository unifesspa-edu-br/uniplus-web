import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { CondicaoAtendimentoFormularioComponent } from './condicao-atendimento-formulario.component';
import { CondicoesAtendimentoListaComponent } from './condicoes-atendimento-lista.component';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';
import { EdicaoDasCondicoesAtendimento } from './edicao-das-condicoes-atendimento';

@Component({
  selector: 'cfg-condicoes-atendimento-page',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
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
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-condicoes-atendimento-list-title'),
  });
}
