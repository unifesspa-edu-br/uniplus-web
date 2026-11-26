import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider, Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import {
  ProcessoSeletivoDto,
  RegraCatalogoDto,
  SELECAO_BASE_PATH,
  SituacaoDoProcessoSeletivoCodigo,
} from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { CatalogoDeTiposDeEtapa } from '../cronograma/catalogos/catalogo-de-tipos-de-etapa.service';
import { CatalogosDeClassificacao } from './catalogos-de-classificacao.service';
import { GravacaoDaClassificacao } from './gravacao-da-classificacao.service';
import { LeituraDoCadastroDePesos } from './leitura-do-cadastro-de-pesos.service';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-000000000898';

const TIPO_REGRA = {
  codigo: 'REGRA_CALCULO' as RegraCatalogoDto['tipo']['codigo'],
  rotulo: 'Regra de cálculo',
};

export function regra(codigo: string): RegraCatalogoDto {
  return {
    codigo,
    versao: '1.0',
    tipo: TIPO_REGRA,
    declaracaoDaRegra: {},
    invariantes: {},
    baseLegal: `Base de ${codigo}`,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
    ramoDaDistribuicao: null,
  };
}

export interface Montagem<T> {
  fixture: ComponentFixture<T>;
  host: HTMLElement;
  store: ProcessoSeletivoStore;
  catalogos: CatalogosDeClassificacao;
}

function servicosEHttp(): (Provider | EnvironmentProviders)[] {
  return [
    ProcessoSeletivoStore,
    CadastroInicial,
    GravacaoDoProcesso,
    CatalogosDeClassificacao,
    GravacaoDaClassificacao,
    LeituraDoCadastroDePesos,
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
  ];
}

function dublesEEnderecos(): Provider[] {
  return [
    { provide: PermissoesService, useValue: { tem: () => false } },
    { provide: CatalogoDeTiposDeEtapa, useValue: { tipoEtapaPorId: signal(new Map()) } },
    { provide: ReleituraDoSnapshot, useValue: { reler: async () => true } },
    { provide: SELECAO_BASE_PATH, useValue: BASE },
    { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  ];
}

export async function montar<T>(componente: Type<T>): Promise<Montagem<T>> {
  await TestBed.configureTestingModule({
    imports: [componente],
    providers: [...dublesEEnderecos(), ...servicosEHttp()],
  }).compileComponents();

  const fixture = TestBed.createComponent(componente);
  const store = TestBed.inject(ProcessoSeletivoStore);
  const catalogos = TestBed.inject(CatalogosDeClassificacao);
  store.processoSeletivoId.set(PROCESSO_ID);
  detectar(fixture);
  return { fixture, host: fixture.nativeElement as HTMLElement, store, catalogos };
}

/** Renderiza e responde vazio a toda leitura de fundo que o passo disparar. */
export function detectar(fixture: ComponentFixture<unknown>): void {
  const controller = TestBed.inject(HttpTestingController);
  for (let rodada = 0; rodada < 3; rodada++) {
    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
  }
  fixture.detectChanges();
}

export function valorDoSelect(host: HTMLElement, id: string): string | undefined {
  return host.querySelector<HTMLSelectElement>(`#${id}`)?.value;
}

/** O processo publicado: a edição fica bloqueada pelo status lido do servidor. */
export function publicar(store: ProcessoSeletivoStore): void {
  store.remoteSnapshot.set({
    id: PROCESSO_ID,
    situacao: {
      codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
    },
  } as unknown as ProcessoSeletivoDto);
}

/** O que a consulta lê sob cada rótulo, na ordem da tela. */
export function leitura(host: HTMLElement): (readonly [string, string])[] {
  return Array.from(host.querySelectorAll('dl')).map(
    (par) =>
      [
        par.querySelector('dt')?.textContent?.trim() ?? '',
        par.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ] as const,
  );
}

/** Nenhum controle de formulário nem ação: a consulta lê, não edita. */
export function semControles(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('input, select, textarea, button, ui-combobox')).map(
    (controle) => controle.id || controle.tagName,
  );
}

export function controlesEditaveis(host: HTMLElement, seletor: string): string[] {
  return Array.from(host.querySelectorAll<HTMLInputElement>(seletor))
    .filter((controle) => !controle.disabled)
    .map((controle) => controle.id || controle.textContent?.trim() || controle.tagName);
}

export const CLASSIFICACAO_LOCAL = {
  regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
  regraCalculoVersao: '1.0',
  regraArredondamentoCodigo: 'ARRED-TRUNCAR',
  regraArredondamentoVersao: '1.0',
  casasArredondamento: '2',
  regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
  regraOrdemAlocacaoVersao: '1.0',
  escalaNotaFinal: '100',
};
