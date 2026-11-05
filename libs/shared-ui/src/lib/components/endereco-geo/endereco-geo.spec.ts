import { HttpHeaders } from '@angular/common/http';
import { Component, signal, viewChild } from '@angular/core';
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

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoGeoComponent],
  template: `<ui-endereco-geo
    #endereco
    [formControl]="controle"
    idPrefix="t"
    [erroExterno]="erro()"
  />`,
})
class AnfitriaoComErroComponent {
  readonly controle = new FormControl<EnderecoEstruturado | null>(null);
  readonly erro = signal<string | null>(null);
  readonly endereco = viewChild.required(EnderecoGeoComponent);
}

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

  it('focusout do grupo sem relatedTarget (foco vai para fora da página) marca o campo como tocado', () => {
    campoCep().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

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

describe('EnderecoGeoComponent num controle que atualiza no blur', () => {
  let fixture: ComponentFixture<AnfitriaoQueAtualizaNoBlurComponent>;
  let buscaEmAndamento: Subject<ReturnType<typeof apiOk<CepEncontrado>>>;

  const endereco = (
    cidade: EnderecoEstruturado['cidade'],
    origem: string,
  ): EnderecoEstruturado => ({
    cep: origem === 'manual' ? null : '68507590',
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    distrito: null,
    cidade,
    latitude: null,
    longitude: null,
    nivelResolucao: origem === 'manual' ? null : 'cidade',
    origem,
  });
  const marata = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };

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
    await escrever(endereco(marata, 'manual'));
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
    await escrever(endereco(marata, 'geo-api'));
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
    await escrever(endereco(marata, 'manual'));
    const limpar = fixture.nativeElement.querySelector(
      'button[aria-label="Limpar cidade"]',
    ) as HTMLButtonElement;

    limpar.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.value).toBeNull();
  });

  it('escolher a cidade aplica ao controle o valor com a cidade', async () => {
    await escrever(endereco(null, 'manual'));
    const uf = fixture.nativeElement.querySelector('#t-uf') as HTMLSelectElement;
    uf.value = 'PA';
    uf.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = 'Mara';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    const opcao = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>,
    ).find((item) => item.textContent?.includes('Marabá'));

    opcao?.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.value?.cidade?.codigoIbge).toBe('1504208');
  });

  it('alternar para o endereço sem CEP aplica ao controle a origem manual', async () => {
    await escrever(endereco(marata, 'geo-api'));
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

describe('EnderecoGeoComponent: foco na recusa externa', () => {
  let fixture: ComponentFixture<AnfitriaoComErroComponent>;

  const endereco = (
    origem: string,
    cidade: EnderecoEstruturado['cidade'],
  ): EnderecoEstruturado => ({
    cep: origem === 'manual' ? null : '68507590',
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    distrito: null,
    cidade,
    latitude: null,
    longitude: null,
    nivelResolucao: origem === 'manual' ? null : 'cidade',
    origem,
  });
  const marata = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnfitriaoComErroComponent],
      providers: [
        { provide: BUSCA_DE_CEP, useValue: () => of(apiOk(CEP_DO_GEO, 200, new HttpHeaders())) },
        {
          provide: BUSCA_DE_MUNICIPIOS,
          useValue: () => of({ ok: true, data: [marata] }),
        },
      ],
    });
    fixture = TestBed.createComponent(AnfitriaoComErroComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  async function recusar(valor: EnderecoEstruturado): Promise<void> {
    fixture.componentInstance.controle.setValue(valor);
    fixture.componentInstance.erro.set('A cidade não corresponde ao CEP informado.');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const mensagem = () => fixture.nativeElement.querySelector('#t-erro') as HTMLElement;

  it('sem recusa externa, não mexe no foco', () => {
    const antes = document.activeElement;

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement).toBe(antes);
  });

  it('com o endereço resolvido por CEP, não há controle a corrigir: o foco vai à mensagem', async () => {
    await recusar(endereco('geo-api', marata));

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement).toBe(mensagem());
  });

  it('a mensagem de recusa descreve o grupo do endereço', async () => {
    await recusar(endereco('geo-api', marata));

    expect(fixture.nativeElement.querySelector('fieldset').getAttribute('aria-describedby')).toBe(
      mensagem().id,
    );
  });

  it('no preenchimento manual com a cidade editável, o foco vai ao campo da cidade', async () => {
    await recusar(endereco('manual', marata));

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement?.closest('ui-valor-de-municipio')).not.toBeNull();
  });

  it('no preenchimento manual sem UF, a cidade está indisponível: o foco vai à mensagem', async () => {
    await recusar(endereco('manual', null));

    fixture.componentInstance.endereco().focarErro();

    expect(document.activeElement).toBe(mensagem());
  });
});
