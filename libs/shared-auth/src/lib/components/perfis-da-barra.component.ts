import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PerfisDeAcessoService } from '@uniplus/shared-auth/bootstrap';

/**
 * Linha do perfil no rodapé da barra lateral: o primeiro perfil concedido e `+N` quando há outros,
 * com os demais em texto visualmente oculto para o leitor de tela. Sem perfil, durante a carga ou
 * quando a consulta falha, mostra o `@usuário`.
 */
@Component({
  selector: 'auth-perfis-da-barra',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="perfis" data-testid="sidebar-user-perfil">
      @if (resumo(); as perfil) {
        <span class="perfis__primeiro">{{ perfil.primeiro }}</span>
        @if (perfil.demais.length) {
          <span class="perfis__demais" aria-hidden="true">+{{ perfil.demais.length }}</span>
          <span class="sr-only">, e mais: {{ perfil.demais.join(', ') }}</span>
        }
      } @else {
        <span class="perfis__primeiro">&#64;{{ username() }}</span>
      }
    </span>
  `,
  // O texto herda o estilo de `.sidebar__user-info span`; o host some do layout para o `span`
  // continuar sendo o item da coluna. Só o primeiro rótulo é cortado, para o `+N` seguir visível.
  styles: `
    :host {
      display: contents;
    }
    .perfis {
      display: flex;
      gap: 0.25em;
      white-space: nowrap;
    }
    .perfis__primeiro {
      min-width: 0;
    }
    .perfis__demais {
      flex-shrink: 0;
    }
  `,
})
export class PerfisDaBarraComponent {
  private readonly perfis = inject(PerfisDeAcessoService);

  readonly username = input.required<string>();

  protected readonly resumo = computed(() => {
    const [primeiro, ...demais] = this.perfis.rotulos();
    return this.perfis.estado() === 'carregada' && primeiro !== undefined
      ? { primeiro, demais }
      : null;
  });
}
