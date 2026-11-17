import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  it('CEP inexistente (404) exibe erro inline e não exibe campos de endereço', () => {
    cenario.digitarNoCampo('t-cep', '00000000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    const erro = fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement;
    expect(erro.textContent).toContain('CEP não encontrado');
    // Sem CEP resolvido, os campos de endereço ficam ocultos (não persistiriam).
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
  });

  it('CEP com menos de 8 dígitos não dispara request e avisa o formato', () => {
    cenario.digitarNoCampo('t-cep', '123');
    cenario.botaoComTexto('Buscar CEP').click();
    fixture.detectChanges();

    controller.expectNone(`${BASE_DO_GEO}/api/cep/123`);
    const erro = fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement;
    expect(erro.textContent).toContain('8 dígitos');
  });

  it('ignora resposta obsoleta de CEP quando o campo já mudou', () => {
    cenario.digitarNoCampo('t-cep', '11111111');
    cenario.botaoComTexto('Buscar CEP').click();
    // Usuário altera o CEP enquanto o lookup do 11111111 está em voo.
    cenario.digitarNoCampo('t-cep', '22222222');
    controller.expectOne(`${BASE_DO_GEO}/api/cep/11111111`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();

    // A resposta obsoleta (de 11111111) não pode popular o formulário do 22222222:
    // sem resolução aplicada, não há cidade nem campos de endereço exibidos.
    expect(anfitriao.controle.value?.cidade ?? null).toBeNull();
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
  });

  it('bloqueia o save enquanto o CEP digitado não é resolvido (Validator)', () => {
    cenario.digitarNoCampo('t-cep', '12345678');
    fixture.detectChanges();

    expect(anfitriao.controle.invalid).toBe(true);
    expect(anfitriao.controle.errors).toEqual({ cepNaoResolvido: true });
    expect(anfitriao.controle.value?.cep ?? null).toBeNull();

    // Limpar o CEP volta a validar (endereço opcional pode salvar sem CEP).
    cenario.digitarNoCampo('t-cep', '');
    fixture.detectChanges();
    expect(anfitriao.controle.valid).toBe(true);
  });

  it('marca CEP sem dígitos (ex.: "abc") como pendente/inválido', () => {
    cenario.digitarNoCampo('t-cep', 'abc');
    fixture.detectChanges();
    expect(anfitriao.controle.invalid).toBe(true);
    expect(anfitriao.controle.errors).toEqual({ cepNaoResolvido: true });
  });

  it('erro externo de coerência (422) é exibido inline', () => {
    anfitriao.erro.set('CEP incoerente com a cidade informada.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('CEP incoerente com a cidade informada.');
  });
});
