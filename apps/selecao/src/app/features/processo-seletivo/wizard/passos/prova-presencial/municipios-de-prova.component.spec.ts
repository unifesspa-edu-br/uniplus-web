import { By } from '@angular/platform-browser';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  BUSCA_DE_MUNICIPIOS,
  NomesDeMunicipios,
  ValorDeMunicipioComponent,
} from '@uniplus/shared-ui/components';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { RecusaOrdenada } from '../../shared/recusas/ordem-das-recusas';
import type { MunicipioDeProva } from './declaracao-da-prova-presencial';
import { MunicipiosDeProvaComponent } from './municipios-de-prova.component';

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
const BELEM = { codigoIbge: '1501402', nome: 'Belém', uf: 'PA' };
const RECUSA: RecusaOrdenada = {
  campo: 'municipios',
  codigo: 'Prova.SemMunicipio',
  mensagem: 'Escolha um município.',
  pagina: 'https://exemplo.org/erros/Prova.SemMunicipio',
  ordem: 0,
  resposta: 1,
  origem: 'gravacao',
  aConferir: false,
};

function preparar(municipios: readonly MunicipioDeProva[] = [MARABA, BELEM]) {
  TestBed.configureTestingModule({ imports: [MunicipiosDeProvaComponent] });
  TestBed.overrideComponent(MunicipiosDeProvaComponent, {
    set: {
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [MARABA] }) },
      ],
    },
  });
  const fixture = TestBed.createComponent(MunicipiosDeProvaComponent);
  fixture.componentRef.setInput('municipios', municipios);
  fixture.detectChanges();
  return fixture;
}

function observarAdicoes(fixture: ComponentFixture<MunicipiosDeProvaComponent>) {
  const adicionado = vi.fn();
  fixture.componentInstance.municipioAdicionado.subscribe(adicionado);
  return adicionado;
}

function observarRemocaoQueDeixaSoBelem(fixture: ComponentFixture<MunicipiosDeProvaComponent>) {
  const removido = vi.fn();
  fixture.componentInstance.municipioRemovido.subscribe((codigo) => {
    removido(codigo);
    fixture.componentRef.setInput('municipios', [BELEM]);
  });
  return removido;
}

function buscaDeMunicipio(fixture: ComponentFixture<MunicipiosDeProvaComponent>) {
  return fixture.debugElement.query(By.directive(ValorDeMunicipioComponent)).componentInstance;
}

async function buscarEEscolherPeloTeclado(
  fixture: ComponentFixture<MunicipiosDeProvaComponent>,
  campo: HTMLInputElement,
  texto: string,
): Promise<void> {
  campo.focus();
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
  await new Promise((resolve) => setTimeout(resolve, 350));
  fixture.detectChanges();
  campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  fixture.detectChanges();
}

function conferirRecusaVinculada(tela: HTMLElement, elemento: Element | null): void {
  const ids = elemento?.getAttribute('aria-describedby')?.split(' ');
  const recusa = tela.querySelector(`#${ids?.at(-1)}`);
  expect(recusa?.textContent).toContain(RECUSA.codigo);
  expect(recusa?.querySelector('a')?.textContent).toContain('Entenda a recusa');
}

describe('MunicipiosDeProvaComponent', () => {
  it('permite buscar pelo nome e escolher pelo teclado', async () => {
    const fixture = preparar([]);
    const adicionado = observarAdicoes(fixture);
    const campo = (fixture.nativeElement as HTMLElement).querySelector('input');
    expect(campo).not.toBeNull();
    if (!campo) return;
    await buscarEEscolherPeloTeclado(fixture, campo, 'Mar');
    expect(adicionado).toHaveBeenCalledWith(MARABA);
  });

  it('emite a escolha encontrada uma vez e anuncia a adição', () => {
    const fixture = preparar([]);
    const adicionado = observarAdicoes(fixture);
    TestBed.inject(NomesDeMunicipios).lembrar([MARABA]);
    const busca = buscaDeMunicipio(fixture);
    busca.valuesChange.emit([MARABA.codigoIbge]);
    fixture.componentRef.setInput('municipios', [MARABA]);
    fixture.detectChanges();
    busca.valuesChange.emit([MARABA.codigoIbge]);
    expect(adicionado).toHaveBeenCalledTimes(1);
    expect(adicionado).toHaveBeenCalledWith(MARABA);
    expect(fixture.nativeElement.textContent).toContain('Município adicionado: Marabá (PA).');
  });

  it('emite a remoção, anuncia e foca o próximo botão depois da atualização', async () => {
    const fixture = preparar();
    const removido = observarRemocaoQueDeixaSoBelem(fixture);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(removido).toHaveBeenCalledWith(MARABA.codigoIbge);
    expect(fixture.nativeElement.textContent).toContain('Município removido: Marabá (PA).');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remover Belém (PA)');
  });

  it('associa as recusas da lista e do município com código e link', () => {
    const fixture = preparar();
    fixture.componentRef.setInput('recusasDaLista', [RECUSA]);
    fixture.componentRef.setInput('recusasPorMunicipio', new Map([[MARABA.codigoIbge, [RECUSA]]]));
    fixture.detectChanges();
    const tela: HTMLElement = fixture.nativeElement;
    const campo = tela.querySelector('input');
    const botao = tela.querySelector('button');
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(botao?.getAttribute('aria-invalid')).toBe('true');
    for (const elemento of [campo, botao]) conferirRecusaVinculada(tela, elemento);
  });

  it('mostra o código sem nome e oculta os controles no modo leitura', () => {
    const fixture = preparar([{ ...MARABA, nome: null }]);
    fixture.componentRef.setInput('somenteLeitura', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('município de código 1504208 (PA)');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
