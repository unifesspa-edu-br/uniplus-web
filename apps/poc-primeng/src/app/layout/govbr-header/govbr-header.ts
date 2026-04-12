import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'poc-govbr-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Barra superior Gov.br -->
    <div class="bg-govbr-primary-darkest text-govbr-pure-0 text-govbr-xs py-govbr-1 px-govbr-5">
      <div class="max-w-screen-xl mx-auto flex items-center gap-govbr-2">
        <svg
          width="36"
          height="16"
          viewBox="0 0 112 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Logo Gov.br"
        >
          <text
            x="0"
            y="28"
            fill="white"
            font-family="Raleway, sans-serif"
            font-size="24"
            font-weight="700"
          >
            gov
          </text>
          <text
            x="52"
            y="28"
            fill="#FFCD07"
            font-family="Raleway, sans-serif"
            font-size="24"
            font-weight="700"
          >
            .br
          </text>
        </svg>
        <span class="font-semibold tracking-wide">GOVERNO FEDERAL</span>
      </div>
    </div>

    <!-- Barra principal institucional -->
    <header class="bg-govbr-primary text-govbr-pure-0 py-govbr-3 px-govbr-5 shadow-md">
      <div class="max-w-screen-xl mx-auto flex items-center justify-between">
        <!-- Esquerda: nome do sistema -->
        <div class="flex items-center gap-govbr-3">
          <div class="flex flex-col">
            <span class="text-govbr-lg font-bold leading-tight">Sistema Unificado CEPS</span>
            <span class="text-govbr-xs opacity-80">Universidade Federal do Sul e Sudeste do Pará</span>
          </div>
        </div>

        <!-- Direita: nav desktop + busca + login -->
        <div class="flex items-center gap-govbr-4">
          <nav class="hidden md:flex items-center gap-govbr-5">
            <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium">Início</a>
            <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium">Processos</a>
            <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium">Ajuda</a>
          </nav>

          <!-- Busca -->
          <button
            class="hidden md:flex items-center justify-center w-8 h-8 rounded-govbr-pill hover:bg-govbr-primary-hover transition-colors"
            aria-label="Buscar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>

          <!-- Login -->
          <button
            class="flex items-center gap-govbr-2 px-govbr-3 py-govbr-1 border border-govbr-pure-0/40 rounded-govbr-pill hover:bg-govbr-primary-hover transition-colors text-govbr-sm font-medium"
            aria-label="Entrar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span class="hidden md:inline">Entrar</span>
          </button>

          <!-- Hambúrguer mobile -->
          <button
            class="md:hidden flex items-center justify-center w-10 h-10"
            (click)="mobileMenuAberto.set(!mobileMenuAberto())"
            [attr.aria-expanded]="mobileMenuAberto()"
            aria-label="Menu de navegação"
          >
            @if (mobileMenuAberto()) {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            } @else {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            }
          </button>
        </div>
      </div>

      <!-- Menu mobile -->
      @if (mobileMenuAberto()) {
        <nav class="md:hidden mt-govbr-3 pt-govbr-3 border-t border-govbr-pure-0/20 flex flex-col gap-govbr-3">
          <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium py-govbr-1">Início</a>
          <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium py-govbr-1">Processos</a>
          <a href="#" class="text-govbr-pure-0 hover:underline text-govbr-sm font-medium py-govbr-1">Ajuda</a>
          <button
            class="flex items-center gap-govbr-2 text-govbr-sm font-medium py-govbr-1"
            aria-label="Buscar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            Buscar
          </button>
        </nav>
      }
    </header>
  `,
})
export class GovbrHeaderComponent {
  readonly mobileMenuAberto = signal(false);
}
