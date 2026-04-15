import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthErrorBannerComponent } from '@uniplus/shared-auth';

@Component({
  selector: 'sel-root',
  standalone: true,
  imports: [RouterOutlet, AuthErrorBannerComponent],
  template: `
    <auth-error-banner />
    <router-outlet />
  `,
})
export class AppComponent {}
