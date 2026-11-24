import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import {
  CertameNaVitrineDto,
  SELECAO_BASE_PATH,
  SituacaoDoCertameCodigo,
} from '@uniplus/shared-data/selecao';
import { ligarRelogioControlado } from '@uniplus/shared-testing';
import { delay, of } from 'rxjs';
import { expect, vi } from 'vitest';

import type { PublicacoesDoCertame } from '../publicacoes/publicacoes.model';
import {
  type CertameParaPublicacoes,
  PublicacoesRepository,
  type PublicacoesPorCertame,
} from '../publicacoes/publicacoes.repository';
import { ProcessosComponent } from './processos';
import { VisaoDosCertames } from './visao-dos-certames';
import { VitrineDeCertames } from './vitrine-de-certames';

const BASE = 'http://localhost:5000';
export const CERTAMES_URL = `${BASE}/api/selecao/certames`;
export const ACERVO = 'http://localhost:9000/uniplus-acervo-publico';

/** Quanto as publicações levam para chegar depois da vitrine. */
export const CHEGADA_DAS_PUBLICACOES_MS = 300;

const AGORA = new Date('2026-10-17T12:00:00Z');

export const sisu: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000e1',
  numero: 'Edital 12/2026',
  nome: 'SISU 2026.1 — Cursos de graduação',
  tipoProcesso: { codigo: 'VESTIBULAR', nome: 'Vestibular' },
  modalidadesOfertadas: ['AC', 'PPI'],
  inscricoesDe: '2026-02-01T00:00:00Z',
  inscricoesAte: '2026-04-16T23:59:59Z',
  situacao: { codigo: SituacaoDoCertameCodigo.inscricoesAbertas, rotulo: 'Inscrições abertas' },
  totalDeVagas: 1234,
  identificadorLegivel: 'sisu-2026-1',
};

export const tecnicoEnfermagem: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000e2',
  numero: 'Edital 07/2026',
  nome: 'Técnico em Enfermagem',
  tipoProcesso: { codigo: 'PSE', nome: 'Processo Seletivo Especial' },
  modalidadesOfertadas: ['AC'],
  inscricoesDe: '2026-02-01T00:00:00Z',
  inscricoesAte: '2026-03-25T23:59:59Z',
  situacao: { codigo: SituacaoDoCertameCodigo.ultimosDias, rotulo: 'Últimos dias' },
  totalDeVagas: 60,
  identificadorLegivel: 'psr-tec-enfermagem-2026',
};

export const encerrado: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000e3',
  numero: 'Edital 02/2026',
  nome: 'Pós-graduação em Educação',
  tipoProcesso: { codigo: 'PSE', nome: 'Processo Seletivo Especial' },
  modalidadesOfertadas: ['AC'],
  inscricoesDe: '2026-01-05T00:00:00Z',
  inscricoesAte: '2026-03-22T23:59:59Z',
  situacao: { codigo: SituacaoDoCertameCodigo.encerradas, rotulo: 'Encerrado' },
  totalDeVagas: 40,
  identificadorLegivel: 'pg-educacao-2026',
};

export const semDocumento: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-0000000000e9',
  identificadorLegivel: 'ps-sem-documento',
  numero: 'Edital 99/2026',
  nome: 'Certame sem PDF do edital',
  tipoProcesso: { codigo: 'VESTIBULAR', nome: 'Vestibular' },
  modalidadesOfertadas: ['AC'],
  inscricoesDe: '2026-02-01T00:00:00Z',
  inscricoesAte: '2026-04-16T23:59:59Z',
  situacao: { codigo: SituacaoDoCertameCodigo.inscricoesAbertas, rotulo: 'Inscrições abertas' },
  totalDeVagas: 10,
};

export const contadoresHeaders = {
  'X-Certames-Em-Breve': '0',
  'X-Certames-Inscricoes-Abertas': '1',
  'X-Certames-Ultimos-Dias': '1',
  'X-Certames-Encerrados': '0',
};

/** Os contadores e o `Link` de uma lista que tem a página seguinte. */
export const contadoresComProximaPagina = {
  ...contadoresHeaders,
  Link: `<${CERTAMES_URL}?cursor=p2&direction=next>; rel="next"`,
};

/** As publicações do próprio certame: o edital de abertura, com o PDF dele no acervo. */
export function publicacoesDe(certame: CertameParaPublicacoes): PublicacoesDoCertame {
  const documentoUrl = `${ACERVO}/${certame.processoSeletivoId}.pdf`;
  return {
    documentoEditalUrl: documentoUrl,
    publicacoes: [editalDeAbertura(certame, documentoUrl)],
  };
}

function editalDeAbertura(
  certame: CertameParaPublicacoes,
  documentoUrl: string,
): PublicacoesDoCertame['publicacoes'][number] {
  return {
    id: `${certame.processoSeletivoId}-abertura`,
    data: '2026-01-05',
    titulo: `Edital de abertura de ${certame.identificadorLegivel}`,
    tipo: 'Edital de abertura',
    documentos: {
      principal: { nome: 'edital.pdf', formato: 'PDF', tamanho: '1,2 MB', url: documentoUrl },
      anexos: [],
    },
  };
}

