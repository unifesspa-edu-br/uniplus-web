import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'poc-govbr-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Barra superior Gov.br -->
    <div class="bg-govbr-primary-darkest text-govbr-pure-0 text-govbr-xs py-govbr-1 px-govbr-5">
      <div class="max-w-screen-xl mx-auto flex items-center gap-govbr-2">
        <img src="https://www.gov.br/ds/assets/img/govbr-logo-small.png"
             alt="Logo Gov.br" class="h-4" loading="lazy" />
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
