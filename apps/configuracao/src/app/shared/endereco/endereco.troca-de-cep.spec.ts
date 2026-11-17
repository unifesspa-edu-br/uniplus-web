import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enderecoParaCommand } from './endereco.model';
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

  it('"Trocar CEP" destrava o campo sem descartar o restante do endereço resolvido', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    const cep = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
    expect(cep.readOnly).toBe(true);
    expect(() => cenario.botaoComTexto('Buscar CEP')).toThrow();

    cenario.botaoComTexto('Trocar CEP').click();
    fixture.detectChanges();

    expect(cep.readOnly).toBe(false);
    expect(cep.value).toBe('68507590');
    expect(() => cenario.botaoComTexto('Trocar CEP')).toThrow();
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement).value).toBe(
      'Rua Folha 31, Quadra 7',
    );
    expect(anfitriao.controle.value).toMatchObject({ logradouro: 'Rua Folha 31, Quadra 7' });
  });

  it('corrige o CEP após "Trocar CEP" e re-ancora com o novo endereço resolvido', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    cenario.botaoComTexto('Trocar CEP').click();
    fixture.detectChanges();

    cenario.digitarNoCampo('t-cep', '68500000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68500000`).flush({
      ...CEP_RESOLVIDO_ATE_O_LOGRADOURO,
      cep: '68500000',
      logradouro: null,
      bairro: 'Novo Bairro',
      nivelResolucao: 'bairro',
    });
    fixture.detectChanges();

    expect(anfitriao.controle.value).toMatchObject({
      cep: '68500000',
      bairro: 'Novo Bairro',
      nivelResolucao: 'bairro',
    });
    const cep = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
    expect(cep.readOnly).toBe(true);
    expect(() => cenario.botaoComTexto('Trocar CEP')).not.toThrow();
    expect(() => cenario.botaoComTexto('Buscar CEP')).toThrow();
  });

  it('falha ao corrigir CEP preserva a última resolução válida em vez de descartá-la', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    cenario.botaoComTexto('Trocar CEP').click();
    fixture.detectChanges();

    cenario.digitarNoCampo('t-cep', '00000000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    // A resolução anterior não é descartada por uma tentativa de correção que falhou.
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement)?.value).toBe(
      'Rua Folha 31, Quadra 7',
    );
    expect(
      (fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement).textContent,
    ).toContain('CEP não encontrado');

    // Voltar ao CEP original (sem nova busca) reaprova o formulário e limpa o erro obsoleto.
    cenario.digitarNoCampo('t-cep', '68507590');
    fixture.detectChanges();

    expect(anfitriao.controle.valid).toBe(true);
    expect(anfitriao.controle.value).toMatchObject({
      cep: '68507590',
      logradouro: 'Rua Folha 31, Quadra 7',
      nivelResolucao: 'logradouro',
    });
    expect(fixture.nativeElement.querySelector('#t-cep-error')).toBeNull();
  });

  it('esvaziar o CEP durante a correção descarta a resolução preservada', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();
    cenario.digitarNoCampo('t-numero', '123');
    fixture.detectChanges();

    cenario.botaoComTexto('Trocar CEP').click();
    fixture.detectChanges();

    cenario.digitarNoCampo('t-cep', '');
    fixture.detectChanges();

    // Nada fica visível mas fora do que seria submetido: os campos de detalhe
    // (derivados da resolução anterior) somem junto com o CEP, não continuam
    // na tela para um valor que não seria mais enviado. numero também é
    // limpo — do contrário, vazaria para o próximo CEP resolvido (endereço
    // potencialmente diferente).
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Marabá');
    expect(anfitriao.controle.valid).toBe(true);
    expect(anfitriao.controle.value).toBeNull();
    expect(enderecoParaCommand(anfitriao.controle.value).endereco).toBeNull();
    expect(enderecoParaCommand(anfitriao.controle.value).cidadeCodigoIbge).toBeNull();

    // Resolver um novo CEP não ressuscita o número do endereço abandonado.
    cenario.digitarNoCampo('t-cep', '68500000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68500000`).flush({
      ...CEP_RESOLVIDO_ATE_O_LOGRADOURO,
      cep: '68500000',
      bairro: 'Novo Bairro',
      nivelResolucao: 'bairro',
    });
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#t-numero') as HTMLInputElement).value).toBe('');
  });

  it('abandonar a correção (esvaziar CEP após falha) limpa o erro obsoleto', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    cenario.botaoComTexto('Trocar CEP').click();
    fixture.detectChanges();

    cenario.digitarNoCampo('t-cep', '00000000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement).textContent,
    ).toContain('CEP não encontrado');

    // Desiste da correção esvaziando o campo por completo — endereço vazio é
    // válido (opcional), então o erro da tentativa anterior não pode persistir.
    cenario.digitarNoCampo('t-cep', '');
    fixture.detectChanges();

    expect(anfitriao.controle.valid).toBe(true);
    expect(fixture.nativeElement.querySelector('#t-cep-error')).toBeNull();
  });

  it('texto sem dígitos (ex.: "abc") durante a correção não descarta a resolução preservada', () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    cenario.botaoComTexto('Trocar CEP').click();
    fixture.detectChanges();

    // "abc" não tem dígitos, mas o campo não está vazio — é formato pendente
    // Não abandono da correção. A resolução preservada continua ali.
    cenario.digitarNoCampo('t-cep', 'abc');
    fixture.detectChanges();

    expect(anfitriao.controle.invalid).toBe(true);
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement)?.value).toBe(
      'Rua Folha 31, Quadra 7',
    );

    // Corrigir para o CEP original (sem nova busca) reaprova o formulário.
    cenario.digitarNoCampo('t-cep', '68507590');
    fixture.detectChanges();
    expect(anfitriao.controle.valid).toBe(true);
    expect(anfitriao.controle.value).toMatchObject({
      cep: '68507590',
      nivelResolucao: 'logradouro',
    });
  });
});
