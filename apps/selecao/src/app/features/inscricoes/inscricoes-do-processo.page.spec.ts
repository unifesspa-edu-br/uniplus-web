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
  SituacaoInscricao,
  type OfertaEscolhidaDto,
  type InscricaoDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InscricoesDoProcessoPage,
  NOME_DA_INSCRICAO_SEM_DADOS,
} from './inscricoes-do-processo.page';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_LISTA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes`;
const OFERTA_MEDICINA = '01960000-0000-7000-0000-00000000aaa1';

const concedidas = signal<readonly string[]>([]);
const permissoesStub = { tem: (codigo: string) => concedidas().includes(codigo) };

const PROCESSO = { id: PROCESSO_ID, nome: 'PSR 2027' };
const MEDICINA = 'Medicina (Bacharelado) — Faculdade de Medicina — INTEGRAL';
const DIREITO = 'Direito (Bacharelado) — Faculdade de Direito — Noturno';

const oferta = (ordem: number, nome: string | null): OfertaEscolhidaDto => ({
  id: `${OFERTA_MEDICINA.slice(0, -1)}${ordem}`,
  nome,
  ordem,
});

const FERNANDA: InscricaoDoProcessoDto = {
  id: 'insc-fernanda',
  processo: PROCESSO,
  numeroInscricao: '2027-000101',
  situacao: SituacaoInscricao.submetida,
  ofertas: [oferta(1, MEDICINA), oferta(2, DIREITO)],
  nome: { valor: 'Fernanda Laura Nicole Drumond' },
  cpf: { valor: '***.598.363-**', podeRevelar: false },
  submetidaEm: '2026-12-10T15:00:00Z',
};

/** Liga a falha da lista fora do envelope da API, que o `apiResultInterceptor` não converte. */
let listaQuebra = false;
const quebraALista: HttpInterceptorFn = (req, next) =>
  listaQuebra && req.url === ROTA_LISTA
    ? throwError(() => new Error('fora do contrato'))
    : next(req);

const PROXIMO = `<${ROTA_LISTA}?cursor=PROXIMO&direction=next>; rel="next"`;

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

  async function irParaProxima(): Promise<TestRequest> {
    botao('Próximo').click();
    await propagar();
    return daLista((r) => r.params.get('cursor') === 'PROXIMO');
  }

  const botao = (texto: string): HTMLButtonElement => {
    const encontrado = Array.from(host().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === texto,
    );
    if (encontrado === undefined) throw new Error(`Botão ${texto} ausente`);
    return encontrado;
  };
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
      'Enviada',
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
      { id: 'insc-leandro', situacao: SituacaoInscricao.submetida, ofertas: [oferta(1, DIREITO)] },
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
    await abrir([{ id: 'i-1', situacao: SituacaoInscricao.cancelada }]);

    expect(nomesDosLinks()).toEqual(['Abrir inscrição 1ª da página']);
    expect(celulas()[0]).toBe('Cancelada');
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

  it('avança e retrocede pelos cursores do Link, sem reenviar o limite', async () => {
    await abrir([FERNANDA], { link: PROXIMO });

    const segunda = await irParaProxima();
    expect(segunda.request.params.get('direction')).toBe('next');
    expect(segunda.request.params.has('limit')).toBe(false);
    segunda.flush([FERNANDA], {
      headers: { Link: `<${ROTA_LISTA}?cursor=ANTERIOR&direction=prev>; rel="prev"` },
    });
    await propagar();

    botao('Anterior').click();
    await propagar();
    const volta = daLista((r) => r.params.get('cursor') === 'ANTERIOR');
    expect(volta.request.params.get('direction')).toBe('prev');
    volta.flush([FERNANDA]);
    await propagar();
  });

  it('mantém a página em tela enquanto a seguinte carrega e depois de uma falha dela', async () => {
    await abrir([FERNANDA], { link: PROXIMO });

    const segunda = await irParaProxima();
    expect(celulas()[0]).toBe('2027-000101');
    segunda.flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    await propagar();

    expect(host().textContent).toContain('Não foi possível carregar as inscrições');
    expect(celulas()[0]).toBe('2027-000101');
    expect(botao('Próximo')).toBeDefined();
  });

  it('diz que o processo não foi encontrado no 404, com retorno', async () => {
    await criarPagina();
    daLista().flush(
      { title: 'Não encontrado', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
    await propagar();

    expect(host().textContent).toContain('Processo seletivo não encontrado');
    expect(host().querySelector('table')).toBeNull();
    expect(host().querySelector('a.btn--tertiary')?.getAttribute('href')).toBe(
      '/processo-seletivo',
    );
  });

  it('503, nova tentativa e 404: a recusa fica na tela e a conclusão não é anunciada', async () => {
    await criarPagina();
    const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
    daLista().flush(
      { title: 'Indisponível', status: 503 },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await propagar();

    botao('Tentar novamente').click();
    await propagar();
    daLista().flush(
      { title: 'Não encontrado', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
    await propagar();
    await propagar();

    expect(host().textContent).toContain('Processo seletivo não encontrado');
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('volta à lista de processos, que quem só consulta inscrições também abre', async () => {
    concedidas.set(['selecao:inscricoes:consultar']);
    await abrir([]);

    const retorno = host().querySelector('a.btn--tertiary');
    expect(retorno?.getAttribute('href')).toBe('/processo-seletivo');
    expect(retorno?.textContent).toContain('Voltar aos processos');
  });

  it('oferece nova tentativa na falha e recupera a lista', async () => {
    await criarPagina();
    daLista().flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    await propagar();

    expect(host().textContent).toContain('Não foi possível carregar as inscrições');
    expect(host().textContent).not.toContain('Nenhuma inscrição enviada');
    expect(host().textContent).not.toContain('Tente novamente em alguns minutos');
    expect(host().querySelector('.panel')).toBeNull();

    botao('Tentar novamente').click();
    await propagar();
    daLista().flush([FERNANDA]);
    await propagar();

    expect(host().textContent).not.toContain('Não foi possível carregar');
    expect(celulas()[0]).toBe('2027-000101');
  });

  it('mantém o seletor de tamanho da página na falha, para trocar um limite recusado', async () => {
    await criarPagina();
    daLista().flush(
      { title: 'Requisição inválida', status: 400 },
      { status: 400, statusText: 'Bad Request' },
    );
    await propagar();

    expect(host().textContent).toContain('Não foi possível carregar as inscrições');
    expect(host().querySelector('ui-list-footer select')).not.toBeNull();
  });

  function trocarLimiteNoRodape(): string {
    const seletor = host().querySelector<HTMLSelectElement>('ui-list-footer select');
    const outra = Array.from(seletor?.options ?? []).find((o) => o.value !== '50');
    if (seletor === null || outra === undefined) throw new Error('Seletor de limite ausente');
    seletor.value = outra.value;
    seletor.dispatchEvent(new Event('change'));
    return outra.value;
  }

  it('recomeça da primeira página, com o novo limite, ao trocar o limite de uma página navegada', async () => {
    await abrir([FERNANDA], { link: PROXIMO });
    (await irParaProxima()).flush([FERNANDA]);
    await propagar();

    const limite = trocarLimiteNoRodape();
    await propagar();

    const req = daLista((r) => r.params.get('limit') === limite);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([FERNANDA]);
    await propagar();
  });

  it('não perde o limite escolhido durante uma leitura em curso: cancela a leitura e relê', async () => {
    await abrir([FERNANDA], { link: PROXIMO });
    const emCurso = await irParaProxima();

    const limite = trocarLimiteNoRodape();
    await propagar();

    expect(emCurso.cancelled).toBe(true);
    const req = daLista((r) => r.params.get('limit') === limite);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([FERNANDA]);
    await propagar();

    const seletor = host().querySelector<HTMLSelectElement>('ui-list-footer select');
    expect(seletor?.value).toBe(limite);
  });

  it('recomeça da primeira página, avisando, quando o cursor expirou (410)', async () => {
    await abrir([FERNANDA], { link: PROXIMO });
    (await irParaProxima()).flush(
      { code: 'uniplus.cursor.expirado', status: 410 },
      { status: 410, statusText: 'Gone' },
    );
    await propagar();

    const primeira = daLista((r) => !r.params.has('cursor'));
    expect(primeira.request.params.get('limit')).toBe('50');
    primeira.flush([FERNANDA]);
    await propagar();

    expect(host().textContent).toContain('A lista voltou à primeira página');
    expect(celulas()[0]).toBe('2027-000101');
  });

  it('limpa a lista quando a primeira página falha fora do contrato da API', async () => {
    await abrir([FERNANDA]);
    listaQuebra = true;

    trocarLimiteNoRodape();
    await propagar();

    expect(host().querySelector('table')).toBeNull();
    expect(host().textContent).toContain('Não foi possível carregar as inscrições');
  });

  it('preserva a página em tela quando a navegação falha fora do contrato da API', async () => {
    await abrir([FERNANDA], { link: PROXIMO });
    listaQuebra = true;

    botao('Próximo').click();
    await propagar();

    expect(celulas()[0]).toBe('2027-000101');
    expect(host().textContent).toContain('Não foi possível carregar as inscrições');
  });

  it('ignora a troca para o limite que já vale, sem reler a lista', async () => {
    await abrir([FERNANDA]);

    const seletor = host().querySelector<HTMLSelectElement>('ui-list-footer select');
    if (seletor === null) throw new Error('O seletor de itens por página não está no rodapé.');
    seletor.value = '50';
    seletor.dispatchEvent(new Event('change'));
    await propagar();

    controller.expectNone((r) => r.url === ROTA_LISTA);
  });
});
