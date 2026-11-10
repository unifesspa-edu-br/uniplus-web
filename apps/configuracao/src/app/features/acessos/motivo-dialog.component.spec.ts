import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { MotivoDialogComponent } from './motivo-dialog.component';

@Component({
  standalone: true,
  imports: [MotivoDialogComponent],
  template: `<cfg-motivo-dialog
    [(visible)]="aberto"
    heading="Recusar pedido"
    confirmLabel="Recusar"
    [motivo]="motivo"
    [tentou]="tentou()"
    [enviando]="enviando()"
    (confirmado)="confirmar()"
  />`,
})
class HospedeComponent {
  readonly aberto = signal(true);
  readonly enviando = signal(false);
  readonly tentou = signal(false);
  readonly motivo = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly motivos: string[] = [];
  confirmar(): void {
    this.tentou.set(true);
    if (this.motivo.valid) this.motivos.push(this.motivo.value.trim());
  }
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
    return {
      fixture,
      host,
      campo: host.querySelector('textarea') as HTMLTextAreaElement,
      botao: host.querySelector('.btn--danger') as HTMLButtonElement,
    };
  }

  it('emite a confirmação com o motivo informado ao hospedeiro', () => {
    const { fixture, campo, botao } = montar();
    expect(campo.getAttribute('aria-required')).toBe('true');
    campo.value = '  Saiu da função.  ';
    campo.dispatchEvent(new Event('input'));
    botao.click();
    expect(fixture.componentInstance.motivos).toEqual(['Saiu da função.']);
  });

  it('apresenta a recusa do campo', () => {
    const { fixture, host, campo } = montar();
    fixture.componentInstance.motivo.setErrors({ backend: { message: 'Motivo recusado.' } });
    fixture.componentInstance.motivo.markAsTouched();
    fixture.componentInstance.tentou.set(true);
    fixture.detectChanges();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Motivo recusado.');
  });

  it('liga o campo à ajuda e, quando há erro, ao erro anunciado', () => {
    const { fixture, host, campo } = montar();
    const ajuda = host.querySelector('.field__hint');
    expect(campo.getAttribute('aria-describedby')).toBe(ajuda?.id);

    fixture.componentInstance.tentou.set(true);
    fixture.detectChanges();
    const erro = host.querySelector('.field__error');
    expect(erro?.getAttribute('role')).toBe('alert');
    expect(campo.getAttribute('aria-describedby')).toBe(`${ajuda?.id} ${erro?.id}`);
  });

  it('liga o campo ao erro que a API recusou', () => {
    const { fixture, host, campo } = montar();
    fixture.componentInstance.motivo.setValue('Motivo');
    fixture.componentInstance.motivo.setErrors({ backend: { message: 'Motivo recusado.' } });
    fixture.componentInstance.motivo.markAsTouched();
    fixture.componentInstance.tentou.set(true);
    fixture.detectChanges();

    const erro = host.querySelector('.field__error');
    expect(erro?.textContent).toContain('Motivo recusado.');
    expect(campo.getAttribute('aria-describedby')).toContain(erro?.id ?? 'sem-erro');
  });

  it('dois diálogos de motivo na mesma página têm ids distintos', () => {
    const a = TestBed.createComponent(HospedeComponent);
    const b = TestBed.createComponent(HospedeComponent);
    a.detectChanges();
    b.detectChanges();

    const ids = [a, b].map((f) => (f.nativeElement as HTMLElement).querySelector('.field__hint')?.id);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('bloqueia o fechamento, o campo e nova confirmação durante o envio', () => {
    const { fixture, host, campo, botao } = montar();
    fixture.componentInstance.motivo.setValue('Motivo');
    fixture.componentInstance.enviando.set(true);
    fixture.detectChanges();
    expect(campo.matches(':disabled')).toBe(true);
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Enviando decisão');
    expect((host.querySelector('.btn--tertiary') as HTMLButtonElement).disabled).toBe(true);
    botao.click();
    (host.querySelector('dialog') as HTMLDialogElement).dispatchEvent(
      new Event('cancel', { cancelable: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.aberto()).toBe(true);
    expect(fixture.componentInstance.motivos).toEqual([]);
  });
});
