import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  AuthErrorBannerComponent,
  LoginErrorBannerComponent,
} from '@uniplus/shared-auth/components';
import { AvisoDeVencimentoDaSessao, SessaoEncerrada } from '@uniplus/shared-auth/bootstrap';
import {
  AvisoDeSessaoEncerradaComponent,
  AvisoDeSessaoPertoDeVencerComponent,
} from '@uniplus/shared-ui/components';
import { NotificationHostComponent } from '@uniplus/shared-ui/notifications';

@Component({
  selector: 'ing-root',
  standalone: true,
  imports: [
    AvisoDeSessaoEncerradaComponent,
    AvisoDeSessaoPertoDeVencerComponent,
    RouterOutlet,
    AuthErrorBannerComponent,
    LoginErrorBannerComponent,
    NotificationHostComponent,
  ],
  template: `
    <auth-error-banner />
    <auth-login-error-banner />
    <ui-notification-host />
    <ui-aviso-de-sessao-encerrada
      [aberto]="sessao.aberto()"
      (entrar)="sessao.entrarNovamente()"
      (dispensar)="sessao.dispensar()"
    />
    <ui-aviso-de-sessao-perto-de-vencer
      [aberto]="vencimento.aberto()"
      [restanteEmSegundos]="vencimento.restanteEmSegundos()"
      [podeContinuar]="vencimento.situacao() === 'podeContinuar'"
      (continuar)="vencimento.continuar()"
      (entrar)="vencimento.entrarDeNovo()"
      (dispensar)="vencimento.dispensar()"
    />
    <router-outlet />
  `,
})
export class AppComponent {
  protected readonly sessao = inject(SessaoEncerrada);
  protected readonly vencimento = inject(AvisoDeVencimentoDaSessao);
}
