import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { cpfRevelavel } from '@uniplus/shared-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { DadoRevelavelComponent } from './dado-revelavel';

/** Fernanda Drumond e Kevin Carvalho, personas fictícias do portal de documentação. */
const CPF = cpfRevelavel('69959836371');
const OUTRO_CPF = cpfRevelavel('33257350376');

describe('DadoRevelavelComponent', () => {
  let fixture: ComponentFixture<DadoRevelavelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DadoRevelavelComponent] });
    fixture = TestBed.createComponent(DadoRevelavelComponent);
  });

  function render(entradas: Record<string, unknown>): HTMLElement {
    for (const [nome, valor] of Object.entries({ rotulo: 'CPF', dado: CPF, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const botao = (host: HTMLElement): HTMLButtonElement | null => host.querySelector('button');
  const tela = (host: HTMLElement): string =>
    host.querySelector('.dado-revelavel__tela')?.textContent?.trim() ?? '';
  const anuncio = (host: HTMLElement): string =>
    host.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  const alternar = (host: HTMLElement): void => {
    botao(host)?.click();
    fixture.detectChanges();
  };

  it('abre mascarado, com os asteriscos fora do leitor de tela e o que a máscara deixa ver', () => {
    const host = render({});

    const visual = host.querySelector('.dado-revelavel__tela [aria-hidden="true"]');
    expect(visual?.textContent).toBe('***.598.363-**');
    expect(host.querySelector('.dado-revelavel__tela .sr-only')?.textContent).toBe(
      'CPF parcialmente oculto: 598.363',
    );
    expect(host.textContent).not.toContain('699');
  });

  it('o botão tem nome fixo, diz o estado por aria-pressed e controla o valor', () => {
    const host = render({ id: 'cpf-do-titular' });

    expect(botao(host)?.getAttribute('aria-label')).toBe('Mostrar CPF');
    expect(botao(host)?.getAttribute('aria-pressed')).toBe('false');
    expect(botao(host)?.getAttribute('aria-controls')).toBe('cpf-do-titular');
    expect(host.querySelector('#cpf-do-titular')).not.toBeNull();

    alternar(host);
    expect(tela(host)).toBe('699.598.363-71');
    expect(botao(host)?.getAttribute('aria-label')).toBe('Mostrar CPF');
    expect(botao(host)?.getAttribute('aria-pressed')).toBe('true');

    alternar(host);
    expect(tela(host)).not.toContain('699');
    expect(botao(host)?.getAttribute('aria-pressed')).toBe('false');
  });

  it('anuncia o estado só depois do pedido e sem ler os dígitos', () => {
    const host = render({});
    expect(anuncio(host)).toBe('');

    alternar(host);
    expect(anuncio(host)).toBe('CPF visível');

    alternar(host);
    expect(anuncio(host)).toBe('CPF oculto');
  });

  it('volta a mascarar quando o dado muda', () => {
    const host = render({});
    alternar(host);

    fixture.componentRef.setInput('dado', OUTRO_CPF);
    fixture.detectChanges();

    expect(botao(host)?.getAttribute('aria-pressed')).toBe('false');
    expect(tela(host)).not.toContain('332');
    expect(anuncio(host)).toBe('');
  });

  it('o papel recebe o dado mascarado mesmo quando revelado na tela', () => {
    const host = render({});
    alternar(host);

    const papel = host.querySelector('.dado-revelavel__papel');
    expect(papel?.textContent).toBe('***.598.363-**');
    expect(papel?.getAttribute('aria-hidden')).toBe('true');
    expect(papel?.classList.contains('u-print-only')).toBe(true);
    expect(host.querySelector('.dado-revelavel__tela')?.classList.contains('u-no-print')).toBe(
      true,
    );
    expect(botao(host)?.classList.contains('u-no-print')).toBe(true);
  });

  it('sem os 11 dígitos, oculta tudo e não oferece o botão', () => {
    const host = render({ dado: cpfRevelavel('6995983637') });

    expect(botao(host)).toBeNull();
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('.dado-revelavel__tela .sr-only')?.textContent).toBe('CPF oculto');
  });

  it('como campo, é o input somente leitura do id dado, com a leitura e as descrições do campo', () => {
    const host = render({ aparencia: 'campo', id: 'campo-cpf', descritoPor: 'campo-cpf-fixa' });

    const input = host.querySelector('input') as HTMLInputElement;
    expect(input.id).toBe('campo-cpf');
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('***.598.363-**');
    expect(input.getAttribute('aria-describedby')).toBe('campo-cpf-leitura campo-cpf-fixa');
    expect(host.querySelector('#campo-cpf-leitura')?.textContent).toBe(
      'CPF parcialmente oculto: 598.363',
    );

    alternar(host);
    expect(input.value).toBe('699.598.363-71');
    expect(input.getAttribute('aria-describedby')).toBe('campo-cpf-fixa');
  });
});
