import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import type { PerfilConcedido } from '../models/perfil-concedido.model';
import { PROFILE_BASE_PATH } from '../tokens/auth.tokens';
import { AuthService } from './auth.service';
import { PerfisDeAcessoService } from './perfis-de-acesso.service';

const URL = 'http://api.test/api/profile/me';

function perfil(parcial: Partial<PerfilConcedido> & { nome: string }): PerfilConcedido {
  return {
    concessaoId: `c-${parcial.nome}`,
    perfilId: `p-${parcial.nome}`,
    escopoTipo: { codigo: 'UNIDADE', rotulo: 'Unidade' },
    unidadeId: 'u-1',
    unidadeSigla: 'CEPS',
    unidadeNome: 'Centro de Processos Seletivos',
    validaAte: null,
    ...parcial,
  };
}

function resposta(...perfis: PerfilConcedido[]) {
  return {
    userId: 'sub-1',
    name: 'Leandro Viana',
    email: 'leandro@exemplo.test',
    cpf: '52998224725',
    nomeSocial: null,
    perfis,
    timestamp: '2026-10-30T12:00:00Z',
  };
}

const GESTOR = perfil({ nome: 'Gestor de processo seletivo' });
const CONSULTA = perfil({
  nome: 'Consulta institucional',
  escopoTipo: { codigo: 'INSTITUICAO', rotulo: 'Instituição' },
  unidadeId: null,
  unidadeSigla: null,
  unidadeNome: null,
});

