import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { FileUploadComponent } from './file-upload';

@Component({
  standalone: true,
  imports: [FileUploadComponent],
  template: `<ui-file-upload fieldLabel="Laudo" [isRequired]="true" [mensagemExterna]="erro" />`,
})
class AnfitriaoComponent {
  erro: string | null = null;
}

describe('FileUploadComponent: estado lido no controle focável', () => {
  let fixture: ComponentFixture<AnfitriaoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AnfitriaoComponent] });
    fixture = TestBed.createComponent(AnfitriaoComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  const zona = () =>
    fixture.nativeElement.querySelector('.uni-uploader__drop') as HTMLButtonElement;

  it('o botão da zona declara que o envio é obrigatório', () => {
    expect(zona().textContent).toContain('(obrigatório)');
  });

  it('com erro, o botão declara o erro e aponta a mensagem em aria-describedby', () => {
    fixture.componentInstance.erro = 'Envie o laudo.';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(zona().textContent).toContain('(obrigatório, com erro)');
    const mensagem = document.getElementById(zona().getAttribute('aria-describedby') ?? '');
    expect(mensagem?.textContent).toContain('Envie o laudo.');
  });

  it('não tem violações de acessibilidade, com e sem erro', async () => {
    fixture.componentInstance.erro = 'Envie o laudo.';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    const resultado = await axe.run(fixture.nativeElement, {
      rules: { region: { enabled: false } },
    });

    expect(resultado.violations).toEqual([]);
  });
});
