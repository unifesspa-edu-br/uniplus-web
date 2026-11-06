import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { devolverFocoAoAcionador, entreAspas } from './devolucao-de-foco';

@Component({
  selector: 'cfg-pagina-de-teste',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="titulo-da-lista" tabindex="-1">Itens</h2>
    <button id="novo" type="button">Novo</button>
    @for (id of ids(); track id) {
      <table>
        <tr [attr.data-item-id]="id">
          <td>
            <button type="button" data-acao="editar" [attr.aria-label]="'Editar ' + id">e</button>
            <button type="button" data-acao="alternar" [attr.aria-label]="'Alternar ' + id">
              a
            </button>
          </td>
        </tr>
      </table>
    }
  `,
})
class PaginaDeTesteComponent {
  readonly ids = input.required<readonly string[]>();
  readonly gravando = input.required<boolean>();
  readonly carregando = input.required<boolean>();
  readonly foco = devolverFocoAoAcionador({
    gravando: this.gravando,
    carregando: this.carregando,
    idDoTitulo: 'titulo-da-lista',
  });
}

const acionador = (acao: string, id: string): string =>
  `tr[data-item-id="${entreAspas(id)}"] button[data-acao="${acao}"]`;

describe('devolverFocoAoAcionador', () => {
  let fixture: ComponentFixture<PaginaDeTesteComponent>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botao = (rotulo: string): HTMLElement =>
    raiz().querySelector(`button[aria-label="${rotulo}"]`) as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(PaginaDeTesteComponent);
    document.body.appendChild(raiz());
    fixture.componentRef.setInput('ids', ['a', 'b']);
    fixture.componentRef.setInput('gravando', false);
    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
  });
  afterEach(() => raiz().remove());

  async function escrever(recargaPendente = false): Promise<void> {
    fixture.componentRef.setInput('gravando', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('gravando', false);
    fixture.componentRef.setInput('carregando', recargaPendente);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('devolve o foco à ação da linha acionada, não a outra ação nem a outra linha', async () => {
    fixture.componentInstance.foco.registrar(acionador('alternar', 'b'));
    await escrever();
    expect(document.activeElement).toBe(botao('Alternar b'));
  });

  it('espera a recarga terminar antes de devolver o foco', async () => {
    fixture.componentInstance.foco.registrar(acionador('editar', 'a'));
    await escrever(true);
    expect(document.activeElement).toBe(document.body);

    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(botao('Editar a'));
  });

  it('sem a linha do acionador, leva o foco ao título da lista', async () => {
    fixture.componentInstance.foco.registrar(acionador('editar', 'a'));
    fixture.componentRef.setInput('ids', ['b']);
    await escrever();
    expect(document.activeElement).toBe(raiz().querySelector('#titulo-da-lista'));
  });

  it('o acionador fora da lista é localizado pelo seletor', async () => {
    fixture.componentInstance.foco.registrar('#novo');
    await escrever();
    expect(document.activeElement).toBe(raiz().querySelector('#novo'));
  });

  it('sem acionador anotado, leva o foco ao título', async () => {
    fixture.componentInstance.foco.registrar(null);
    await escrever();
    expect(document.activeElement).toBe(raiz().querySelector('#titulo-da-lista'));
  });

  it('não toma o foco de quem já o levou a outro controle', async () => {
    fixture.componentInstance.foco.registrar(acionador('editar', 'a'));
    botao('Alternar b').focus();
    await escrever();
    expect(document.activeElement).toBe(botao('Alternar b'));
  });

  it('escapa aspas e barras do identificador no seletor', () => {
    expect(entreAspas('a"b\\c')).toBe('a\\"b\\\\c');
  });
});
