import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import {
  RevogarConcessaoDialogComponent,
  type ConfirmacaoDaRevogacao,
} from './revogar-concessao-dialog.component';

const concessao: ConcessaoDto = {
  id: 'c1',
  beneficiario: { emissor: 'unifesspa', sub: '0123456789abcdef', nome: 'Betina Marina das Neves' },
  perfil: { id: 'p1', nome: 'Operador de inscrições' },
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  origem: { tipo: 'pedido', id: 'pedido-1' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  motivoRevogacao: null,
  ativa: true,
};

@Component({
  standalone: true,
  imports: [RevogarConcessaoDialogComponent],
  template: `<cfg-revogar-concessao-dialog
    [(visible)]="aberto"
    [concessao]="concessao"
    escopoDaConcessao="CEPS"
    [erroDoEmail]="erroDoEmail()"
    (confirmado)="enviados.push($event)"
  />`,
})
class HospedeComponent {
  readonly aberto = signal(false);
  readonly concessao = concessao;
  readonly erroDoEmail = signal<string | null>(null);
  readonly enviados: ConfirmacaoDaRevogacao[] = [];
}

describe('RevogarConcessaoDialogComponent', () => {
  function montar() {
    window.HTMLDialogElement.prototype.showModal ??= function () {
      this.setAttribute('open', '');
    };
    window.HTMLDialogElement.prototype.close ??= function () {
      this.removeAttribute('open');
    };
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HospedeComponent);
    fixture.detectChanges();
    fixture.componentInstance.aberto.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const digitar = (seletor: string, valor: string) => {
      const campo = host.querySelector(seletor) as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const botao = () => host.querySelector('.btn--danger') as HTMLButtonElement;
    return { fixture, host, digitar, botao };
  }

  it('mostra a concessão e mantém o botão inativo até o e-mail ser preenchido', () => {
    const { host, digitar, botao } = montar();

    expect(host.textContent).toContain('Betina Marina das Neves');
    expect(host.textContent).toContain('Operador de inscrições');
    expect(host.textContent).toContain('CEPS');
    expect(host.textContent).toContain('Sem prazo');
    expect(botao().disabled).toBe(true);

    digitar('input[type="email"]', '  betina@uniplus-test.local ');

    expect(botao().disabled).toBe(false);
  });

  it('emite o e-mail e o motivo sem espaços nas pontas', () => {
    const { fixture, digitar, botao } = montar();

    digitar('input[type="email"]', ' betina@uniplus-test.local ');
    digitar('textarea', ' Saiu da função. ');
    botao().click();

    expect(fixture.componentInstance.enviados).toEqual([
      { motivo: 'Saiu da função.', confirmacaoEmail: 'betina@uniplus-test.local' },
    ]);
  });

  it('exige o motivo mesmo com o e-mail preenchido', () => {
    const { fixture, host, digitar, botao } = montar();

    digitar('input[type="email"]', 'betina@uniplus-test.local');
    botao().click();
    fixture.detectChanges();

    expect(fixture.componentInstance.enviados).toEqual([]);
    expect(host.textContent).toContain('Informe o motivo');
  });

  it('mostra no campo de e-mail a recusa por divergência', () => {
    const { fixture, host } = montar();

    fixture.componentInstance.erroDoEmail.set('O e-mail informado não é o do beneficiário.');
    fixture.detectChanges();

    expect(host.querySelector('.field__error')?.textContent).toContain('não é o do beneficiário');
    expect(host.querySelector('input[type="email"]')?.getAttribute('aria-invalid')).toBe('true');
  });
});
