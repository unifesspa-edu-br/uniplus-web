import { HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiOk } from '@uniplus/shared-core/http';
import axe from 'axe-core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { EnderecoGeoComponent } from './endereco-geo';
import { BUSCA_DE_CEP, type CepEncontrado, type EnderecoEstruturado } from './endereco-geo.model';

const CEP_DO_GEO: CepEncontrado = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31, Quadra 7',
  bairro: 'Nova Marabá',
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoGeoComponent],
  template: `<ui-endereco-geo [formControl]="controle" idPrefix="t" />`,
})
class AnfitriaoComponent {
  readonly controle = new FormControl<EnderecoEstruturado | null>(null);
}

describe('EnderecoGeoComponent', () => {
  let fixture: ComponentFixture<AnfitriaoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnfitriaoComponent],
      providers: [
        {
          provide: BUSCA_DE_CEP,
          useValue: () => of(apiOk(CEP_DO_GEO, 200, new HttpHeaders())),
        },
      ],
    });
    fixture = TestBed.createComponent(AnfitriaoComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  const campoCep = () => fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
  const botaoDoCep = () => campoCep().parentElement?.querySelector('button') as HTMLButtonElement;

  async function digitarCep(cep: string): Promise<void> {
    campoCep().value = cep;
    campoCep().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function buscarCep(): Promise<void> {
    await digitarCep('68507-590');
    botaoDoCep().focus();
    botaoDoCep().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('o botão do CEP mantém o foco quando a busca o troca por "Trocar CEP"', async () => {
    await buscarCep();

    expect(botaoDoCep().textContent).toContain('Trocar CEP');
    expect(document.activeElement).toBe(botaoDoCep());
  });

  it('"Trocar CEP" leva o foco ao campo do CEP, já editável', async () => {
    await buscarCep();

    botaoDoCep().click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(campoCep().readOnly).toBe(false);
    expect(document.activeElement).toBe(campoCep());
  });

  it('CEP digitado e não resolvido deixa o campo inválido e ligado à instrução', async () => {
    await digitarCep('68507-590');

    expect(campoCep().getAttribute('aria-invalid')).toBe('true');
    const ids = (campoCep().getAttribute('aria-describedby') ?? '').split(' ');
    const instrucao = ids
      .map((id) => document.getElementById(id))
      .find((e) => e?.textContent?.includes('Valide o CEP'));
    expect(instrucao).toBeTruthy();
  });

  it('CEP resolvido não fica inválido', async () => {
    await buscarCep();

    expect(campoCep().hasAttribute('aria-invalid')).toBe(false);
  });

  it('não tem violações de acessibilidade com o CEP pendente', async () => {
    await digitarCep('68507-590');

    const resultado = await axe.run(fixture.nativeElement, {
      rules: { region: { enabled: false } },
    });

    expect(resultado.violations).toEqual([]);
  });
});
