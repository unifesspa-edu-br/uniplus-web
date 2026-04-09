import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GovbrHeaderComponent } from './govbr-header/govbr-header';

@Component({
  selector: 'poc-layout',
  standalone: true,
  imports: [RouterOutlet, GovbrHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <poc-govbr-header />
    <main class="max-w-screen-xl mx-auto px-govbr-5 py-govbr-5">
      <router-outlet />
    </main>
    <footer class="bg-govbr-primary-dark text-govbr-pure-0 py-govbr-4 px-govbr-5 mt-govbr-9">
      <div class="max-w-screen-xl mx-auto text-govbr-xs text-center opacity-80">
        Unifesspa — Centro de Processos Seletivos (CEPS) · PoC Spartan UI + Gov.br DS
      </div>
    </footer>
  `,
})
export class LayoutComponent {}
