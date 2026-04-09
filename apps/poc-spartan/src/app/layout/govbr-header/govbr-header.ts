import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'poc-govbr-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Barra superior Gov.br -->
    <div class="bg-govbr-primary-darkest text-govbr-pure-0 text-govbr-xs py-govbr-1 px-govbr-5">
      <div class="max-w-screen-xl mx-auto flex items-center gap-govbr-2">
        <!-- Logo Gov.br inline SVG -->
        <svg width="36" height="16" viewBox="0 0 112 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Logo Gov.br">
          <text x="0" y="28" fill="white" font-family="Raleway, sans-serif" font-size="24" font-weight="700">gov</text>
          <text x="52" y="28" fill="#FFCD07" font-family="Raleway, sans-serif" font-size="24" font-weight="700">.br</text>
        </svg>
        <span class="font-semibold tracking-wide">GOVERNO FEDERAL</span>
      </div>
    </div>

    <!-- Barra principal institucional -->
    <header class="bg-govbr-primary text-govbr-pure-0 py-govbr-3 px-govbr-5 shadow-md">
      <div class="max-w-screen-xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-govbr-3">
          <div class="flex flex-col">
            <span class="text-govbr-lg font-bold leading-tight">Sistema Unificado CEPS</span>
            <span class="text-govbr-xs opacity-80">Universidade Federal do Sul e Sudeste do Pará</span>
          </div>
        </div>
        <nav class="hidden md:flex items-center gap-govbr-5">
          <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium">Início</a>
          <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium">Processos</a>
          <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium">Ajuda</a>
        </nav>
      </div>
    </header>
  `,
})
export class GovbrHeaderComponent {}
