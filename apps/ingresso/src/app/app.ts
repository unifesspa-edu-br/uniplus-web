import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  AuthErrorBannerComponent,
  LoginErrorBannerComponent,
} from '@uniplus/shared-auth/components';
import { NotificationHostComponent } from '@uniplus/shared-ui/notifications';

@Component({
  selector: 'ing-root',
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