describe('PerfisDeAcessoService', () => {
  const sessao = signal<string | null>(null);
  let http: HttpTestingController;
  let service: PerfisDeAcessoService;

  async function iniciar(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: PROFILE_BASE_PATH, useValue: 'http://api.test' },
        { provide: AuthService, useValue: { sessao } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PerfisDeAcessoService);
    TestBed.tick();
  }

  /** Deixa as promessas pendentes (a resposta HTTP e o `await` do serviço) se resolverem. */
  const assentar = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

  async function responder(corpo: object): Promise<void> {
    http.expectOne(URL).flush(corpo);
    await assentar();
  }

  beforeEach(async () => {
    sessao.set('leandro:0');
    await iniciar();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('carrega os perfis da sessão, na ordem da API, com o rótulo de cada escopo', async () => {
    expect(service.estado()).toBe('carregando');
    await responder(resposta(CONSULTA, GESTOR));

    expect(service.estado()).toBe('carregada');
    expect(service.rotulos()).toEqual([
      'Consulta institucional — Instituição',
      'Gestor de processo seletivo — CEPS',
    ]);
  });

  it('rotula a unidade sem sigla pelo nome e a que não se encontra como não identificada', async () => {
    await responder(
      resposta(
        perfil({ nome: 'Gestor', unidadeSigla: null }),
        perfil({ nome: 'Avaliador', unidadeSigla: null, unidadeNome: null }),
      ),
    );

    expect(service.rotulos()).toEqual([
      'Gestor — Centro de Processos Seletivos',
      'Avaliador — Unidade não identificada',
    ]);
  });

  it('distingue a recusa da API de pessoa sem perfil', async () => {
    await responder(resposta());
    expect(service.estado()).toBe('carregada');
    expect(service.perfis()).toEqual([]);

    const recarga = service.recarregar();
    http.expectOne(URL).flush(null, { status: 403, statusText: 'Forbidden' });
    await recarga;

    expect(service.estado()).toBe('indisponivel');
    expect(service.perfis()).toEqual([]);
  });

  it.each([
    ['o servidor indisponível', 503],
    ['um erro do servidor', 500],
  ])('mantém os perfis da mesma pessoa quando a recarga falha por %s', async (_caso, status) => {
    await responder(resposta(GESTOR));

    const recarga = service.recarregar();
    http.expectOne(URL).flush(null, { status, statusText: 'Falha' });

    expect(await recarga).toBeNull();
    expect(service.estado()).toBe('carregada');
    expect(service.perfis()).toEqual([GESTOR]);
  });

  it('mantém os perfis quando a recarga da renovação do token falha por rede', async () => {
    await responder(resposta(GESTOR));

    sessao.set('leandro:1');
    TestBed.tick();
    http.expectOne(URL).error(new ProgressEvent('error'));
    await assentar();

    expect(service.estado()).toBe('carregada');
    expect(service.perfis()).toEqual([GESTOR]);
  });

  it('uma resposta atrasada de uma recarga já substituída não troca o que a mais recente deixou', async () => {
    await responder(resposta(GESTOR));

    const antiga = service.recarregar();
    const antigaRequisicao = http.expectOne(URL);
    const recente = service.recarregar();
    http.expectOne(URL).flush(null, { status: 503, statusText: 'Unavailable' });
    await recente;
    antigaRequisicao.flush(resposta(CONSULTA));
    await antiga;

    expect(service.estado()).toBe('carregada');
    expect(service.perfis()).toEqual([GESTOR]);
  });

  it('não leva os perfis de uma pessoa para outra quando a recarga falha por rede', async () => {
    await responder(resposta(GESTOR));

    sessao.set('betina:0');
    TestBed.tick();
    http.expectOne(URL).error(new ProgressEvent('error'));
    await assentar();

    expect(service.estado()).toBe('indisponivel');
    expect(service.perfis()).toEqual([]);
  });

  it('oculta o perfil cujo prazo já passou, sem esperar a recarga', async () => {
    const vencido = perfil({ nome: 'Vencido', validaAte: '2020-01-01T00:00:00Z' });
    const vigente = perfil({ nome: 'Vigente', validaAte: '2999-01-01T00:00:00Z' });
    await responder(resposta(vencido, vigente));

    expect(service.perfis().map((p) => p.nome)).toEqual(['Vigente']);
  });

  it('esconde o perfil no instante em que o prazo vence durante a sessão', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    const curto = perfil({ nome: 'Curto', validaAte: '2026-10-30T12:00:10Z' });
    http.expectOne(URL).flush(resposta(curto, GESTOR));
    await vi.advanceTimersByTimeAsync(1);
    expect(service.perfis()).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(service.perfis().map((p) => p.nome)).toEqual([GESTOR.nome]);
  });

  it('limpa os perfis quando a pessoa muda e carrega os da nova', async () => {
    await responder(resposta(GESTOR));
    expect(service.rotulos()).toHaveLength(1);

    sessao.set('fernanda:0');
    TestBed.tick();
    expect(service.perfis()).toEqual([]);
    expect(service.estado()).toBe('carregando');

    await responder(resposta());
    expect(service.estado()).toBe('carregada');
    expect(service.perfis()).toEqual([]);
  });

  it('limpa os perfis quando a sessão termina', async () => {
    await responder(resposta(GESTOR));

    sessao.set(null);
    TestBed.tick();

    expect(service.perfis()).toEqual([]);
    expect(service.estado()).toBe('pendente');
  });

  it('descarta a resposta de outra pessoa que chega depois da troca', async () => {
    sessao.set('leandro:0');
    const atrasada = http.expectOne(URL);

    sessao.set('fernanda:0');
    TestBed.tick();
    atrasada.flush(resposta(GESTOR));
    await assentar();

    expect(service.perfis()).toEqual([]);
    await responder(resposta(CONSULTA));
    expect(service.rotulos()).toEqual(['Consulta institucional — Instituição']);
  });

  it('consulta de novo na renovação do token da mesma pessoa, sem esvaziar a lista', async () => {
    await responder(resposta(GESTOR));

    sessao.set('leandro:1');
    TestBed.tick();
    expect(service.perfis()).toHaveLength(1);

    await responder(resposta());
    expect(service.perfis()).toEqual([]);
  });

  it('recarrega ao pedido, para ver a revogação ao reabrir Meu perfil', async () => {
    await responder(resposta(GESTOR, CONSULTA));

    const recarga = service.recarregar();
    http.expectOne(URL).flush(resposta(CONSULTA));
    await recarga;

    expect(service.rotulos()).toEqual(['Consulta institucional — Instituição']);
  });

  it('recarrega com uma única consulta e devolve a resposta inteira a quem pediu', async () => {
    await responder(resposta(GESTOR));

    const recarga = service.recarregar();
    http.expectOne(URL).flush(resposta(CONSULTA));
    const devolvida = await recarga;

    expect(devolvida?.name).toBe('Leandro Viana');
    expect(devolvida?.cpf).toBe('52998224725');
    expect(service.estado()).toBe('carregada');
    expect(service.rotulos()).toEqual(['Consulta institucional — Instituição']);
  });

  it('devolve null e deixa a lista vazia quando a API recusa a consulta', async () => {
    await responder(resposta(GESTOR));

    const recarga = service.recarregar();
    http.expectOne(URL).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await recarga).toBeNull();
    expect(service.estado()).toBe('indisponivel');
    expect(service.perfis()).toEqual([]);
  });

  it('trata a resposta sem a lista de perfis como pessoa sem perfil', async () => {
    await responder({ ...resposta(), perfis: undefined });

    expect(service.estado()).toBe('carregada');
    expect(service.perfis()).toEqual([]);
  });

  it('mantém os perfis visíveis durante a recarga e os troca quando a resposta chega', async () => {
    await responder(resposta(GESTOR));

    const recarga = service.recarregar();
    expect(service.estado()).toBe('carregada');
    expect(service.rotulos()).toEqual(['Gestor de processo seletivo — CEPS']);

    http.expectOne(URL).flush(resposta(CONSULTA));
    await recarga;
    expect(service.rotulos()).toEqual(['Consulta institucional — Instituição']);
  });

  it('não entrega a quem pediu os dados da pessoa anterior quando a pessoa muda na recarga', async () => {
    await responder(resposta(GESTOR));

    const recarga = service.recarregar();
    const atrasada = http.expectOne(URL);
    sessao.set('fernanda:0');
    TestBed.tick();
    atrasada.flush(resposta(GESTOR));

    expect(await recarga).toBeNull();
    await responder(resposta());
    expect(service.perfis()).toEqual([]);
  });

  it('guarda só os perfis: o CPF e os dados pessoais da resposta não ficam no serviço', async () => {
    await responder(resposta(GESTOR));
    const recarga = service.recarregar();
    http.expectOne(URL).flush(resposta(GESTOR));
    await recarga;

    const guardado = JSON.stringify([service.perfis(), service.rotulos(), service.estado()]);
    expect(guardado).not.toContain('52998224725');
    expect(guardado).not.toContain('Leandro Viana');
    expect(guardado).not.toContain('leandro@exemplo.test');
  });
});