export type PublicacoesDaVitrine = Pick<PublicacoesRepository, 'buscarPorCertames'>;

/** As publicações chegam depois da vitrine. */
const publicacoesComEdital: PublicacoesDaVitrine = {
  buscarPorCertames: (certames) =>
    of(
      new Map(certames.map((certame) => [certame.processoSeletivoId, publicacoesDe(certame)])),
    ).pipe(delay(CHEGADA_DAS_PUBLICACOES_MS)),
};

/** As publicações que chegam junto da vitrine, sem espera. */
export function publicacoesImediatas(retorno: PublicacoesPorCertame): PublicacoesDaVitrine {
  return { buscarPorCertames: () => of(retorno) };
}

/** O corpo e as opções de uma resposta de erro no formato de problema da API. */
export function respostaDeProblema(
  status: number,
  codigo: string,
  titulo = 'Erro',
): [string, { status: number; statusText: string; headers: Record<string, string> }] {
  return [
    JSON.stringify({ title: titulo, status, code: codigo, traceId: 'test-trace' }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ];
}

function substituirMatchMedia(matches: boolean): void {
  window.matchMedia = ((consulta: string) =>
    ({
      matches,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

function configurarOTestBed(publicacoes: PublicacoesDaVitrine): void {
  TestBed.configureTestingModule({
    imports: [ProcessosComponent],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: PublicacoesRepository, useValue: publicacoes },
      { provide: RELOGIO, useValue: () => AGORA },
    ],
  });
}

interface PaginaMontada {
  fixture: ComponentFixture<ProcessosComponent>;
  controller: HttpTestingController;
  appRef: ApplicationRef;
}

function criarPagina(publicacoes: PublicacoesDaVitrine): PaginaMontada {
  substituirMatchMedia(false);
  localStorage.clear();
  configurarOTestBed(publicacoes);
  const fixture = TestBed.createComponent(ProcessosComponent);
  fixture.detectChanges();
  const controller = TestBed.inject(HttpTestingController);
  return { fixture, controller, appRef: TestBed.inject(ApplicationRef) };
}

/** Falha na montagem desfaz o relógio e o `matchMedia`: sem instância, o `encerrar` não roda. */
function montarPaginaComRelogioControlado(publicacoes: PublicacoesDaVitrine): PaginaMontada {
  ligarRelogioControlado();
  const matchMediaOriginal = window.matchMedia;
  try {
    return criarPagina(publicacoes);
  } catch (erro) {
    vi.useRealTimers();
    window.matchMedia = matchMediaOriginal;
    throw erro;
  }
}

/** A página de processos criada com a lista pendente, o relógio parado e as publicações à escolha. */
export class CenarioDaVitrine {
  readonly fixture: ComponentFixture<ProcessosComponent>;
  readonly controller: HttpTestingController;
  private readonly appRef: ApplicationRef;
  private readonly matchMediaOriginal = window.matchMedia;

  constructor(publicacoes: PublicacoesDaVitrine = publicacoesComEdital) {
    const { fixture, controller, appRef } = montarPaginaComRelogioControlado(publicacoes);
    this.fixture = fixture;
    this.controller = controller;
    this.appRef = appRef;
  }

  /** O relógio real volta primeiro: se a conferência falhar, o relógio falso não vaza ao próximo teste. */
  encerrar(): void {
    vi.useRealTimers();
    window.matchMedia = this.matchMediaOriginal;
    this.controller.verify();
  }

  vitrine(): VitrineDeCertames {
    return this.fixture.debugElement.injector.get(VitrineDeCertames);
  }

  visao(): VisaoDosCertames {
    return this.fixture.debugElement.injector.get(VisaoDosCertames);
  }

  host(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  chip(rotulo: string): HTMLButtonElement | null {
    return this.elementoComTexto('.filter-chip', rotulo);
  }

  botao(rotulo: string): HTMLButtonElement | null {
    return this.elementoComTexto('button', rotulo);
  }

  async propagar(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }

  async responderLista(
    itens: readonly CertameNaVitrineDto[],
    headers?: Record<string, string>,
  ): Promise<void> {
    const requisicao = this.controller.expectOne((requisicao) => requisicao.url === CERTAMES_URL);
    expect(requisicao.request.params.get('incluir_contadores')).toBe('true');
    requisicao.flush(itens, headers ? { headers } : undefined);
    await this.propagar();
  }

  async responderComProblema(status: number, codigo: string, titulo?: string): Promise<void> {
    this.controller
      .expectOne((requisicao) => requisicao.url === CERTAMES_URL)
      .flush(...respostaDeProblema(status, codigo, titulo));
    await this.propagar();
  }

  /** Cria uma segunda página, já numa tela abaixo de 600 px; a lista da primeira continua pendente. */
  criarPaginaEstreita(): ComponentFixture<ProcessosComponent> {
    substituirMatchMedia(true);
    const pagina = TestBed.createComponent(ProcessosComponent);
    pagina.detectChanges();
    return pagina;
  }

  private elementoComTexto(seletor: string, texto: string): HTMLButtonElement | null {
    const elementos = Array.from(this.host().querySelectorAll<HTMLButtonElement>(seletor));
    return elementos.find((elemento) => elemento.textContent?.includes(texto)) ?? null;
  }
}
