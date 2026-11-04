import { PesoPorAreaComponent } from './peso-por-area.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { signal, type Type } from '@angular/core';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService, type AppConfig } from '@uniplus/shared-data/config';
import { CONFIGURACAO_BASE_PATH, PesosEnemApi } from '@uniplus/shared-data/configuracao';
import {
  SELECAO_BASE_PATH,
  StatusProcesso,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';

export const BASE = 'http://localhost:5000';
export const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
export const OUTRA_RESOLUCAO = 'Resolução nº 12/2020/Consepe';
export const ROTA_PESOS = '/api/configuracao/pesos-area-enem';
export const ROTA_AREAS = '/api/configuracao/pesos-area-enem/areas';

/**
 * Linhas do cadastro de Peso por Área. As áreas têm códigos que nenhuma constante da tela
 * conhece: se a tela mostrar "Área de teste A", mostrou o que a API devolveu.
 */
export function linha(
  resolucao: string,
  grupo: { codigo: string; rotulo: string },
  areas: unknown[],
) {
  return {
    id: `${resolucao}-${grupo.codigo}`,
    resolucao,
    grupoCurso: grupo,
    areas,
    baseLegal: `${resolucao} – Anexo I`,
    criadoEm: '2026-09-01T00:00:00Z',
  };
}

export const TECNOLOGICA = { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' };
export const SAUDE = { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' };

export const PESOS = [
  linha(RESOLUCAO, TECNOLOGICA, [
    { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 2, corte: 400 },
    { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B', peso: 1.5, corte: null },
  ]),
  linha(RESOLUCAO, SAUDE, [
    { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 3, corte: null },
    { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B', peso: 1, corte: null },
  ]),
  linha(OUTRA_RESOLUCAO, TECNOLOGICA, [
    { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 1, corte: null },
  ]),
];

export const ERRO_500 = {
  corpo: { type: 'about:blank', title: 'Erro interno.', status: 500, code: 'x', traceId: 't' },
  opcoes: { status: 500, statusText: 'Internal Server Error' },
};

export const SELETOR_RESOLUCAO = '#f-resolucao-peso-area';

export interface Montagem {
  readonly fixture: ComponentFixture<unknown>;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly el: HTMLElement;
}

export interface MontagemDe<T> extends Montagem {
  readonly componente: T;
}

let controllerAtual: HttpTestingController | null = null;

/** Permissões de quem opera o wizard; o link do cadastro depende delas. */
export const concedidas = signal<readonly string[]>(['configuracao:pesos-area-enem:manter']);

/** A releitura do detalhe que o botão do aviso aciona; cada teste decide o que ela faz. */
export const releitura = {
  reler: vi.fn(async () => true),
  reset: () => releitura.reler.mockReset(),
};

export interface OpcoesDaMontagem {
  readonly config?: AppConfig;
  readonly pesosApi?: unknown;
  readonly antesDeMontar?: (store: ProcessoSeletivoStore) => void;
  /** O passo é quem acompanha o cadastro e carrega os catálogos; a seção sozinha não os pede. */
  readonly comoSecao?: boolean;
}

export async function montar<T>(
  tipo: Type<T>,
  opcoes: OpcoesDaMontagem = {},
): Promise<MontagemDe<T>> {
  await TestBed.configureTestingModule({
    imports: [tipo],
    providers: [
      ProcessoSeletivoStore,
      CatalogosDeClassificacaoService,
      AcompanhamentoDoCadastroDePesos,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      {
        provide: PermissoesService,
        useValue: { tem: (codigo: string) => concedidas().includes(codigo) },
      },
      { provide: ReleituraDoSnapshot, useValue: releitura },
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ...(opcoes.pesosApi ? [{ provide: PesosEnemApi, useValue: opcoes.pesosApi }] : []),
    ],
  }).compileComponents();

  if (opcoes.config) TestBed.inject(AppConfigService).load(opcoes.config);
  const store = TestBed.inject(ProcessoSeletivoStore);
  opcoes.antesDeMontar?.(store);
  if (opcoes.comoSecao) {
    TestBed.inject(AcompanhamentoDoCadastroDePesos).acompanhar();
    TestBed.inject(CatalogosDeClassificacaoService).carregar();
  }

  const fixture = TestBed.createComponent(tipo);
  const controller = TestBed.inject(HttpTestingController);
  controllerAtual = controller;
  fixture.detectChanges();

  for (const requisicao of controller.match((r) => r.url.includes('/regras-catalogo'))) {
    requisicao.flush([]);
  }
  fixture.detectChanges();

  return {
    fixture,
    componente: fixture.componentInstance,
    store,
    controller,
    el: fixture.nativeElement as HTMLElement,
  };
}

/** Depois de cada teste: devolve as permissões ao padrão e confere que nenhum pedido sobrou. */
export function encerrarMontagem(): void {
  concedidas.set(['configuracao:pesos-area-enem:manter']);
  releitura.reset();
  // Solta a referência antes de conferir: uma falha aqui não pode vazar para o teste seguinte.
  const controller = controllerAtual;
  controllerAtual = null;
  controller?.verify();
}

export function pedidosDoCadastro(m: Montagem) {
  return m.controller.match((r) => r.url.endsWith(ROTA_PESOS));
}

/** Responde a leitura do cadastro que está pendente — e só uma deve estar. */
export function responderPesos(m: Montagem, corpo: readonly object[] = PESOS): void {
  m.controller.expectOne((r) => r.url.endsWith(ROTA_PESOS)).flush([...corpo]);
  responderAreas(m);
}

/** A lista canônica é lida uma vez só: responde se ela estiver pendente. */
export function responderAreas(m: Montagem): void {
  m.controller
    .match((r) => r.url.endsWith(ROTA_AREAS))
    .forEach((r) => r.flush([...AREAS_DO_CADASTRO]));
  m.fixture.detectChanges();
}

export function falharPesos(m: Montagem): void {
  m.controller.expectOne((r) => r.url.endsWith(ROTA_PESOS)).flush(ERRO_500.corpo, ERRO_500.opcoes);
  m.controller
    .match((r) => r.url.endsWith(ROTA_AREAS))
    .forEach((r) => r.flush([...AREAS_DO_CADASTRO]));
  m.fixture.detectChanges();
}

/** Classificação baseada em ENEM com a média ponderada local — o caso que exige a resolução. */
export function marcarEnemComMediaPonderada(m: Montagem): void {
  rascunhoComResolucao('')(m.store);
  m.fixture.detectChanges();
}

export function escolherNoSeletor(m: Montagem, valor: string): void {
  const select = seletor(m);
  select.value = valor;
  select.dispatchEvent(new Event('change'));
  m.fixture.detectChanges();
}

export function seletor(m: Montagem): HTMLSelectElement {
  const select = m.el.querySelector<HTMLSelectElement>(SELETOR_RESOLUCAO);
  if (select === null) throw new Error('seletor da resolução ausente');
  return select;
}

export function botao(m: Montagem, rotulo: string): HTMLButtonElement | undefined {
  return Array.from(m.el.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) =>
    texto(b).includes(rotulo),
  );
}

/** A resolução que a consulta lê, sob o rótulo do campo. */
export function resolucaoEmConsulta(m: Montagem): string | undefined {
  return Array.from(m.el.querySelectorAll('dl'))
    .find((par) => texto(par.querySelector('dt')) === 'Resolução de Peso por Área')
    ?.querySelector('dd')
    ?.textContent?.trim();
}

export function texto(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Rascunho já com ENEM, média ponderada e a resolução — como fica depois de reabrir o processo. */
export function rascunhoComResolucao(resolucao: string) {
  return (store: ProcessoSeletivoStore) =>
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
      regraCalculoVersao: '1.0',
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: resolucao,
    });
}

/** O processo gravou `resolucao` com este quadro — a cópia congelada que o detalhe devolve. */
export function processoGravadoCom(
  resolucao: string,
  quadro: unknown[],
  status: StatusProcesso = StatusProcesso.rascunho,
) {
  return (store: ProcessoSeletivoStore) => {
    rascunhoComResolucao(resolucao)(store);
    const classificacao = { resolucaoPesoAreaEnem: resolucao, quadroPesoAreaEnem: quadro };
    store.remoteSnapshot.set({ status, classificacao } as unknown as ProcessoSeletivoDto);
    store.classificacao.registrarLida(
      classificacao as unknown as ProcessoSeletivoDto['classificacao'],
    );
  };
}

/** As cinco áreas, na ordem canônica do cadastro — a Redação primeiro. */
export const AREAS_CANONICAS = [
  { codigo: 'REDACAO', rotulo: 'Redação', peso: 2, corte: 400 },
  { codigo: 'CIENCIAS_DA_NATUREZA', rotulo: 'Ciências da Natureza', peso: 1.5, corte: null },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas', peso: 2.5, corte: null },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens', peso: 2.5, corte: null },
  { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1.5, corte: null },
];

/** As mesmas áreas na ordem em que a cópia congelada chega: por código. */
export const AREAS_POR_CODIGO = [...AREAS_CANONICAS].sort((a, b) => (a.codigo < b.codigo ? -1 : 1));

export const ROTULOS_CANONICOS = AREAS_CANONICAS.map((area) => area.rotulo);

/** A lista canônica que `GET …/pesos-area-enem/areas` publica — a ordem de qualquer quadro. */
export const AREAS_DO_CADASTRO = [
  ...AREAS_CANONICAS.map(({ codigo, rotulo }) => ({ codigo, rotulo })),
  { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A' },
  { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B' },
];

export const QUADRO_CONGELADO = [
  {
    grupoAreaEnem: TECNOLOGICA,
    baseLegal: `${RESOLUCAO} – Anexo I (congelada)`,
    areas: [{ codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 9, corte: 700 }],
  },
];

/** O catálogo que a seção lê, para conferir a leitura do cadastro. */
export function catalogos(): CatalogosDeClassificacaoService {
  return TestBed.inject(CatalogosDeClassificacaoService);
}

/** Monta só a seção, como o passo a usa: ele é quem acompanha o cadastro e carrega os catálogos. */
export async function montarSecao(
  opcoes: Omit<OpcoesDaMontagem, 'comoSecao'> = {},
): Promise<MontagemDe<PesoPorAreaComponent>> {
  return montar(PesoPorAreaComponent, { ...opcoes, comoSecao: true });
}
