import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthErrorBannerComponent } from '@uniplus/shared-auth/components/auth-error-banner.component';
import { LoginErrorBannerComponent } from '@uniplus/shared-auth/components/login-error-banner.component';
import { NotificationHostComponent } from '@uniplus/shared-ui/components/notification-host/notification-host';

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
