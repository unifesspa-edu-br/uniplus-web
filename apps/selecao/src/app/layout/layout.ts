import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'sel-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen flex-col">
      <!-- Header -->
      <header class="flex h-16 items-center justify-between bg-unifesspa-primary px-6 text-white shadow-md">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-bold">Seleção — Sistema Unificado CEPS</h1>
        </div>
        <nav class="flex items-center gap-4 text-sm">
          <a routerLink="/dashboard" routerLinkActive="font-bold underline" class="hover:underline">Dashboard</a>
          <a routerLink="/editais" routerLinkActive="font-bold underline" class="hover:underline">Editais</a>
          <a routerLink="/inscricoes" routerLinkActive="font-bold underline" class="hover:underline">Inscrições</a>
          <a routerLink="/homologacao" routerLinkActive="font-bold underline" class="hover:underline">Homologação</a>
          <a routerLink="/notas" routerLinkActive="font-bold underline" class="hover:underline">Notas</a>
          <a routerLink="/classificacao" routerLinkActive="font-bold underline" class="hover:underline">Classificação</a>
        </nav>
      </header>

      <!-- Main -->
      <main class="flex-1 overflow-y-auto bg-gray-50 p-6">
        <router-outlet />
      </main>

      <!-- Footer -->
      <footer class="flex h-10 items-center justify-center bg-gray-100 text-xs text-gray-500">
        CEPS — Unifesspa &copy; {{ currentYear }}
      </footer>
    </div>
  `,
})
export class LayoutComponent {
  readonly currentYear = new Date().getFullYear();
}
