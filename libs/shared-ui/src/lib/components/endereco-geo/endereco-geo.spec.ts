import { HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiOk } from '@uniplus/shared-core/http';
import axe from 'axe-core';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
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

describe('EnderecoGeoComponent com a busca em andamento', () => {
  let fixture: ComponentFixture<AnfitriaoComponent>;
  let resposta: Subject<ReturnType<typeof apiOk<CepEncontrado>>>;
  let buscas: number;

  beforeEach(() => {
    buscas = 0;
    resposta = new Subject();
    TestBed.configureTestingModule({
      imports: [AnfitriaoComponent],
      providers: [
        {
          provide: BUSCA_DE_CEP,
          useValue: () => {
            buscas++;
            return resposta;
          },
        },
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
      ],
    });
    fixture = TestBed.createComponent(AnfitriaoComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  const campoCep = () => fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
  const botaoDoCep = () => campoCep().parentElement?.querySelector('button') as HTMLButtonElement;
  const anuncio = () => fixture.nativeElement.querySelector('#t-cep-status') as HTMLElement;

  async function atualizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function iniciarBusca(): Promise<void> {
    campoCep().value = '68507-590';
    campoCep().dispatchEvent(new Event('input'));
    await atualizar();
    botaoDoCep().click();
    await atualizar();
  }

  it('anuncia a busca numa região de status fora do botão, e o botão não repete a requisição', async () => {
    expect(anuncio().getAttribute('role')).toBe('status');
    expect(anuncio().getAttribute('aria-live')).toBe('polite');
    expect(botaoDoCep().contains(anuncio())).toBe(false);
    expect(anuncio().textContent?.trim()).toBe('');

    await iniciarBusca();
    botaoDoCep().click();
    botaoDoCep().click();
    await atualizar();

    expect(anuncio().textContent).toContain('Buscando CEP');
    expect(buscas).toBe(1);
    expect(botaoDoCep().getAttribute('aria-disabled')).toBe('true');
    expect(
      botaoDoCep().querySelector('[role="status"]')?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('anuncia a conclusão da busca', async () => {
    await iniciarBusca();

    resposta.next(apiOk(CEP_DO_GEO, 200, new HttpHeaders()));
    await atualizar();

    expect(anuncio().textContent).toContain('CEP encontrado');
    expect(botaoDoCep().hasAttribute('aria-disabled')).toBe(false);
  });

  it('na falha, o anúncio de busca sai e a mensagem de erro do campo fala', async () => {
    await iniciarBusca();

    resposta.next({ ok: false, status: 404, problem: {}, headers: new HttpHeaders() } as never);
    await atualizar();

    expect(anuncio().textContent?.trim()).toBe('');
    expect(fixture.nativeElement.querySelector('#t-cep-error')?.getAttribute('role')).toBe('alert');
  });

  it('trocar a UF do endereço sem CEP marca o campo como tocado', async () => {
    const manual: EnderecoEstruturado = {
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      distrito: null,
      cidade: null,
      latitude: null,
      longitude: null,
      nivelResolucao: null,
      origem: 'manual',
    };
    fixture.componentInstance.controle.setValue(manual);
    await atualizar();
    expect(fixture.componentInstance.controle.touched).toBe(false);

    const uf = fixture.nativeElement.querySelector('#t-uf') as HTMLSelectElement;
    uf.value = 'PA';
    uf.dispatchEvent(new Event('change'));
    await atualizar();

    expect(fixture.componentInstance.controle.touched).toBe(true);
  });

  it('alternar para o endereço sem CEP marca o campo como tocado', async () => {
    const alternar = fixture.nativeElement.querySelector(
      '.endereco-geo__link',
    ) as HTMLButtonElement;

    alternar.click();
    await atualizar();

    expect(fixture.componentInstance.controle.touched).toBe(true);
  });

  it('o foco sair do grupo marca o campo como tocado; mudar de campo dentro dele não', async () => {
    campoCep().focus();
    campoCep().dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: botaoDoCep() }),
    );
    expect(fixture.componentInstance.controle.touched).toBe(false);

    campoCep().dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    expect(fixture.componentInstance.controle.touched).toBe(true);
  });
});
