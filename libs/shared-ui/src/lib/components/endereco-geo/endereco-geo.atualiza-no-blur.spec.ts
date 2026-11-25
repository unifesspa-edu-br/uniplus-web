import { HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiOk } from '@uniplus/shared-core/http';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUSCA_DE_MUNICIPIOS,
  ESPERA_DA_DIGITACAO_MS,
} from '../valor-de-municipio/valor-de-municipio';
import { EnderecoGeoComponent } from './endereco-geo';
import { BUSCA_DE_CEP, type CepEncontrado, type EnderecoEstruturado } from './endereco-geo.model';
import { CEP_DO_GEO, CIDADE_DE_MARABA, enderecoEstruturado } from './endereco-geo.testing';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoGeoComponent],
  template: `<ui-endereco-geo [formControl]="controle" idPrefix="t" [exigeCep]="true" />`,
})
class AnfitriaoQueExigeCepComponent {
  readonly controle = new FormControl<EnderecoEstruturado | null>(null, { updateOn: 'blur' });
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoGeoComponent],
  template: `<ui-endereco-geo [formControl]="controle" idPrefix="t" />`,
})
class AnfitriaoQueAtualizaNoBlurComponent {
  readonly controle = new FormControl<EnderecoEstruturado | null>(null, { updateOn: 'blur' });
}

describe('EnderecoGeoComponent num controle que atualiza no blur', () => {
  let fixture: ComponentFixture<AnfitriaoQueAtualizaNoBlurComponent>;
  let buscaEmAndamento: Subject<ReturnType<typeof apiOk<CepEncontrado>>>;

  beforeEach(() => {
    buscaEmAndamento = new Subject();
    TestBed.configureTestingModule({
      imports: [AnfitriaoQueAtualizaNoBlurComponent],
      providers: [
        { provide: BUSCA_DE_CEP, useValue: () => buscaEmAndamento },
        {
          provide: BUSCA_DE_MUNICIPIOS,
          useValue: () =>
            of({ ok: true, data: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }] }),
        },
      ],
    });
    fixture = TestBed.createComponent(AnfitriaoQueAtualizaNoBlurComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const botaoDo = (texto: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes(texto),
    ) as HTMLButtonElement;

  async function escrever(valor: EnderecoEstruturado): Promise<void> {
    fixture.componentInstance.controle.setValue(valor);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('trocar a UF aplica ao controle o valor sem a cidade, e não só o marca como tocado', async () => {
    await escrever(enderecoEstruturado('manual', CIDADE_DE_MARABA));
    const uf = fixture.nativeElement.querySelector('#t-uf') as HTMLSelectElement;

    uf.value = 'SP';
    uf.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.touched).toBe(true);
    expect(fixture.componentInstance.controle.value).toBeNull();
  });

  it('o valor da busca assíncrona do CEP chega ao controle mesmo com o blur já ocorrido', async () => {
    const campo = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
    campo.value = '68507-590';
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.componentInstance.controle.value).toBeNull();

    buscaEmAndamento.next(apiOk(CEP_DO_GEO, 200, new HttpHeaders()));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.controle.value?.cep).toBe('68507590');
  });

  it('resposta descartada da busca não aplica ao pai a edição em curso', async () => {
    await escrever(enderecoEstruturado('geo-api', CIDADE_DE_MARABA));
    botaoDo('Trocar CEP').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const cep = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;

    cep.value = '68507-111';
    cep.dispatchEvent(new Event('input'));
    cep.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    cep.value = '68507-222';
    cep.dispatchEvent(new Event('input'));
    const numero = fixture.nativeElement.querySelector('#t-numero') as HTMLInputElement;
    numero.value = '12';
    numero.dispatchEvent(new Event('input'));
    buscaEmAndamento.next(apiOk(CEP_DO_GEO, 200, new HttpHeaders()));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.controle.value?.numero).toBeNull();
  });

  it('limpar a cidade aplica ao controle o valor sem a cidade', async () => {
    await escrever(enderecoEstruturado('manual', CIDADE_DE_MARABA));
    const limpar = fixture.nativeElement.querySelector(
      'button[aria-label="Limpar cidade"]',
    ) as HTMLButtonElement;

    limpar.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.value).toBeNull();
  });

  it('escolher a cidade aplica ao controle o valor com a cidade', async () => {
    await escrever(enderecoEstruturado('manual', null));
    ligarRelogioControlado();
    const uf = fixture.nativeElement.querySelector('#t-uf') as HTMLSelectElement;
    uf.value = 'PA';
    uf.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = 'Mara';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    fixture.detectChanges();
    const opcao = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>,
    ).find((item) => item.textContent?.includes('Marabá'));

    opcao?.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.value?.cidade?.codigoIbge).toBe('1504208');
  });

  it('alternar para o endereço sem CEP aplica ao controle a origem manual', async () => {
    await escrever(enderecoEstruturado('geo-api', CIDADE_DE_MARABA));
    const alternar = fixture.nativeElement.querySelector(
      '.endereco-geo__link',
    ) as HTMLButtonElement;

    alternar.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.touched).toBe(true);
    expect(fixture.componentInstance.controle.value?.origem).toBe('manual');
  });
});

describe('EnderecoGeoComponent com CEP de faixa num controle que atualiza no blur', () => {
  it('confirmar o CEP aplica ao controle a confirmação', async () => {
    TestBed.configureTestingModule({
      imports: [AnfitriaoQueExigeCepComponent],
      providers: [{ provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) }],
    });
    const fixture = TestBed.createComponent(AnfitriaoQueExigeCepComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    fixture.componentInstance.controle.setValue({
      cep: '68507590',
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: null,
      longitude: null,
      nivelResolucao: 'cidade',
      origem: 'faixa-cidade',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const confirmacao = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;

    confirmacao.checked = true;
    confirmacao.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.value?.cepConfirmado).toBe(true);
  });
});
