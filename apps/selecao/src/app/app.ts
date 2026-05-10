import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthErrorBannerComponent, LoginErrorBannerComponent } from '@uniplus/shared-auth';
import { NotificationHostComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'sel-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AuthErrorBannerComponent,
    LoginErrorBannerComponent,
    NotificationHostComponent,
  ],
  template: `
    <auth-error-banner />
    <auth-login-error-banner />
    <ui-notification-host />
    <router-outlet />
  `,
})
export class AppComponent {}
