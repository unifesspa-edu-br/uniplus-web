import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthErrorBannerComponent, LoginErrorBannerComponent } from '@uniplus/shared-auth';

@Component({
  selector: 'sel-root',
  standalone: true,
  imports: [RouterOutlet, AuthErrorBannerComponent, LoginErrorBannerComponent],
  template: `
    <auth-error-banner />
    <auth-login-error-banner />
    <router-outlet />
  `,
})
export class AppComponent {}
