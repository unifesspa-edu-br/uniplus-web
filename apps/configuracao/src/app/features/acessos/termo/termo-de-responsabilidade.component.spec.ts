import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { acompanharLeitura } from '@uniplus/shared-ui/components';
import { versaoDoTermo } from '../testes';
import { TermoDeResponsabilidadeComponent } from './termo-de-responsabilidade.component';

describe('TermoDeResponsabilidadeComponent', () => {
  function montar(aceite: FormControl<boolean>) {
    const fixture = TestBed.createComponent(TermoDeResponsabilidadeComponent);
    fixture.componentRef.setInput('versao', versaoDoTermo());
    fixture.componentRef.setInput('aceite', aceite);
    fixture.componentRef.setInput('tentou', true);
    fixture.detectChanges();
    return fixture;
  }

  it('acompanha a marcação feita por código: o erro e o aria-invalid saem e voltam', async () => {
    const aceite = new FormControl(false, { nonNullable: true });
    const fixture = montar(aceite);
    const host = fixture.nativeElement as HTMLElement;
    const caixa = () => host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(caixa()?.getAttribute('aria-invalid')).toBe('true');

    aceite.setValue(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(caixa()?.getAttribute('aria-invalid')).toBeNull();
    expect(host.textContent).not.toContain('Marque o aceite do termo para continuar.');

    aceite.setValue(false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.textContent).toContain('Marque o aceite do termo para continuar.');
  });

  it('com a leitura em falha, mostra a falha com "Tentar novamente" e repete a leitura', async () => {
    const recarregar = vi.fn(() => true);
    const leitura = TestBed.runInInjectionContext(() =>
      acompanharLeitura({
        falha: signal('Não foi possível carregar o termo.'),
        pendente: signal(false),
        recarregar,
        destino: () => null,
      }),
    );
    const fixture = TestBed.createComponent(TermoDeResponsabilidadeComponent);
    fixture.componentRef.setInput('leitura', leitura);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('ui-falha-de-leitura')?.textContent).toContain(
      'Não foi possível carregar o termo.',
    );
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Tentar novamente')
      ?.click();

    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});
