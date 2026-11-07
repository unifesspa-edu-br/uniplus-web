import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDosTiposProcesso } from './edicao-dos-tipos-processo';
import { TipoProcessoFormularioComponent } from './tipo-processo-formulario.component';
import { TiposProcessoListaComponent } from './tipos-processo-lista.component';
import { TiposProcessoStore } from './tipos-processo.store';

@Component({
  selector: 'cfg-tipos-processo-page',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    AlertComponent,
    TiposProcessoListaComponent,
    TipoProcessoFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-processo.page.html',
  providers: [TiposProcessoStore, EdicaoDosTiposProcesso],
  host: { class: 'cfg-page' },
})
export class TiposProcessoPage {
  protected readonly store = inject(TiposProcessoStore);
  protected readonly edicao = inject(EdicaoDosTiposProcesso);
  private readonly permissoes = inject(PermissoesService);
  protected readonly descricaoDoEstadoVazio = computed(() =>
    this.permissoes.tem(PERMISSAO.configuracao.tiposProcessoManter)
      ? 'Cadastre o primeiro tipo de processo para disponibilizá-lo na criação de Processos Seletivos.'
      : 'Os tipos de processo cadastrados ficam disponíveis na criação de Processos Seletivos.',
  );
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-tipos-processo-list-title'),
  });
}
