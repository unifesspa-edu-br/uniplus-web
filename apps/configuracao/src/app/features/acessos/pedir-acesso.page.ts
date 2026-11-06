import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';
import { PedidoDocumentoFormularioComponent } from './pedido-documento-formulario.component';
import { PedirAcessoBeneficiarioComponent } from './pedir-acesso-beneficiario.component';
import { PedirAcessoFormularioComponent } from './pedir-acesso-formulario.component';
import { PedirAcessoMotivoComponent } from './pedir-acesso-motivo.component';
import { PedirAcessoPerfilComponent } from './pedir-acesso-perfil.component';
import { PedirAcessoStore } from './pedir-acesso.store';
import { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';

/**
 * Pedido de acesso, para si ou para outra pessoa. O pedido não dá acesso: segue para o gestor de
 * acessos e, se o perfil tem dado pessoal ou sensível, para a proteção de dados.
 */
@Component({
  selector: 'cfg-pedir-acesso-page',
  standalone: true,
  imports: [
    AlertComponent,
    PageHeaderComponent,
    PedidoDocumentoFormularioComponent,
    PedirAcessoBeneficiarioComponent,
    PedirAcessoFormularioComponent,
    PedirAcessoMotivoComponent,
    PedirAcessoPerfilComponent,
  ],
  providers: [PedirAcessoStore, EdicaoDoPedidoDeAcesso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './pedir-acesso.page.html',
})
export class PedirAcessoPage {
  protected readonly edicao = inject(EdicaoDoPedidoDeAcesso);
}
