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
import { SELECAO_BASE_PATH, type InscricaoDoProcessoDto } from '@uniplus/shared-data/selecao';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FERNANDA, PROCESSO, PROCESSO_ID } from './inscricoes-do-processo.testing';

import { InscricoesDoProcessoPage } from './inscricoes-do-processo.page';

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
  const celulas = (linha = 0): string[] =>
    Array.from(host().querySelectorAll('tbody tr')[linha].querySelectorAll('td')).map(
      (td) => td.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
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
