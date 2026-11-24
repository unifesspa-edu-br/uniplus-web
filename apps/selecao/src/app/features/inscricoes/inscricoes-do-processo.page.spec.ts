import { provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  type InscricaoDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { INSCRICAO_CANCELADA, INSCRICAO_ENVIADA } from './situacoes-da-inscricao.testing';
import { DIREITO, FERNANDA, MEDICINA, PROCESSO, PROCESSO_ID, oferta } from './inscricoes-do-processo.testing';

import {
  InscricoesDoProcessoPage,
  NOME_DA_INSCRICAO_SEM_DADOS,
} from './inscricoes-do-processo.page';

const BASE = 'http://localhost:5000';
const ROTA_LISTA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes`;

const concedidas = signal<readonly string[]>([]);
const permissoesStub = { tem: (codigo: string) => concedidas().includes(codigo) };

/** Liga a falha da lista fora do envelope da API, que o `apiResultInterceptor` não converte. */
let listaQuebra = false;
const quebraALista: HttpInterceptorFn = (req, next) =>
  listaQuebra && req.url === ROTA_LISTA
    ? throwError(() => new Error('fora do contrato'))
    : next(req);

describe('InscricoesDoProcessoPage', () => {
  let fixture: ComponentFixture<InscricoesDoProcessoPage>;
  let controller: HttpTestingController;

  beforeEach(() => {
    concedidas.set([]);
    listaQuebra = false;
    TestBed.configureTestingModule({
      imports: [InscricoesDoProcessoPage],
      providers: [
        provideHttpClient(withInterceptors([quebraALista, apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: PermissoesService, useValue: permissoesStub },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: PROCESSO_ID })) },
        },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  async function propagar(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  async function criarPagina(): Promise<void> {
    fixture = TestBed.createComponent(InscricoesDoProcessoPage);
    fixture.detectChanges();
    await propagar();
  }

  const daLista = (filtro: (r: TestRequest['request']) => boolean = () => true): TestRequest =>
    controller.expectOne((r) => r.url === ROTA_LISTA && filtro(r));

  /** Abre a página e responde a primeira página da lista. */
  async function abrir(
    itens: readonly Partial<InscricaoDoProcessoDto>[],
    opcoes: { link?: string } = {},
  ): Promise<void> {
    await criarPagina();
    const comProcesso = itens.map((item) => ({ processo: PROCESSO, ...item }));
    daLista().flush(comProcesso, { headers: opcoes.link ? { Link: opcoes.link } : undefined });
    await propagar();
  }

  const cabecalhos = (): string[] =>
    Array.from(host().querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
  const celulas = (linha = 0): string[] =>
    Array.from(host().querySelectorAll('tbody tr')[linha].querySelectorAll('td')).map(
      (td) => td.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  const nomesDosLinks = (): (string | null)[] =>
    Array.from(host().querySelectorAll('tbody a')).map((a) => a.getAttribute('aria-label'));

  it('lista o que a API devolve, com as ofertas pelo nome e o CPF mascarado', async () => {
    await abrir([FERNANDA]);

    expect(cabecalhos()).toEqual([
      'Inscrição',
      'Nome',
      'CPF',
      'Ofertas',
      'Situação',
      'Enviada em',
      'Ações',
    ]);
    expect(celulas()).toEqual([
      '2027-000101',
      'Fernanda Laura Nicole Drumond',
      '***.598.363-**',
      `${MEDICINA}${DIREITO}`,
      FERNANDA.situacao?.rotulo,
      '10/12/2026, 12:00',
      '',
    ]);
    expect(host().textContent).toContain('PSR 2027 — inscrições enviadas neste processo seletivo.');
    expect(host().textContent).not.toContain('Revelar');
  });

  it('numera as ofertas pela ordem da escolha, mesmo chegando invertidas', async () => {
    await abrir([{ id: 'i-1', ofertas: [oferta(2, DIREITO), oferta(1, MEDICINA)] }]);

    const itens = Array.from(host().querySelectorAll<HTMLLIElement>('tbody ol li'));
    expect(itens.map((li) => [li.value, li.textContent?.trim()])).toEqual([
      [1, MEDICINA],
      [2, DIREITO],
    ]);
  });

  it('mostra a oferta única sem número', async () => {
    await abrir([{ id: 'i-1', ofertas: [oferta(1, DIREITO)] }]);

    expect(host().querySelector('tbody ol')).toBeNull();
    expect(celulas()[0]).toBe(DIREITO);
  });

  it('diz que a oferta não foi identificada quando a API não a nomeia', async () => {
    await abrir([{ id: 'i-1', ofertas: [oferta(1, MEDICINA), oferta(2, null)] }]);

    const itens = Array.from(host().querySelectorAll('tbody ol li')).map((li) =>
      li.textContent?.trim(),
    );
    expect(itens).toEqual([MEDICINA, 'Oferta não identificada']);
  });

  it('não lê o certame para listar', async () => {
    await abrir([FERNANDA]);

    controller.expectNone((r) => r.url.includes('/certames/'));
  });

  it('não consulta o detalhe de nenhuma inscrição ao listar', async () => {
    await abrir([FERNANDA]);

    controller.expectNone((r) => r.url.startsWith(`${ROTA_LISTA}/`));
  });

  it('na avaliação cega mostra só o público, sem nome nem CPF e sem marca de campo oculto', async () => {
    await abrir([
      { id: 'insc-leandro', situacao: INSCRICAO_ENVIADA, ofertas: [oferta(1, DIREITO)] },
    ]);

    expect(cabecalhos()).toEqual(['Ofertas', 'Situação', 'Ações']);
    expect(host().textContent).not.toMatch(/oculto|restrito|protegido/i);
    expect(host().querySelector('[data-label="Nome"]')).toBeNull();
  });

  it('mantém o link da linha de quem só tem o acesso às inscrições, sem dado visível', async () => {
    await abrir([{ id: 'insc-manoel' }]);

    expect(cabecalhos()).toEqual(['Ações']);
    expect(celulas()).toEqual(['']);
    expect(host().querySelector('tbody a')?.getAttribute('href')).toBe(
      `/processo-seletivo/${PROCESSO_ID}/inscricoes/insc-manoel`,
    );
    expect(nomesDosLinks()).toEqual([`${NOME_DA_INSCRICAO_SEM_DADOS}, 1ª da página`]);
    expect(nomesDosLinks()[0]).toContain('Abrir inscrição');
  });

  it('mostra o CPF mascarado de quem não vê o nome, e o nome acessível do link o dispensa', async () => {
    await abrir([{ id: 'insc-diogo', cpf: { valor: '***.598.363-**', podeRevelar: false } }]);

    expect(cabecalhos()).toEqual(['CPF', 'Ações']);
    expect(nomesDosLinks()).toEqual(['Abrir inscrição 1ª da página']);
  });

  it('leva cada linha ao detalhe da inscrição, pelo número no nome do link', async () => {
    await abrir([FERNANDA]);

    const link = host().querySelector<HTMLAnchorElement>('tbody a');
    expect(link?.getAttribute('href')).toBe(
      `/processo-seletivo/${PROCESSO_ID}/inscricoes/insc-fernanda`,
    );
    expect(link?.getAttribute('aria-label')).toBe('Abrir inscrição 2027-000101');
  });

  it('nomeia o link pelo que a linha mostra, com a posição, quando o número não vem', async () => {
    await abrir([{ id: 'i-1', ofertas: [oferta(1, DIREITO)] }]);

    expect(nomesDosLinks()).toEqual([`Abrir inscrição 1ª da página, ${DIREITO}`]);
  });

  it('usa o nome de reserva, distinto por posição, só quando a linha não mostra nada', async () => {
    await abrir([{ id: 'i-1' }, { id: 'i-2' }]);

    expect(nomesDosLinks()).toEqual([
      `${NOME_DA_INSCRICAO_SEM_DADOS}, 1ª da página`,
      `${NOME_DA_INSCRICAO_SEM_DADOS}, 2ª da página`,
    ]);
  });

  it('não diz "sem dados visíveis" quando a linha mostra só a situação', async () => {
    const situacao = INSCRICAO_CANCELADA;
    await abrir([{ id: 'i-1', situacao }]);

    expect(nomesDosLinks()).toEqual(['Abrir inscrição 1ª da página']);
    expect(celulas()[0]).toBe(situacao.rotulo);
  });

  it('deixa a situação ausente vazia quando outra linha mostra a coluna', async () => {
    await abrir([{ id: 'i-1', situacao: INSCRICAO_ENVIADA }, { id: 'i-2' }]);

    expect(celulas(0)[0]).toBe(INSCRICAO_ENVIADA.rotulo);
    expect(celulas(1)[0]).toBe('');
    const celula = host().querySelectorAll('tbody tr')[1].querySelector('td');
    expect(celula?.getAttribute('data-label')).toBeNull();
    expect(celula?.querySelector('ui-tag')).toBeNull();
  });

  it('diz que não há inscrição enviada quando a lista vem vazia', async () => {
    await abrir([]);

    expect(host().textContent).toContain('Nenhuma inscrição enviada');
    expect(host().querySelector('ui-page-header')?.textContent).toContain(
      'Inscrições do processo seletivo',
    );
    expect(host().querySelector('table')).toBeNull();
  });

  it('anuncia o carregamento enquanto a lista não chega', async () => {
    await criarPagina();

    expect(host().querySelector('ui-spinner')).not.toBeNull();
    expect(host().querySelector('[aria-busy="true"]')).not.toBeNull();
    daLista().flush([]);
    await propagar();
  });

});
