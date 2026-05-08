import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth';

@Component({
  selector: 'ptl-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, UserHeaderInfoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col">
      <header class="flex h-16 items-center justify-between bg-govbr-primary px-6 text-white shadow-md">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-bold">Portal do Candidato — Unifesspa</h1>
        </div>
        <nav class="flex items-center gap-4 text-sm">
          <a routerLink="/processos" routerLinkActive="font-bold underline" class="hover:underline">Processos</a>
          <a routerLink="/acompanhamento" routerLinkActive="font-bold underline" class="hover:underline">Acompanhamento</a>
          <a routerLink="/documentos" routerLinkActive="font-bold underline" class="hover:underline">Documentos</a>
          <a routerLink="/perfil" routerLinkActive="font-bold underline" class="hover:underline">Meu Perfil</a>
        </nav>
        <auth-user-header-info />
      </header>
      <main class="flex-1 bg-gray-50 p-6">
        <router-outlet />
      </main>
      <footer class="flex h-10 items-center justify-center bg-govbr-gray-2 text-xs text-govbr-gray-60">
        Uni+ — Unifesspa &copy; {{ currentYear }}
      </footer>
    </div>
  `,
})
export class LayoutComponent {
  readonly currentYear = new Date().getFullYear();
}
