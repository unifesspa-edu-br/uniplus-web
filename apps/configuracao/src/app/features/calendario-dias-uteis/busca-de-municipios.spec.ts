import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BuscaDeMunicipios } from './busca-de-municipios';
import type { MunicipioOpcao } from './calendario-dias-uteis.util';
import {
  aplicarAbrangencia,
  criarGrupoDeDiaNaoUtil,
  municipioSelecionadoDe,
  type GrupoDoDia,
} from './dia-nao-util-form';
import {
  BASE,
  CIDADES,
  ESPERA_DA_BUSCA_EM_MS,
  MARABA,
  PARAUAPEBAS,
  esperar,
} from './calendario-dias-uteis.testing';

describe('BuscaDeMunicipios', () => {
  let busca: BuscaDeMunicipios;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: GEO_BASE_PATH, useValue: BASE },
        BuscaDeMunicipios,
      ],
    });
    busca = TestBed.inject(BuscaDeMunicipios);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const diaMunicipal = (): GrupoDoDia => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.abrangencia.setValue('MUNICIPAL');
    busca.aplicar(grupo, { tipo: 'abrangencia' });
    return grupo;
  };
  const estado = (grupo: GrupoDoDia) => busca.buscas().get(grupo);
  const respostaDa = (municipio: { codigoIbge: string; nome: string; uf: string }) => [
    { id: `cidade-${municipio.codigoIbge}`, ddd: '94', ...municipio },
  ];
  const buscarEEsperar = async (grupo: GrupoDoDia, termo: string): Promise<void> => {
    busca.aplicar(grupo, { tipo: 'busca', termo });
    await esperar(ESPERA_DA_BUSCA_EM_MS);
  };
  const escolher = async (grupo: GrupoDoDia, municipio: MunicipioOpcao = MARABA): Promise<void> => {
    await buscarEEsperar(grupo, municipio.nome);
    http.expectOne((r) => r.url === CIDADES).flush(respostaDa(municipio));
    grupo.controls.codigoMunicipio.setValue(municipio.codigoIbge);
    busca.aplicar(grupo, { tipo: 'municipio' });
  };

  it('pesquisa os municípios pelo nome e pela UF na API Geo, no máximo 20', async () => {
    const grupo = diaMunicipal();

    await buscarEEsperar(grupo, PARAUAPEBAS.nome);

    const requisicao = http.expectOne((r) => r.url === CIDADES);
    expect(requisicao.request.params.get('uf')).toBe('PA');
    expect(requisicao.request.params.get('q')).toBe('Parauapebas');
    expect(requisicao.request.params.get('limit')).toBe('20');
    expect(estado(grupo)?.carregando).toBe(true);
    requisicao.flush(respostaDa(PARAUAPEBAS));
    expect(estado(grupo)).toMatchObject({ carregando: false, erro: false });
    expect(estado(grupo)?.opcoes).toEqual([expect.objectContaining(PARAUAPEBAS)]);
  });

  it('grava o snapshot inteiro da opção escolhida', async () => {
    const grupo = diaMunicipal();

    await escolher(grupo, PARAUAPEBAS);

    expect(municipioSelecionadoDe(grupo)).toEqual(PARAUAPEBAS);
    expect(grupo.controls.buscaMunicipio.value).toBe('Parauapebas');
    expect(grupo.errors).toBeNull();
  });

  it('não busca com menos de dois caracteres, e limpa as opções anteriores', async () => {
    const grupo = diaMunicipal();

    busca.aplicar(grupo, { tipo: 'busca', termo: 'M' });
    await esperar(ESPERA_DA_BUSCA_EM_MS);

    http.expectNone((r) => r.url === CIDADES);
    expect(estado(grupo)).toEqual({ opcoes: [], carregando: false, erro: false });
  });

  it('só busca no dia de abrangência municipal', async () => {
    const grupo = criarGrupoDeDiaNaoUtil();

    await buscarEEsperar(grupo, 'Marabá');

    http.expectNone((r) => r.url === CIDADES);
    expect(estado(grupo)).toBeUndefined();
  });

  it('descarta o snapshot inteiro quando a busca deixa de casar com o escolhido', async () => {
    const grupo = diaMunicipal();
    await escolher(grupo);

    busca.aplicar(grupo, { tipo: 'busca', termo: 'Belé' });

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(municipioSelecionadoDe(grupo)).toBeNull();
    await esperar(ESPERA_DA_BUSCA_EM_MS);
    http.expectOne((r) => r.url === CIDADES).flush([]);
  });

  it('mantém o snapshot quando a busca é o nome do escolhido, sem acento ou caixa', async () => {
    const grupo = diaMunicipal();
    await escolher(grupo);

    busca.aplicar(grupo, { tipo: 'busca', termo: 'MARABA' });

    expect(municipioSelecionadoDe(grupo)).toEqual(MARABA);
    await esperar(ESPERA_DA_BUSCA_EM_MS);
    http.expectOne((r) => r.url === CIDADES).flush(respostaDa(MARABA));
  });

  it('descarta o snapshot e a busca ao trocar o estado usado na busca', async () => {
    const grupo = diaMunicipal();
    await escolher(grupo);

    grupo.controls.uf.setValue('SP');
    busca.aplicar(grupo, { tipo: 'uf' });

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(grupo.controls.buscaMunicipio.value).toBe('');
    expect(estado(grupo)).toEqual({ opcoes: [], carregando: false, erro: false });
  });

  it('trocar o estado de um dia que não é municipal não mexe na busca', () => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.buscaMunicipio.setValue('Mar');

    busca.aplicar(grupo, { tipo: 'uf' });

    expect(grupo.controls.buscaMunicipio.value).toBe('Mar');
  });

  it('a escolha de um código fora das opções descarta o snapshot', async () => {
    const grupo = diaMunicipal();
    await escolher(grupo);

    grupo.controls.codigoMunicipio.setValue('9999999');
    busca.aplicar(grupo, { tipo: 'municipio' });

    expect(municipioSelecionadoDe(grupo)).toBeNull();
  });

  it('buscas de dias diferentes não se cancelam', async () => {
    const primeira = diaMunicipal();
    const segunda = diaMunicipal();

    busca.aplicar(primeira, { tipo: 'busca', termo: MARABA.nome });
    busca.aplicar(segunda, { tipo: 'busca', termo: PARAUAPEBAS.nome });
    await esperar(ESPERA_DA_BUSCA_EM_MS);

    const requisicoes = http.match((r) => r.url === CIDADES);
    expect(requisicoes).toHaveLength(2);
    for (const requisicao of requisicoes) {
      const termo = requisicao.request.params.get('q');
      requisicao.flush(respostaDa(termo === MARABA.nome ? MARABA : PARAUAPEBAS));
    }

    expect(estado(primeira)).toMatchObject({ carregando: false });
    expect(estado(primeira)?.opcoes).toEqual([expect.objectContaining(MARABA)]);
    expect(estado(segunda)).toMatchObject({ carregando: false });
    expect(estado(segunda)?.opcoes).toEqual([expect.objectContaining(PARAUAPEBAS)]);
  });

  it('cancela a busca anterior do mesmo dia em vez de aceitar duas respostas', async () => {
    const grupo = diaMunicipal();

    await buscarEEsperar(grupo, 'Marab');
    const primeira = http.expectOne((r) => r.url === CIDADES);
    await buscarEEsperar(grupo, 'Parauapebas');
    const segunda = http.expectOne((r) => r.url === CIDADES);

    expect(primeira.cancelled).toBe(true);
    segunda.flush(respostaDa(PARAUAPEBAS));
    expect(estado(grupo)?.opcoes).toEqual([expect.objectContaining(PARAUAPEBAS)]);
    expect(estado(grupo)?.erro).toBe(false);
  });

  it('descarta a resposta de um termo que já não é o da busca', async () => {
    const grupo = diaMunicipal();
    await buscarEEsperar(grupo, 'Marab');
    const resposta = http.expectOne((r) => r.url === CIDADES);

    grupo.controls.buscaMunicipio.setValue('Outro', { emitEvent: false });
    resposta.flush(respostaDa(MARABA));

    expect(estado(grupo)?.opcoes).toEqual([]);
  });

  it('escolher uma opção com a busca em voo encerra o "Buscando" e descarta a resposta atrasada', async () => {
    const grupo = diaMunicipal();
    await escolher(grupo);

    busca.aplicar(grupo, { tipo: 'busca', termo: 'Marab' });
    await esperar(ESPERA_DA_BUSCA_EM_MS);
    const emVoo = http.expectOne((r) => r.url === CIDADES);
    expect(estado(grupo)?.carregando).toBe(true);

    grupo.controls.codigoMunicipio.setValue(MARABA.codigoIbge);
    busca.aplicar(grupo, { tipo: 'municipio' });
    expect(estado(grupo)).toMatchObject({ carregando: false, erro: false });

    emVoo.flush(respostaDa(PARAUAPEBAS));
    expect(estado(grupo)).toMatchObject({ carregando: false, erro: false });
    expect(estado(grupo)?.opcoes).toEqual([expect.objectContaining(MARABA)]);
  });

  it('descarta a resposta de um dia que saiu do formulário', async () => {
    const grupo = diaMunicipal();
    await buscarEEsperar(grupo, MARABA.nome);
    const resposta = http.expectOne((r) => r.url === CIDADES);

    busca.descartar(grupo);
    resposta.flush(respostaDa(MARABA));

    expect(estado(grupo)).toBeUndefined();
  });

  it('a falha da Geo mantém as opções vistas e oferece nova tentativa', async () => {
    const grupo = diaMunicipal();
    await buscarEEsperar(grupo, MARABA.nome);
    http.expectOne((r) => r.url === CIDADES).flush(respostaDa(MARABA));

    busca.aplicar(grupo, { tipo: 'busca', termo: 'Marabá ' });
    await esperar(ESPERA_DA_BUSCA_EM_MS);
    http.expectOne((r) => r.url === CIDADES).flush('falha', { status: 503, statusText: 'Erro' });
    expect(estado(grupo)?.erro).toBe(true);
    expect(estado(grupo)?.opcoes).toEqual([expect.objectContaining(MARABA)]);

    busca.aplicar(grupo, { tipo: 'novaTentativa' });
    expect(estado(grupo)).toMatchObject({ carregando: true, erro: false });
    await esperar(ESPERA_DA_BUSCA_EM_MS);
    http.expectOne((r) => r.url === CIDADES).flush(respostaDa(MARABA));
    expect(estado(grupo)).toMatchObject({ carregando: false, erro: false });
  });

  it('nova tentativa sem termo suficiente não consulta a Geo', async () => {
    const grupo = diaMunicipal();

    busca.aplicar(grupo, { tipo: 'novaTentativa' });
    await esperar(ESPERA_DA_BUSCA_EM_MS);

    http.expectNone((r) => r.url === CIDADES);
  });

  it('mantém o escolhido nas opções mesmo que a nova resposta não o traga', async () => {
    const grupo = diaMunicipal();
    await escolher(grupo);

    busca.aplicar(grupo, { tipo: 'busca', termo: 'Marabá' });
    await esperar(ESPERA_DA_BUSCA_EM_MS);
    http.expectOne((r) => r.url === CIDADES).flush(respostaDa(PARAUAPEBAS));

    expect(estado(grupo)?.opcoes.map((opcao) => opcao.codigoIbge)).toEqual([
      MARABA.codigoIbge,
      PARAUAPEBAS.codigoIbge,
    ]);
  });

  it('mudar a abrangência reinicia a busca e a UF do dia', async () => {
    const grupo = diaMunicipal();
    await escolher(grupo);

    grupo.controls.abrangencia.setValue('ESTADUAL');
    busca.aplicar(grupo, { tipo: 'abrangencia' });

    expect(estado(grupo)).toEqual({ opcoes: [], carregando: false, erro: false });
    expect(municipioSelecionadoDe(grupo)).toBeNull();
    aplicarAbrangencia(grupo);
    expect(grupo.controls.uf.value).toBe('PA');
  });
});
