import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { TiposProcessoListaComponent } from './tipos-processo-lista.component';
import { TipoProcessoFormularioComponent } from './tipo-processo-formulario.component';
import { TipoProcessoConfirmacaoComponent } from './tipo-processo-confirmacao.component';
import { TiposProcessoStore } from './tipos-processo.store';
import { EdicaoDosTiposProcesso } from './edicao-dos-tipos-processo';

@Component({
  selector: 'cfg-tipos-processo-page',
  standalone: true,
  imports: [
    AlertComponent,
    TiposProcessoListaComponent,
    TipoProcessoFormularioComponent,
    TipoProcessoConfirmacaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-processo.page.html',
  providers: [TiposProcessoStore, EdicaoDosTiposProcesso],
  host: { class: 'cfg-page' },
})
export class TiposProcessoPage {
  protected readonly store = inject(TiposProcessoStore);
  protected readonly edicao = inject(EdicaoDosTiposProcesso);
  protected readonly permissaoDeManter = PERMISSAO.configuracao.tiposProcessoManter;
  private readonly permissoes = inject(PermissoesService);
  protected readonly descricaoDoEstadoVazio = computed(() =>
    this.permissoes.tem(this.permissaoDeManter)
      ? 'Cadastre o primeiro tipo de processo para disponibilizá-lo na criação de Processos Seletivos.'
      : 'Os tipos de processo cadastrados ficam disponíveis na criação de Processos Seletivos.',
  );
}
