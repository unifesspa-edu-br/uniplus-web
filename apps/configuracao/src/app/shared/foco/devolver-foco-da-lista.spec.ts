import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { devolverFocoDaLista } from './devolver-foco-da-lista';

@Component({
  selector: 'cfg-lista-de-teste',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="titulo-da-lista" tabindex="-1">Itens</h2>
    <button id="novo" type="button">Novo</button>
    @for (id of ids(); track id) {
      <table>
        <tr [attr.data-item-id]="id">
          <td>
            <button type="button" [attr.aria-label]="'Editar item ' + id">e</button>
            <button type="button" [attr.aria-label]="'Remover item ' + id">r</button>
          </td>
        </tr>
      </table>
    }
  `,
})
class ListaDeTesteComponent {
  readonly ids = input.required<readonly string[]>();
  readonly gravando = input.required<boolean>();
  readonly carregando = input.required<boolean>();
  readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-item-id',
    idDoTitulo: 'titulo-da-lista',
    idDoCadastro: 'novo',
  });
}

describe('devolverFocoDaLista', () => {
  let fixture: ComponentFixture<ListaDeTesteComponent>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botao = (rotulo: string): HTMLElement =>
    raiz().querySelector(`button[aria-label="${rotulo}"]`) as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaDeTesteComponent);
    document.body.appendChild(raiz());
    fixture.componentRef.setInput('ids', ['a', 'b']);
    fixture.componentRef.setInput('gravando', false);
    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
  });
  afterEach(() => raiz().remove());

  async function escrever(
    carregamento: { aposGravar: boolean } = { aposGravar: false },
  ): Promise<void> {
    fixture.componentRef.setInput('gravando', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('gravando', false);
    fixture.componentRef.setInput('carregando', carregamento.aposGravar);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('devolve o foco à ação da linha acionada, não a outra ação nem a outra linha', async () => {
    fixture.componentInstance.foco.registrar({ acao: 'remover', id: 'b' });
    await escrever();
    expect(document.activeElement).toBe(botao('Remover item b'));
  });

  it('espera a recarga terminar antes de devolver o foco', async () => {
    fixture.componentInstance.foco.registrar({ acao: 'editar', id: 'a' });
    await escrever({ aposGravar: true });
    expect(document.activeElement).toBe(document.body);

    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(botao('Editar item a'));
  });

  it('sem a linha do acionador, leva o foco ao título da lista', async () => {
    fixture.componentInstance.foco.registrar({ acao: 'editar', id: 'a' });
    fixture.componentRef.setInput('ids', ['b']);
    await escrever();
    expect(document.activeElement).toBe(raiz().querySelector('#titulo-da-lista'));
  });

  it('o cadastro devolve o foco ao botão de cadastro', async () => {
    fixture.componentInstance.foco.registrar(null);
    await escrever();
    expect(document.activeElement).toBe(raiz().querySelector('#novo'));
  });

  it('não toma o foco de quem já o levou a outro controle', async () => {
    fixture.componentInstance.foco.registrar({ acao: 'editar', id: 'a' });
    botao('Remover item b').focus();
    await escrever();
    expect(document.activeElement).toBe(botao('Remover item b'));
  });

  it('uma escrita que ninguém acionou pela lista não move o foco', async () => {
    await escrever();
    expect(document.activeElement).toBe(document.body);
  });

  describe('escrita recusada e refeita a partir do mesmo acionador', () => {
    const recusarEPerderOFoco = async (): Promise<void> => {
      fixture.componentInstance.foco.registrar({ acao: 'editar', id: 'a' });
      await escrever();
      expect(document.activeElement).toBe(botao('Editar item a'));
      (document.activeElement as HTMLElement).blur();
      expect(document.activeElement).toBe(document.body);
    };

    it('devolve o foco ao acionador quando a repetição conclui com a linha na recarga', async () => {
      await recusarEPerderOFoco();
      await escrever({ aposGravar: true });
      fixture.componentRef.setInput('carregando', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(botao('Editar item a'));
    });

    it('leva o foco ao título quando a repetição conclui sem a linha na recarga', async () => {
      await recusarEPerderOFoco();
      await escrever({ aposGravar: true });
      fixture.componentRef.setInput('ids', ['b']);
      fixture.componentRef.setInput('carregando', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#titulo-da-lista'));
    });
  });
});
