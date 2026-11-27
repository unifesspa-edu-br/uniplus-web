import { ChangeDetectionStrategy, Component, ElementRef, model, viewChildren } from '@angular/core';

import { abaPelaTecla } from '../../../aba-pela-tecla';

const ABAS = [
  { codigo: 'acompanhamento', rotulo: 'Acompanhamento' },
  { codigo: 'inscricoes', rotulo: 'Inscrições' },
  { codigo: 'homologacao', rotulo: 'Homologação' },
  { codigo: 'notas', rotulo: 'Notas' },
  { codigo: 'relatorios', rotulo: 'Relatórios' },
] as const;

export type CodigoDaAba = (typeof ABAS)[number]['codigo'];

export const idDaAba = (codigo: CodigoDaAba): string => `processo-aba-${codigo}`;

export const idDoPainel = (codigo: CodigoDaAba): string => `processo-painel-${codigo}`;

/**
 * Lista de abas da página do processo. Os painéis são de quem a usa, com os ids de `idDoPainel`.
 * Em tela estreita as abas quebram linha em vez de rolar na horizontal.
 */
@Component({
  selector: 'sel-abas-do-processo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './abas-do-processo.component.css',
  template: `
    <div class="abas" role="tablist" aria-label="Áreas do processo seletivo">
      @for (aba of abas; track aba.codigo; let indice = $index) {
        <button
          #botao
          type="button"
          role="tab"
          class="abas__aba"
          [id]="idDaAba(aba.codigo)"
          [attr.aria-selected]="aba.codigo === selecionada()"
          [attr.aria-controls]="idDoPainel(aba.codigo)"
          [attr.tabindex]="aba.codigo === selecionada() ? 0 : -1"
          (click)="selecionada.set(aba.codigo)"
          (keydown)="navegar($event, indice)"
        >
          {{ aba.rotulo }}
        </button>
      }
    </div>
  `,
})
export class AbasDoProcessoComponent {
  readonly selecionada = model.required<CodigoDaAba>();

  protected readonly abas = ABAS;
  protected readonly idDaAba = idDaAba;
  protected readonly idDoPainel = idDoPainel;

  private readonly botoes = viewChildren<ElementRef<HTMLButtonElement>>('botao');

  /** Setas, Home e End trocam de aba e levam o foco a ela: só a aba ativa entra na ordem do Tab. */
  protected navegar(evento: KeyboardEvent, indice: number): void {
    const destino = abaPelaTecla(evento.key, indice, ABAS.length);
    if (destino === null) return;
    evento.preventDefault();
    this.selecionada.set(ABAS[destino].codigo);
    this.botoes()[destino].nativeElement.focus();
  }
}
