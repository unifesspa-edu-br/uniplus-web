import { describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ValorLegivelDirective } from './valor-legivel.directive';

@Component({
  standalone: true,
  imports: [ValorLegivelDirective],
  template: `
    <input class="input" id="texto" [value]="texto()" />
    <select class="input" id="escolha">
      <option value="a">Resolução do Conselho de Ensino, Pesquisa e Extensão</option>
    </select>
    <input class="input" id="fixo" title="dica do autor" [value]="texto()" />
  `,
})
class HospedeiroComponent {
  readonly texto = signal('Processo Seletivo de Medicina — ingresso 2027');
}

@Component({
  standalone: true,
  imports: [FormsModule, ValorLegivelDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input class="input" id="modelo" [ngModel]="texto()" />`,
})
class HospedeiroDeModeloComponent {
  readonly texto = signal('');
}

/** jsdom não faz layout: a largura do campo e a do conteúdo são instaladas pelo teste. */
function medir(elemento: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(elemento, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(elemento, 'clientWidth', { configurable: true, get: () => clientWidth });
}

async function montar() {
  const fixture = TestBed.createComponent(HospedeiroComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const pegar = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;
  return { fixture, texto: pegar('texto'), escolha: pegar('escolha'), fixo: pegar('fixo') };
}

describe('ValorLegivelDirective', () => {
  it('repete o valor em title quando o campo o corta', async () => {
    const { fixture, texto } = await montar();

    medir(texto, 400, 200);
    fixture.componentInstance.texto.set('Processo Seletivo de Medicina — ingresso 2028');
    fixture.detectChanges();

    expect(texto.getAttribute('title')).toBe('Processo Seletivo de Medicina — ingresso 2028');
  });

  it('não põe title quando o valor cabe, e o tira quando passa a caber', async () => {
    const { fixture, texto } = await montar();

    medir(texto, 400, 200);
    fixture.componentInstance.texto.set('um valor longo demais');
    fixture.detectChanges();
    expect(texto.getAttribute('title')).not.toBeNull();

    medir(texto, 100, 200);
    fixture.componentInstance.texto.set('curto');
    fixture.detectChanges();
    expect(texto.hasAttribute('title')).toBe(false);
  });

  it('no select, diz o rótulo da opção escolhida', async () => {
    const { fixture, escolha } = await montar();

    medir(escolha, 500, 200);
    fixture.componentInstance.texto.set('força nova verificação');
    fixture.detectChanges();
    // O select não depende do texto do hospedeiro: a largura mudou, então o campo é remedido.
    medir(escolha, 501, 200);
    (escolha as HTMLSelectElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(escolha.getAttribute('title')).toBe(
      'Resolução do Conselho de Ensino, Pesquisa e Extensão',
    );
  });

  it('respeita o title que o template declara', async () => {
    const { fixture, fixo } = await montar();

    medir(fixo, 400, 200);
    fixture.componentInstance.texto.set('outro valor');
    fixture.detectChanges();

    expect(fixo.getAttribute('title')).toBe('dica do autor');
  });

  it('com ngModel, mede o valor depois que o modelo o escreve no campo', async () => {
    const fixture = TestBed.createComponent(HospedeiroDeModeloComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const campo = fixture.nativeElement.querySelector('#modelo') as HTMLInputElement;

    medir(campo, 400, 200);
    fixture.componentInstance.texto.set('Censo 2022 — referência longa demais para o campo');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(campo.getAttribute('title')).toBe('Censo 2022 — referência longa demais para o campo');
  });
});
