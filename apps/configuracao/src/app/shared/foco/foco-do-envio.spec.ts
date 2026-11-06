import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acompanharFocoDoEnvio, focarPrimeiroCampoInvalido } from './foco-do-envio';

@Component({
  selector: 'cfg-formulario-de-teste',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input id="fora" />
    <form id="f">
      <fieldset [disabled]="salvando()">
        <input id="a" aria-invalid="false" />
        <input id="b" [attr.aria-invalid]="invalidoB() ? 'true' : null" />
        <div class="endereco">
          <ui-valor-de-municipio><input id="cidade" aria-invalid="true" /></ui-valor-de-municipio>
        </div>
        <input id="c" [attr.aria-invalid]="invalidoC() ? 'true' : null" />
      </fieldset>
      <button type="submit" id="salvar">Salvar</button>
    </form>
  `,
})
class FormularioDeTesteComponent {
  readonly salvando = input.required<boolean>();
  readonly aberto = input.required<boolean>();
  readonly invalidoB = input(false);
  readonly invalidoC = input(false);
  readonly focarEndereco = vi.fn();
  readonly foco = acompanharFocoDoEnvio({
    salvando: this.salvando,
    aberto: this.aberto,
    focarEndereco: this.focarEndereco,
  });
}

describe('acompanharFocoDoEnvio', () => {
  let fixture: ComponentFixture<FormularioDeTesteComponent>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = (id: string): HTMLElement => raiz().querySelector(`#${id}`) as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(FormularioDeTesteComponent);
    document.body.appendChild(raiz());
    fixture.componentRef.setInput('salvando', false);
    fixture.componentRef.setInput('aberto', true);
    fixture.detectChanges();
  });
  afterEach(() => raiz().remove());

  async function definir(entradas: Record<string, boolean>): Promise<void> {
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('o envio iniciado num campo leva o foco ao botão de salvar', async () => {
    campo('a').focus();
    await definir({ salvando: true });
    expect(document.activeElement).toBe(campo('salvar'));
  });

  it('o envio iniciado fora dos campos não move o foco', async () => {
    campo('fora').focus();
    await definir({ salvando: true });
    expect(document.activeElement).toBe(campo('fora'));
  });

  it('ao terminar com a gaveta aberta, leva o foco ao primeiro campo recusado', async () => {
    campo('salvar').focus();
    await definir({ salvando: true });
    await definir({ salvando: false, invalidoB: true, invalidoC: true });
    expect(document.activeElement).toBe(campo('b'));
  });

  it('ao terminar sem campo recusado, deixa o foco no botão e aciona o endereço', async () => {
    campo('a').focus();
    await definir({ salvando: true });
    await definir({ salvando: false });
    expect(document.activeElement).toBe(campo('salvar'));
    expect(fixture.componentInstance.focarEndereco).toHaveBeenCalledTimes(1);
  });

  it('ao terminar com a gaveta fechada, não procura campo nem endereço', async () => {
    campo('a').focus();
    await definir({ salvando: true });
    await definir({ aberto: false, salvando: false, invalidoB: true });
    expect(document.activeElement).toBe(campo('salvar'));
    expect(fixture.componentInstance.focarEndereco).not.toHaveBeenCalled();
  });

  it('o envio barrado leva o foco ao primeiro campo inválido depois da renderização', async () => {
    await definir({ invalidoC: true });
    fixture.componentInstance.foco.focarPrimeiroInvalido();
    await fixture.whenStable();
    expect(document.activeElement).toBe(campo('c'));
  });
});

describe('focarPrimeiroCampoInvalido', () => {
  const montar = (html: string): HTMLElement => {
    const raiz = document.createElement('div');
    raiz.innerHTML = html;
    document.body.appendChild(raiz);
    return raiz;
  };

  it('ignora o campo de cidade e o campo desabilitado e informa quando não achou', () => {
    const raiz = montar(
      '<ui-valor-de-municipio><input id="c" aria-invalid="true"></ui-valor-de-municipio>' +
        '<input id="d" aria-invalid="true" disabled>',
    );
    expect(focarPrimeiroCampoInvalido(raiz)).toBe(false);
    expect(document.activeElement).toBe(document.body);
    raiz.remove();
  });

  it('segue a ordem da tela', () => {
    const raiz = montar('<input id="x" aria-invalid="true"><input id="y" aria-invalid="true">');
    expect(focarPrimeiroCampoInvalido(raiz)).toBe(true);
    expect(document.activeElement).toBe(raiz.querySelector('#x'));
    raiz.remove();
  });
});
