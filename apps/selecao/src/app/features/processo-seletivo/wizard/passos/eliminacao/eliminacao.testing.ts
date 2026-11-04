import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, type TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { CaraterEtapa, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach } from 'vitest';

import { EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogoDeTiposDeEtapa } from '../cronograma/catalogos/catalogo-de-tipos-de-etapa.service';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { EliminacaoPassoComponent } from './eliminacao.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_CLASSIFICACAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/classificacao`;
export const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
export const ROTA_DETALHE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;

/** O detalhe relido depois de gravar, com o quadro que o servidor acabou de congelar. */
export function detalheCom(resolucao: string, peso: number) {
  return {
    id: PROCESSO_ID,
    classificacao: {
      resolucaoPesoAreaEnem: resolucao,
      quadroPesoAreaEnem: [
        {
          grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
          baseLegal: `${resolucao} – Anexo I`,
          areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso, corte: 400 }],
        },
      ],
    },
  };
}

/** Deixa a gravação chegar à releitura do detalhe, que só sai depois de o PUT responder. */
export function aguardarReleitura(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

export const ETAPA_PERSISTIDA: EtapaPontuada = {
  id: 'etapa-1',
  nome: 'Prova objetiva',
  carater: CaraterEtapa.classificatoria,
  tipoEtapaOrigemId: 'tipo-1',
  peso: '1',
  notaMinima: '',
  ordem: 1,
  faseCodigo: '',
  produtos: [],
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
  bancas: [],
  recursos: [],
};

export function oferecidas(id: string): string[] {
  fixture.detectChanges();
  const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(`#${id}`);
  return Array.from(select?.options ?? [])
    .map((opcao) => opcao.value)
    .filter((valor) => valor !== '');
}

export function escolherNoSeletor(id: string, valor: string): void {
  fixture.detectChanges();
  const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(`#${id}`);
  if (select === null) throw new Error(`seletor ${id} ausente`);
  select.value = valor;
  select.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

export function digitar(id: string, valor: string): void {
  fixture.detectChanges();
  const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`);
  if (campo === null) throw new Error(`campo ${id} ausente`);
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

export function linhaDoCadastro(peso: number) {
  return {
    id: 'g',
    resolucao: RESOLUCAO,
    grupoCurso: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
    areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso, corte: null }],
    baseLegal: 'Anexo I',
    criadoEm: '2026-09-01T00:00:00Z',
  };
}

/** O cadastro de Peso por Área lido, com a resolução no peso informado. */
export function lerCadastroComPeso(peso: number): void {
  TestBed.inject(CatalogosDeClassificacao).garantirPesosAreaEnem(0);
  controller
    .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
    .flush([linhaDoCadastro(peso)]);
  controller
    .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'))
    .flush([]);
}

/** Base local completa e válida — cada teste desvia dela para provocar uma recusa. */
export function prepararClassificacaoLocal(): void {
  store.patchObjectSection('classificacao', {
    regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
    regraCalculoVersao: '1.0',
    regraArredondamentoCodigo: 'ARRED-TRUNCAR',
    regraArredondamentoVersao: '1.0',
    casasArredondamento: '2',
    regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
    regraOrdemAlocacaoVersao: '1.0',
    baseadoEmEnem: false,
    regrasEliminacao: [],
  });
}

export let componente: EliminacaoPassoComponent;
export let fixture: ComponentFixture<EliminacaoPassoComponent>;
export let store: ProcessoSeletivoStore;
export let controller: HttpTestingController;
export let tipoEtapaPorId: WritableSignal<ReadonlyMap<string, TipoEtapaDto>>;

/** Monta o passo de Eliminação antes de cada teste e confere, no fim, que nenhum pedido sobrou. */
export function montarEliminacao(): void {
  beforeEach(async () => {
    tipoEtapaPorId = signal(new Map());
    await TestBed.configureTestingModule({
      imports: [EliminacaoPassoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogosDeClassificacao,
        { provide: CatalogoDeTiposDeEtapa, useValue: { tipoEtapaPorId } },
        LeituraDoCadastroDePesos,
        ReleituraDoSnapshot,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EliminacaoPassoComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('cronograma', { etapas: [ETAPA_PERSISTIDA] });
  });

  afterEach(() => controller.verify());
}
