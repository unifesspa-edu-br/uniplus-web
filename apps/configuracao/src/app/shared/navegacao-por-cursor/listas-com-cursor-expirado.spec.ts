import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { CampiApi, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH, UnidadesApi } from '@uniplus/shared-data/organizacao';
import { BaseLegalBonusRegionalStore } from '../../features/base-legal-bonus-regional/base-legal-bonus-regional.store';
import { CalendariosStore } from '../../features/calendario-dias-uteis/calendarios.store';
import { CampiStore } from '../../features/campi/campi.store';
import { CondicoesAtendimentoStore } from '../../features/condicoes-atendimento/condicoes-atendimento.store';
import { OfertasDoCursoStore } from '../../features/cursos/ofertas-do-curso.store';
import { engCiv } from '../../features/cursos/cursos.testing';
import { FasesCanonicasStore } from '../../features/fases-canonicas/fases-canonicas.store';
import { LocaisOfertaStore } from '../../features/locais-oferta/locais-oferta.store';
import { ModalidadesStore } from '../../features/modalidades/modalidades.store';
import { FasesDoGrafoStore } from '../../features/precedencias-fase/fases-do-grafo.store';
import { PrecedenciasFaseStore } from '../../features/precedencias-fase/precedencias-fase.store';
import { DecisoesDaProtecaoStore } from '../../features/protecao-do-catalogo/decisoes-da-protecao.store';
import { RecursosAcessibilidadeStore } from '../../features/recursos-acessibilidade/recursos-acessibilidade.store';
import { ReservaDemograficaStore } from '../../features/reserva-demografica/reserva-demografica.store';
import { TermosConsentimentoStore } from '../../features/termos-consentimento/termos-consentimento.store';
import { TiposBancaStore } from '../../features/tipos-banca/tipos-banca.store';
import { TiposDeficienciaStore } from '../../features/tipos-deficiencia/tipos-deficiencia.store';
import { TiposDocumentoStore } from '../../features/tipos-documento/tipos-documento.store';
import { TiposEtapaStore } from '../../features/tipos-etapa/tipos-etapa.store';
import { TiposProcessoStore } from '../../features/tipos-processo/tipos-processo.store';
import { AprovacaoDoCatalogo } from '../protecao-do-catalogo';
import { UnidadesStore } from '../../features/unidades/unidades.store';

interface Loja {
  proximaPagina?(): void;
  proxima?(): void;
  tentarNovamente?(): unknown;
  recarregar?(): unknown;
  carregar?(): unknown;
  carregando?(): boolean;
  loading?(): boolean;
  mensagemDeErro?(): string | null;
  errorMessage?(): string | null;
}

interface Lista {
  readonly nome: string;
  readonly loja: Type<Loja>;
  readonly url: string;
  /** Provedores de que a loja depende e que não são da raiz. */
  readonly apoio?: readonly Type<unknown>[];
  /** Leva a loja ao estado em que ela lê a primeira página, quando só a abertura dispara a leitura. */
  readonly abrir?: (loja: Loja) => void;
}

