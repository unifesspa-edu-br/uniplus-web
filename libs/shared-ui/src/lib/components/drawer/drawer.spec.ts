import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrawerComponent } from './drawer';

describe('DrawerComponent', () => {
  let fixture: ComponentFixture<DrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DrawerComponent] });
    fixture = TestBed.createComponent(DrawerComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.classList.remove('uni-drawer-open');
  });

  it('mantém o drawer nativo fechado por padrão', () => {
    const dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;

    expect(dialog.open).toBe(false);
    expect(document.body.classList.contains('uni-drawer-open')).toBe(false);
  });

  it('abre o drawer e bloqueia a rolagem do body', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(document.body.classList.contains('uni-drawer-open')).toBe(true);
  });

  it('remove o bloqueio de rolagem ao fechar pelo botão', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const closeButton = fixture.debugElement.query(By.css('.uni-drawer__header button'))
      .nativeElement as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(document.body.classList.contains('uni-drawer-open')).toBe(false);
  });

  it('recusa fechar pelo botão quando closable é false', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('closable', false);
    fixture.detectChanges();

    const closeButton = fixture.debugElement.query(By.css('.uni-drawer__header button'))
      .nativeElement as HTMLButtonElement;
    expect(closeButton.disabled).toBe(true);
    closeButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(true);
    const dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;
    expect(dialog.open).toBe(true);
  });

  it('usa o id informado pelo consumidor em vez do autogerado', () => {
    fixture.componentRef.setInput('id', 'meu-drawer-fixo');
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;
    expect(dialog.id).toBe('meu-drawer-fixo');
  });

  it('leva o foco ao botão de fechar por padrão', async () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Fechar');
  });

  it('leva o foco ao título quando focoInicial é "titulo"', async () => {
    fixture.componentRef.setInput('focoInicial', 'titulo');
    fixture.componentRef.setInput('heading', 'Registro Geral');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await Promise.resolve();

    expect(document.activeElement?.textContent?.trim()).toBe('Registro Geral');
  });

  it('devolve o foco ao elemento que abriu o drawer ao fechar', () => {
    const origem = document.createElement('button');
    document.body.appendChild(origem);
    origem.focus();

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('dialog')).nativeElement.dispatchEvent(new Event('close'));

    expect(document.activeElement).toBe(origem);
    origem.remove();
  });

  it('não arranca o foco de quem já seguiu para outro controle quando o fechamento chega', () => {
    const origem = document.createElement('button');
    const outro = document.createElement('button');
    document.body.append(origem, outro);
    origem.focus();

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    outro.focus();
    fixture.debugElement.query(By.css('dialog')).nativeElement.dispatchEvent(new Event('close'));

    expect(document.activeElement).toBe(outro);
    origem.remove();
    outro.remove();
  });
});
