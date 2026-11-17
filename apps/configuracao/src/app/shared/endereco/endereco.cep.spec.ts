import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import {
  AnfitriaoDoEnderecoComponent,
  BASE_DO_GEO,
  CEP_RESOLVIDO_ATE_O_LOGRADOURO,
  CenarioDoEndereco,
} from './endereco.testing';

describe('EnderecoGeoComponent com o Geo', () => {
  let cenario: CenarioDoEndereco;
  let fixture: ComponentFixture<AnfitriaoDoEnderecoComponent>;
  let anfitriao: AnfitriaoDoEnderecoComponent;
  let controller: HttpTestingController;

  beforeEach(() => {
    cenario = CenarioDoEndereco.montar();
    ({ fixture, anfitriao, controller } = cenario);
  });

  afterEach(() => cenario.encerrar());

  it('autofill por CEP preenche o formulário e ancora os campos resolvidos', () => {
    cenario.digitarNoCampo('t-cep', '68507-590');
    cenario.botaoComTexto('Buscar CEP').click();

    const req = controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('cep', 1));
    req.flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    expect(anfitriao.controle.value).toMatchObject({
      cep: '68507590',
      logradouro: 'Rua Folha 31, Quadra 7',
      bairro: 'Nova Marabá',
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      nivelResolucao: 'logradouro',
      origem: 'geo-api',
    });

    const logradouro = fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement;
    expect(logradouro.readOnly).toBe(true);
    const numero = fixture.nativeElement.querySelector('#t-numero') as HTMLInputElement;
    expect(numero.readOnly).toBe(false);
  });

  it('exibe os campos do geral para o específico, na mesma ordem do DOM', () => {
    cenario.digitarNoCampo('t-cep', '68507-590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller
      .expectOne(`${BASE_DO_GEO}/api/cep/68507590`)
      .flush({ ...CEP_RESOLVIDO_ATE_O_LOGRADOURO, distrito: 'Distrito Industrial' });
    fixture.detectChanges();

    const rotulos = Array.from(fixture.nativeElement.querySelectorAll('fieldset label')).map((l) =>
      (l as HTMLElement).textContent?.trim(),
    );

    expect(rotulos).toEqual([
      'CEP',
      'UF',
      'Cidade',
      'Bairro',
      'Distrito',
      'Logradouro',
      'Número',
      'Complemento',
    ]);
  });

  it('nível bairro deixa logradouro editável e número sempre editável', () => {
    cenario.digitarNoCampo('t-cep', '68500000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68500000`).flush({
      ...CEP_RESOLVIDO_ATE_O_LOGRADOURO,
      cep: '68500000',
      logradouro: null,
      nivelResolucao: 'bairro',
    });
    fixture.detectChanges();

    const logradouro = fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement;
    expect(logradouro.readOnly).toBe(false);
    const bairro = fixture.nativeElement.querySelector('#t-bairro') as HTMLInputElement;
    expect(bairro.readOnly).toBe(true);
  });

  it('concatena tipo e logradouro do Geo ao aplicar CEP resolvido', () => {
    cenario.digitarNoCampo('t-cep', '71720022');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/71720022`).flush({
      ...CEP_RESOLVIDO_ATE_O_LOGRADOURO,
      cep: '71720022',
      tipo: 'Terceira',
      logradouro: 'Avenida Bloco 1740',
    });
    fixture.detectChanges();

    expect(anfitriao.controle.value).toMatchObject({ logradouro: 'Terceira Avenida Bloco 1740' });
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement).value).toBe(
      'Terceira Avenida Bloco 1740',
    );
  });

  it('mantém o logradouro numérico depois do tipo (Rua "8")', () => {
    cenario.digitarNoCampo('t-cep', '68508714');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68508714`).flush({
      ...CEP_RESOLVIDO_ATE_O_LOGRADOURO,
      cep: '68508714',
      tipo: 'Rua',
      logradouro: '8',
    });
    fixture.detectChanges();

    expect(anfitriao.controle.value).toMatchObject({ logradouro: 'Rua 8' });
  });

  it('tipo nulo mantém apenas o logradouro, sem prefixo', () => {
    cenario.digitarNoCampo('t-cep', '68500123');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68500123`).flush({
      ...CEP_RESOLVIDO_ATE_O_LOGRADOURO,
      cep: '68500123',
      tipo: null,
      logradouro: 'Travessa Sem Tipo',
    });
    fixture.detectChanges();

    expect(anfitriao.controle.value).toMatchObject({ logradouro: 'Travessa Sem Tipo' });
  });

  it('o campo que o CEP resolveu sem valor não aparece; com valor, aparece travado', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#t-bairro')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#t-distrito')).toBeNull();
    expect(anfitriao.controle.value?.distrito).toBeNull();

    cenario.botaoComTexto('Trocar CEP').click();
    fixture.detectChanges();
    cenario.digitarNoCampo('t-cep', '68514959');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68514959`).flush({
      ...CEP_RESOLVIDO_ATE_O_LOGRADOURO,
      cep: '68514959',
      bairro: 'Morada Nova',
      distrito: 'Morada Nova',
    });
    fixture.detectChanges();
    const distrito = fixture.nativeElement.querySelector('#t-distrito') as HTMLInputElement;
    expect(distrito.value).toBe('Morada Nova');
    expect(distrito.readOnly).toBe(true);
  });

  it('o CEP preenche a UF e a cidade, cada uma no seu campo, travadas', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    const uf = fixture.nativeElement.querySelector('#t-uf') as HTMLInputElement;
    const cidade = fixture.nativeElement.querySelector('#t-cidade') as HTMLInputElement;
    expect(uf.value).toBe('PA');
    expect(cidade.value).toBe('Marabá');
    expect(uf.readOnly && cidade.readOnly).toBe(true);
  });

  it('o complemento do CEP no DNE não preenche o do endereço: o usuário o informa', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller
      .expectOne(`${BASE_DO_GEO}/api/cep/68507590`)
      .flush({ ...CEP_RESOLVIDO_ATE_O_LOGRADOURO, complemento: 'Clique e Retire Correios' });
    fixture.detectChanges();

    const complemento = fixture.nativeElement.querySelector('#t-complemento') as HTMLInputElement;
    expect(complemento.value).toBe('');
    expect(complemento.readOnly).toBe(false);
    expect(anfitriao.controle.value?.complemento).toBeNull();
  });

  it('writeValue popula campos e mantém âncoras ao editar endereço resolvido', () => {
    anfitriao.controle.setValue({
      cep: '68507590',
      logradouro: 'Folha 31',
      numero: 's/n',
      complemento: null,
      bairro: 'Nova Marabá',
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: null,
      longitude: null,
      nivelResolucao: 'logradouro',
      origem: 'geo-api',
    });
    fixture.detectChanges();

    const cep = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
    expect(cep.value).toBe('68507590');
    expect(cep.readOnly).toBe(true);
    const numero = fixture.nativeElement.querySelector('#t-numero') as HTMLInputElement;
    expect(numero.value).toBe('s/n');
    expect(numero.readOnly).toBe(false);
  });
});
