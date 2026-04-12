import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GovbrHeaderComponent } from './govbr-header/govbr-header';

@Component({
  selector: 'poc-layout',
  standalone: true,
  imports: [RouterOutlet, GovbrHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col min-h-screen' },
  template: `
    <poc-govbr-header />

    <main class="flex-1 max-w-screen-xl w-full mx-auto px-govbr-5 py-govbr-5">
      <router-outlet />
    </main>

    <footer
      class="mt-auto bg-govbr-primary-dark text-govbr-pure-0 py-govbr-5 px-govbr-5 text-govbr-xs"
    >
      <div class="max-w-screen-xl mx-auto text-center">
        Universidade Federal do Sul e Sudeste do Pará — CEPS
      </div>
    </footer>
  `,
})
export class LayoutComponent {}
