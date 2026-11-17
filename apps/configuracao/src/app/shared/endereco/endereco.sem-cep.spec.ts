import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { passarOTempo } from '@uniplus/shared-testing';
import { ESPERA_DA_DIGITACAO_MS } from '@uniplus/shared-ui/components';
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

  it('fluxo sem CEP escolhe a cidade no campo com busca e compõe o valor', async () => {
    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[role="combobox"]')).toHaveLength(1);

    await cenario.escolherCidade();

    expect(anfitriao.controle.value).toMatchObject({
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      origem: 'manual',
      nivelResolucao: null,
    });
  });

  it('após 404, entrar no modo manual limpa o CEP (não vaza endereço inválido)', async () => {
    cenario.digitarNoCampo('t-cep', '00000000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();
    await cenario.escolherCidade();

    expect(anfitriao.controle.value?.cep).toBeNull();
    // O mapeamento para o command não deve montar `endereco` (só cidade).
    expect(enderecoParaCommand(anfitriao.controle.value).endereco).toBeNull();
    expect(enderecoParaCommand(anfitriao.controle.value).cidadeCodigoIbge).toBe('1504208');
  });

  it('CEP que falha (404) durante o modo manual não vira endereço', async () => {
    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();
    await cenario.escolherCidade();

    cenario.digitarNoCampo('t-cep', '00000000');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    expect(anfitriao.controle.value?.cep).toBeNull();
    expect(enderecoParaCommand(anfitriao.controle.value).endereco).toBeNull();
    expect(anfitriao.controle.value?.cidade?.codigoIbge).toBe('1504208');
  });

  it('a busca de cidades sai só depois da espera da digitação', async () => {
    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();
    cenario.escolherUf('PA');

    cenario.digitarNaCidade('Mara');
    await passarOTempo(ESPERA_DA_DIGITACAO_MS - 1);
    cenario.semBuscaDeCidades();

    await passarOTempo(1);
    cenario.responderBuscaDeCidades();
  });

  it('falha na busca de cidades é dita no campo, sem escolher cidade', async () => {
    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();
    cenario.escolherUf('PA');
    await cenario.buscarCidade('Mara');
    cenario.falharBuscaDeCidades();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível buscar os municípios');
    expect(anfitriao.controle.value?.cidade ?? null).toBeNull();
  });

  it('sem CEP, a cidade espera a UF, e trocar a UF tira a cidade de outra UF', async () => {
    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();
    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(campo.disabled).toBe(true);

    await cenario.escolherCidade();
    expect(anfitriao.controle.value?.cidade?.codigoIbge).toBe('1504208');

    cenario.escolherUf('MA');
    expect(anfitriao.controle.value?.cidade ?? null).toBeNull();
  });

  it('a cidade escolhida sem CEP pode ser tirada, e o endereço volta a vazio', async () => {
    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();
    await cenario.escolherCidade();
    expect(anfitriao.controle.value?.cidade?.codigoIbge).toBe('1504208');

    cenario.botaoComTexto('Limpar').click();
    fixture.detectChanges();

    expect(anfitriao.controle.value?.cidade ?? null).toBeNull();
    expect(enderecoParaCommand(anfitriao.controle.value).cidadeCodigoIbge).toBeNull();
  });

  it('o endereço gravado sem CEP reabre com o nome da cidade no campo', () => {
    anfitriao.controle.setValue({
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: null,
      longitude: null,
      nivelResolucao: null,
      origem: 'manual',
    });
    fixture.detectChanges();

    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(campo.value).toBe('Marabá (PA)');
  });

  it('trocar para "sem CEP" após resolver limpa e oculta os campos de endereço', async () => {
    cenario.digitarNoCampo('t-cep', '68507590');
    cenario.botaoComTexto('Buscar CEP').click();
    controller.expectOne(`${BASE_DO_GEO}/api/cep/68507590`).flush(CEP_RESOLVIDO_ATE_O_LOGRADOURO);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement).value).toBe(
      'Rua Folha 31, Quadra 7',
    );

    cenario.botaoComTexto('preencher sem CEP').click();
    fixture.detectChanges();

    // Campos de endereço ocultos e limpos no fluxo sem CEP (não são descartados em silêncio).
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
    expect(anfitriao.controle.value?.logradouro ?? null).toBeNull();
    expect(anfitriao.controle.value?.cep).toBeNull();
    expect(enderecoParaCommand(anfitriao.controle.value).endereco).toBeNull();
    // A cidade resolvida pelo CEP segue no campo de município, pelo nome.
    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(campo.value).toBe('Marabá (PA)');
  });
});