const LISTAS: readonly Lista[] = [
  { nome: 'tipos de banca', loja: TiposBancaStore, url: '/api/configuracao/tipos-banca' },
  {
    nome: 'condições de atendimento',
    loja: CondicoesAtendimentoStore,
    url: '/api/configuracao/condicoes-atendimento',
  },
  {
    nome: 'referências de reserva demográfica',
    loja: ReservaDemograficaStore,
    url: '/api/configuracao/referencias-reserva-demografica',
  },
  {
    nome: 'tipos de deficiência',
    loja: TiposDeficienciaStore,
    url: '/api/configuracao/tipos-deficiencia',
  },
  { nome: 'tipos de etapa', loja: TiposEtapaStore, url: '/api/configuracao/tipos-etapa' },
  { nome: 'campi', loja: CampiStore, url: '/api/configuracao/campi' },
  {
    nome: 'tipos de processo',
    loja: TiposProcessoStore,
    url: '/api/configuracao/admin/tipos-processo',
  },
  {
    nome: 'recursos de acessibilidade',
    loja: RecursosAcessibilidadeStore,
    url: '/api/configuracao/recursos-acessibilidade',
  },
  { nome: 'calendários', loja: CalendariosStore, url: '/api/configuracao/calendarios-dias-uteis' },
  {
    nome: 'ofertas do curso',
    loja: OfertasDoCursoStore,
    url: '/api/configuracao/ofertas-curso',
    abrir: (l) => (l as OfertasDoCursoStore).abrir(engCiv),
  },
  {
    nome: 'tipos de documento',
    loja: TiposDocumentoStore,
    url: '/api/configuracao/tipos-documento',
    apoio: [AprovacaoDoCatalogo],
  },
  {
    nome: 'bases legais do bônus regional',
    loja: BaseLegalBonusRegionalStore,
    url: '/api/configuracao/base-legal-bonus-regional',
  },
  {
    nome: 'termos de consentimento',
    loja: TermosConsentimentoStore,
    url: '/api/configuracao/termos-consentimento',
  },
  { nome: 'unidades', loja: UnidadesStore, url: '/api/organizacao/unidades' },
  {
    nome: 'precedências de fase',
    loja: PrecedenciasFaseStore,
    url: '/api/configuracao/precedencias-fase',
    apoio: [FasesDoGrafoStore],
  },
  {
    nome: 'decisões da proteção',
    loja: DecisoesDaProtecaoStore,
    url: '/api/configuracao/admin/protecao-do-catalogo/decisoes',
  },
  { nome: 'fases canônicas', loja: FasesCanonicasStore, url: '/api/configuracao/fases-canonicas' },
  { nome: 'locais de oferta', loja: LocaisOfertaStore, url: '/api/configuracao/locais-oferta' },
  { nome: 'modalidades', loja: ModalidadesStore, url: '/api/configuracao/modalidades' },
];

const PROXIMA = { headers: { Link: '<x?cursor=proximo>; rel="next"' } };

function problema(status: number, code: string) {
  return [
    { title: 'Erro', status, code, type: 'about:blank', traceId: '' },
    { status, statusText: 'Erro', headers: { 'Content-Type': 'application/problem+json' } },
  ] as const;
}

describe('listas paginadas por cursor: cursor expirado', () => {
  let http: HttpTestingController;
  let info: ReturnType<typeof vi.fn>;

  function montar(lista: Lista): void {
    info = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        lista.loja,
        ...(lista.apoio ?? []),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: ORGANIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: NotificationService, useValue: { info, errorFromProblem: vi.fn() } },
        { provide: UnidadesApi, useValue: { listar: () => of({ ok: true, data: [] }) } },
        { provide: CampiApi, useValue: { listar: () => of({ ok: true, data: [] }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }
  afterEach(() => TestBed.resetTestingModule());

  async function atualizar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
  }

  const daLista =
    (lista: Lista, comCursor: boolean) =>
    (r: { url: string; params: { has(n: string): boolean } }) =>
      r.url.includes(lista.url) && r.params.has('cursor') === comCursor;

  describe.each(LISTAS)('$nome', (lista) => {
    it('o cursor recusado na nova tentativa recomeça da primeira página, em andamento até o fim', async () => {
      montar(lista);
      const loja = TestBed.inject(lista.loja);
      lista.abrir?.(loja);
      await atualizar();
      http.expectOne(daLista(lista, false)).flush([], PROXIMA);
      await atualizar();
      (loja.proximaPagina ?? loja.proxima)?.call(loja);
      await atualizar();
      const [erro, opcoesDoErro] = problema(500, 'uniplus.erro');
      http.expectOne(daLista(lista, true)).flush(erro, opcoesDoErro);
      await atualizar();
      (loja.tentarNovamente ?? loja.recarregar ?? loja.carregar)?.call(loja);
      await atualizar();

      const [expirado, opcoes] = problema(410, 'uniplus.cursor.expirado');
      http.expectOne(daLista(lista, true)).flush(expirado, opcoes);
      await Promise.resolve();
      const carregando = loja.carregando ?? loja.loading;
      const mensagem = loja.mensagemDeErro ?? loja.errorMessage;
      expect(carregando?.call(loja)).toBe(true);
      expect(mensagem?.call(loja)).toBeNull();

      await atualizar();
      http.expectOne(daLista(lista, false)).flush([]);
      await atualizar();
      expect(carregando?.call(loja)).toBe(false);
      expect(info).toHaveBeenCalledTimes(1);
      // As leituras de apoio da loja (categorias, fatos, fases) não fazem parte do roteiro.
      for (const apoio of http.match(() => true)) apoio.flush([]);
      http.verify();
    });
  });
});
