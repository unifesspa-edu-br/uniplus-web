import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { EventoDaTrilhaDto } from '@uniplus/shared-data/autorizacao';
import { formatarDataBr } from '@uniplus/shared-utils';
import { detalheDaTrilha, tipoDeEvento } from './rotulos-de-acesso';

const EMISSOR_DO_SISTEMA = 'uniplus:sistema';
const TAMANHO_DO_IDENTIFICADOR = 8;

/**
 * Quem agiu: o sistema verificador, o nome que a API gravou no instante da ação ou, no registro
 * que não o tem, o início do `sub` sem expor o identificador inteiro.
 */
export function autorDoEvento(autor: EventoDaTrilhaDto['autor']): string {
  if (autor.emissor === EMISSOR_DO_SISTEMA) return 'Verificador de documentos';
  const nome = autor.nome?.trim();
  return nome ? nome : `Pessoa ${autor.sub.slice(0, TAMANHO_DO_IDENTIFICADOR)}`;
}

/** Eventos de um pedido ou de uma concessão, em ordem cronológica. */
@Component({
  selector: 'cfg-trilha-de-acesso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (eventos().length === 0) {
      <p>Nenhum evento registrado.</p>
    } @else {
      <div class="table-responsive">
        <table class="cfg-trilha">
          <caption class="sr-only">
            {{
              legenda()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Evento</th>
              <th scope="col">Quem</th>
              <th scope="col">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            @for (evento of eventos(); track $index) {
              <tr
                class="table-responsive__row--clickable"
                tabindex="0"
                [attr.aria-expanded]="aberto() === $index"
                [attr.aria-controls]="'cfg-trilha-detalhe-' + $index"
                (click)="alternar($index)"
                (keydown.enter)="alternarPeloTeclado($index, $event)"
                (keydown.space)="alternarPeloTeclado($index, $event)"
              >
                <td data-label="Quando">{{ quando(evento) }}</td>
                <td data-label="Evento">{{ rotulo(evento.tipo) }}</td>
                <td data-label="Quem">{{ autor(evento) }}</td>
                <td data-label="Detalhe">
                  <span class="cfg-trilha__detalhe">{{ detalhe(evento) }}</span>
                </td>
              </tr>
              @if (aberto() === $index) {
                <tr class="cfg-trilha__completo" [id]="'cfg-trilha-detalhe-' + $index">
                  <td colspan="4" data-label="">
                    <dl class="cfg-detail-list" aria-label="Detalhe do evento">
                      <div>
                        <dt>Quando</dt>
                        <dd>{{ quando(evento) }}</dd>
                      </div>
                      <div>
                        <dt>Evento</dt>
                        <dd>{{ rotulo(evento.tipo) }}</dd>
                      </div>
                      <div>
                        <dt>Quem</dt>
                        <dd>{{ autor(evento) }}</dd>
                      </div>
                      <div>
                        <dt>Detalhe</dt>
                        <dd class="cfg-trilha__texto-completo">{{ evento.detalhe ?? '—' }}</dd>
                      </div>
                    </dl>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class TrilhaDeAcessoComponent {
  readonly eventos = input.required<readonly EventoDaTrilhaDto[]>();
  readonly legenda = input('Trilha de eventos');

  /** Posição do evento com o detalhe completo aberto, abaixo da linha; um por vez. */
  protected readonly aberto = signal<number | null>(null);

  protected alternar(posicao: number): void {
    this.aberto.update((atual) => (atual === posicao ? null : posicao));
  }

  /** Enter e Espaço abrem o detalhe só com a linha focada; o Espaço não rola a página. */
  protected alternarPeloTeclado(posicao: number, evento: Event): void {
    if (evento.target !== evento.currentTarget) return;
    evento.preventDefault();
    this.alternar(posicao);
  }

  protected rotulo(tipo: string): string {
    return tipoDeEvento(tipo);
  }

  /** Data e hora numa linha só: `29/10/2026 15:02`. */
  protected quando(evento: EventoDaTrilhaDto): string {
    return formatarDataBr(evento.instante, 'datetime').replace(', ', ' ');
  }

  protected detalhe(evento: EventoDaTrilhaDto): string {
    return detalheDaTrilha(evento.detalhe);
  }

  protected autor(evento: EventoDaTrilhaDto): string {
    return autorDoEvento(evento.autor);
  }
}
