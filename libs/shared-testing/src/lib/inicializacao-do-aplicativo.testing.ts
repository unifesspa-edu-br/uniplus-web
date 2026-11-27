import {
  ApplicationInitStatus,
  ApplicationConfig,
  EnvironmentProviders,
  InjectionToken,
  Type,
  provideZonelessChangeDetection,
} from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface DependenciasDaInicializacao {
  configuracao: ApplicationConfig;
  servicoDeAutenticacao: Type<object>;
  urlsAutorizadas: InjectionToken<readonly string[]>;
  fornecerRuntime: () => EnvironmentProviders;
  fornecerAutenticacao: () => EnvironmentProviders;
}

const configuracaoRecebida = {
  apiUrl: 'https://api.exemplo.br',
  geoApiUrl: 'https://geo.exemplo.br',
  oidc: {
    issuerUrl: 'https://login.exemplo.br',
    clientId: 'aplicativo',
    antecedenciaDaRenovacaoEmSegundos: 60,
  },
};
const autenticacaoEsperada = {
  issuerUrl: 'https://login.exemplo.br',
  clientId: 'aplicativo',
  antecedenciaDaRenovacaoEmSegundos: 60,
  allowedUrls: ['https://api.exemplo.br', 'https://login.exemplo.br', 'https://geo.exemplo.br'],
};

function configurarTeste(
  dependencias: DependenciasDaInicializacao,
  configuracao: ApplicationConfig,
  iniciarAutenticacao: ReturnType<typeof vi.fn>,
) {
  TestBed.configureTestingModule({
    providers: [
      ...configuracao.providers,
      provideZonelessChangeDetection(),
      provideHttpClientTesting(),
      { provide: dependencias.servicoDeAutenticacao, useValue: { init: iniciarAutenticacao } },
    ],
  });
}

function prepararInicializacao(
  dependencias: DependenciasDaInicializacao,
  configuracao: ApplicationConfig,
) {
  vi.spyOn(document, 'baseURI', 'get').mockReturnValue('https://exemplo.br/aplicativo/');
  const iniciarAutenticacao = vi.fn().mockResolvedValue(undefined);
  configurarTeste(dependencias, configuracao, iniciarAutenticacao);
  const inicializacao = TestBed.inject(ApplicationInitStatus).donePromise;
  const requisicao = TestBed.inject(HttpTestingController).expectOne(
    new URL('assets/runtime-config.json', document.baseURI).toString(),
  );
  expect(requisicao.request.method).toBe('GET');
  expect(iniciarAutenticacao).not.toHaveBeenCalled();
  return { inicializacao, iniciarAutenticacao, requisicao };
}

async function conferirSucesso(
  dependencias: DependenciasDaInicializacao,
  configuracao: ApplicationConfig,
) {
  const { inicializacao, iniciarAutenticacao, requisicao } = prepararInicializacao(
    dependencias,
    configuracao,
  );
  requisicao.flush(configuracaoRecebida);
  await inicializacao;
  expect(iniciarAutenticacao).toHaveBeenCalledExactlyOnceWith(autenticacaoEsperada);
  expect(TestBed.inject(dependencias.urlsAutorizadas)).toEqual(autenticacaoEsperada.allowedUrls);
}

async function conferirFalha(dependencias: DependenciasDaInicializacao) {
  const { inicializacao, iniciarAutenticacao, requisicao } = prepararInicializacao(
    dependencias,
    dependencias.configuracao,
  );
  const falha = expect(inicializacao).rejects.toBeDefined();
  requisicao.flush('Erro', { status: 500, statusText: 'Erro' });
  await falha;
  expect(iniciarAutenticacao).not.toHaveBeenCalled();
}

export function testarInicializacaoDoAplicativo(dependencias: DependenciasDaInicializacao): void {
  describe('inicialização do aplicativo', () => registrarCenarios(dependencias));
}

function registrarCenarios(dependencias: DependenciasDaInicializacao): void {
  afterEach(encerrarTeste);
  it('carrega a configuração e inicia a autenticação', () =>
    conferirSucesso(dependencias, dependencias.configuracao));
  it('interrompe a inicialização quando a configuração falha', () => conferirFalha(dependencias));
  it.each([
    ['configuração antes da autenticação', false],
    ['autenticação antes da configuração', true],
  ])(
    'os provedores da configuração e da autenticação funcionam em qualquer ordem: %s',
    (_nome, invertida) => {
      return conferirSucesso(dependencias, configuracaoNaOrdem(dependencias, invertida));
    },
  );
}

function configuracaoNaOrdem(dependencias: DependenciasDaInicializacao, invertida: boolean) {
  const runtime = dependencias.fornecerRuntime();
  const autenticacao = dependencias.fornecerAutenticacao();
  const provedores = invertida ? [autenticacao, runtime] : [runtime, autenticacao];
  return { providers: [provideHttpClient(), ...provedores] };
}

function encerrarTeste(): void {
  TestBed.inject(HttpTestingController).verify();
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
}
