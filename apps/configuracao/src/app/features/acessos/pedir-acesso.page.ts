import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeaderComponent } from '@uniplus/shared-ui/components';
import { PedidoDocumentoFormularioComponent } from './pedido-documento-formulario.component';
import { PedirAcessoBeneficiarioComponent } from './pedir-acesso-beneficiario.component';
import { PedirAcessoFormularioComponent } from './pedir-acesso-formulario.component';
import { PedirAcessoMotivoComponent } from './pedir-acesso-motivo.component';
import { PedirAcessoPerfilComponent } from './pedir-acesso-perfil.component';
import { PedirAcessoStore } from './pedir-acesso.store';
import { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import { TermoDeResponsabilidadeComponent } from './termo/termo-de-responsabilidade.component';
import { TermoNaCriacao } from './termo/termo-na-criacao';

/**
 * Pedido de acesso, para si ou para outra pessoa. O pedido não dá acesso: segue para o gestor de
 * acessos e, se o perfil tem dado pessoal ou sensível, para o Representante do controlador. No
 * pedido próprio desse perfil sem documento, o envio é o aceite do termo de responsabilidade.
 */
@Component({
  selector: 'cfg-pedir-acesso-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    PedidoDocumentoFormularioComponent,
    PedirAcessoBeneficiarioComponent,
    PedirAcessoFormularioComponent,
    PedirAcessoMotivoComponent,
    PedirAcessoPerfilComponent,
    TermoDeResponsabilidadeComponent,
  ],
  providers: [PedirAcessoStore, TermoNaCriacao, EdicaoDoPedidoDeAcesso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './pedir-acesso.page.html',
})
export class PedirAcessoPage {
  protected readonly edicao = inject(EdicaoDoPedidoDeAcesso);
}
