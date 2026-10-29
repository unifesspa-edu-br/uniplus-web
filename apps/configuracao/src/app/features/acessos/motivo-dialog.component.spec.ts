import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MotivoDialogComponent } from './motivo-dialog.component';

@Component({
  standalone: true,
  imports: [MotivoDialogComponent],
  template: `<cfg-motivo-dialog
    [(visible)]="aberto"
    heading="Revogar"
    confirmLabel="Revogar"
    (confirmado)="motivos.push($event)"
  />`,
})
class HospedeComponent {
  readonly aberto = signal(false);
  readonly motivos: string[] = [];
}

describe('MotivoDialogComponent', () => {
  function montar() {
    window.HTMLDialogElement.prototype.showModal ??= function () {
      this.setAttribute('open', '');
    };
    window.HTMLDialogElement.prototype.close ??= function () {
      this.removeAttribute('open');
    };
    const fixture = TestBed.createComponent(HospedeComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const campo = () => host.querySelector('textarea') as HTMLTextAreaElement;
    const abrir = () => {
      fixture.componentInstance.aberto.set(true);
      fixture.detectChanges();
    };
    const confirmar = () => {
      (host.querySelector('.btn--danger') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, host, campo, abrir, confirmar };
  }

  it('emite o motivo digitado, sem espaços nas pontas', () => {
    const { fixture, campo, abrir, confirmar } = montar();
    abrir();

    campo().value = '  Saiu da função.  ';
    campo().dispatchEvent(new Event('input'));
    confirmar();

    expect(fixture.componentInstance.motivos).toEqual(['Saiu da função.']);
  });

  it('não marca o motivo preenchido como obrigatório quando só está enviando', () => {
    const fixture = TestBed.createComponent(MotivoDialogComponent);
    fixture.componentRef.setInput('heading', 'Revogar');
    fixture.componentRef.setInput('confirmLabel', 'Revogar');
    fixture.componentRef.setInput('enviando', true);
    const dialogo = fixture.componentInstance as unknown as {
      motivo: { setValue(v: string): void; errors: unknown };
      confirmar(): void;
    };
    dialogo.motivo.setValue('Saiu da função.');

    dialogo.confirmar();

    expect(dialogo.motivo.errors).toBeNull();
  });

  it('reabre sem o motivo nem o erro da vez anterior', () => {
    const { fixture, host, campo, abrir, confirmar } = montar();
    abrir();
    campo().value = 'Motivo da concessão A';
    campo().dispatchEvent(new Event('input'));
    confirmar();
    fixture.componentInstance.aberto.set(false);
    fixture.detectChanges();

    abrir();

    expect(campo().value).toBe('');
    confirmar();
    expect(fixture.componentInstance.motivos).toEqual(['Motivo da concessão A']);
    expect(host.textContent).toContain('Informe o motivo');

    fixture.componentInstance.aberto.set(false);
    fixture.detectChanges();
    abrir();
    expect(host.textContent).not.toContain('Informe o motivo, em até');
  });
});
