import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDosTiposProcesso } from './edicao-dos-tipos-processo';
import { TipoProcessoFormularioComponent } from './tipo-processo-formulario.component';
import { TiposProcessoListaComponent } from './tipos-processo-lista.component';
import { TiposProcessoStore } from './tipos-processo.store';

@Component({
  selector: 'cfg-tipos-processo-page',
  standalone: true,
  imports: [
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
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly descricaoDoEstadoVazio = computed(() =>
    this.permissoes.tem(PERMISSAO.configuracao.tiposProcessoManter)
      ? 'Cadastre o primeiro tipo de processo para disponibilizá-lo na criação de Processos Seletivos.'
      : 'Os tipos de processo cadastrados ficam disponíveis na criação de Processos Seletivos.',
  );
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-tipos-processo-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
