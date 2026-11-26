import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  CursoDto,
  type GrupoAreaEnemDto,
  OfertaCursoDto,
} from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { valoresDaOferta } from '../ofertas-curso/valores-da-oferta.testing';
import { CursosPage } from './cursos.page';
import { CursosStore } from './cursos.store';
import { EdicaoDosCursos } from './edicao-dos-cursos';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

export const BASE = 'http://localhost:5000';
export const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
export const OFERTAS_URL = `${BASE}/api/configuracao/ofertas-curso`;
export const GRUPOS_URL = `${BASE}/api/configuracao/vocabularios/grupos-area-enem`;

/** Os grupos de área do ENEM como a API os devolve: código, rótulo e ordem. */
export const GRUPOS: readonly GrupoAreaEnemDto[] = [
  { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  { codigo: 'HUMANISTICA_I', rotulo: 'Humanística I' },
  { codigo: 'HUMANISTICA_II', rotulo: 'Humanística II' },
  { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
];

export const cursoSeed: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG_CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  criadoEm: '2026-06-10T12:00:00Z',
};

export const ofertaSeed: OfertaCursoDto = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'DIREITO_MARABA',
  cursoId: cursoSeed.id,
  localOfertaId: '01960000-0000-7000-0000-0000000000d1',
  unidadeOfertante: {
    origemId: '01960000-0000-7000-0000-0000000000e1',
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: valoresDaOferta.programa,
  regimeDeFuncionamento: valoresDaOferta.funcionamento,
  formatoPedagogico: valoresDaOferta.formato,
  regimeDeTurno: valoresDaOferta.regime,
  turnos: [valoresDaOferta.turnos[0]],
  codigoEmec: '123456',
  codigoNoSistemaAcademico: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export interface CursosPageMontada {
  readonly fixture: ComponentFixture<CursosPage>;
  readonly store: CursosStore;
  readonly edicao: EdicaoDosCursos;
  readonly ofertasDoCurso: OfertasDoCursoStore;
  readonly controller: HttpTestingController;
  readonly appRef: ApplicationRef;
  /** Deixa as tarefas pendentes correrem e atualiza a árvore. */
  propagate(): Promise<void>;
  /** Responde o pedido do vocabulário de grupos feito ao iniciar a página. */
  responderGrupos(): void;
  /** Responde a primeira página da lista, conferindo que ela leva o limite do rodapé. */
  flushLista(itens: readonly CursoDto[]): Promise<void>;
  /**
   * A página inicia pedindo o vocabulário de grupos. Quem não usa a lista deixa esse pedido
   * pendente; mais de um é pedido em excesso.
   */
  encerrar(): void;
}

function criarCursosPage(): ComponentFixture<CursosPage> {
  TestBed.configureTestingModule({
    imports: [CursosPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
  const fixture = TestBed.createComponent(CursosPage);
  fixture.detectChanges();
  return fixture;
}

function encerrarPedidosDeGrupos(controller: HttpTestingController): void {
  const pendentes = controller.match(GRUPOS_URL);
  expect(pendentes.length).toBeLessThanOrEqual(1);
  pendentes.forEach((pedido) => pedido.flush([...GRUPOS]));
  controller.verify();
}

async function responderPrimeiraPagina(
  pagina: Pick<CursosPageMontada, 'controller' | 'store' | 'propagate'>,
  itens: readonly CursoDto[],
): Promise<void> {
  const req = pagina.controller.expectOne((r) => r.url === CURSOS_URL);
  expect(req.request.params.get('limit')).toBe(String(pagina.store.limite()));
  req.flush(itens);
  await pagina.propagate();
}

type AcessosDaPagina = Pick<
  CursosPageMontada,
  'fixture' | 'store' | 'edicao' | 'ofertasDoCurso' | 'controller' | 'appRef'
>;

function acessosDaPagina(fixture: ComponentFixture<CursosPage>): AcessosDaPagina {
  const injetor = fixture.debugElement.injector;
  return {
    fixture,
    store: injetor.get(CursosStore),
    edicao: injetor.get(EdicaoDosCursos),
    ofertasDoCurso: injetor.get(OfertasDoCursoStore),
    controller: TestBed.inject(HttpTestingController),
    appRef: TestBed.inject(ApplicationRef),
  };
}

/** A página de cursos criada e renderizada, sem nenhuma resposta ainda. */
export function montarCursosPage(): CursosPageMontada {
  const acessos = acessosDaPagina(criarCursosPage());
  const { controller, appRef } = acessos;
  const pagina: CursosPageMontada = {
    ...acessos,
    propagate: async () => {
      await Promise.resolve();
      appRef.tick();
    },
    responderGrupos: () => controller.expectOne(GRUPOS_URL).flush([...GRUPOS]),
    flushLista: (itens) => responderPrimeiraPagina(pagina, itens),
    encerrar: () => encerrarPedidosDeGrupos(controller),
  };
  return pagina;
}
