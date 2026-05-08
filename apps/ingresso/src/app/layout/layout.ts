import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth';

@Component({
  selector: 'ing-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, UserHeaderInfoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen flex-col">
      <header class="flex h-16 items-center justify-between bg-govbr-success px-6 text-white shadow-md">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-bold">Ingresso — Uni+</h1>
        </div>
        <nav class="flex items-center gap-4 text-sm">
          <a routerLink="/dashboard" routerLinkActive="font-bold underline" class="hover:underline">Dashboard</a>
          <a routerLink="/chamadas" routerLinkActive="font-bold underline" class="hover:underline">Chamadas</a>
          <a routerLink="/convocacoes" routerLinkActive="font-bold underline" class="hover:underline">Convocações</a>
          <a routerLink="/matriculas" routerLinkActive="font-bold underline" class="hover:underline">Matrículas</a>
        </nav>
        <auth-user-header-info />
      </header>
      <main class="flex-1 overflow-y-auto bg-gray-50 p-6">
        <router-outlet />
      </main>
      <footer class="flex h-10 items-center justify-center bg-govbr-gray-2 text-xs text-govbr-gray-60">
        CRCA — Unifesspa &copy; {{ currentYear }}
      </footer>
    </div>
  `,
})
export class LayoutComponent {
  readonly currentYear = new Date().getFullYear();
}
