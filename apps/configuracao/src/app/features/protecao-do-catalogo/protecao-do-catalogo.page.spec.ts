import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
const APROVAR = 'configuracao:protecao-do-catalogo:aprovar';
const concedidas = signal<readonly string[]>([APROVAR]);

const laudo: ItemDaProtecaoDoCatalogoDto = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: {
    situacao: 'SOLICITADA',
    solicitadaEm: '2026-11-01T12:00:00Z',
    decididaEm: null,
    classificacaoRecomendada: null,
    aceitaEm: null,
  },
};

const comprovante: ItemDaProtecaoDoCatalogoDto = {
  ...laudo,
  tipo: 'FATO',
  id: '01960000-0000-7000-0000-0000000000d3',
  codigo: 'RESIDE_EM_AREA_RURAL',
  nome: 'Reside em área rural',
  classificacaoProtecao: 'PESSOAL',
};

const recusa = (status: number, code: string, title: string) =>
  [
    JSON.stringify({ status, code, title }),
    { status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

describe('ProtecaoDoCatalogoPage', () => {
  let fixture: ComponentFixture<ProtecaoDoCatalogoPage>;
  let component: ProtecaoDoCatalogoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    concedidas.set([APROVAR]);
    TestBed.configureTestingModule({
      imports: [ProtecaoDoCatalogoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PermissoesService, useValue: { tem: (codigo: string) => concedidas().includes(codigo) } },
      ],
    });
    fixture = TestBed.createComponent(ProtecaoDoCatalogoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const assentar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };

  async function carregar(
    itens: readonly ItemDaProtecaoDoCatalogoDto[],
    catalogoDeFatos: readonly { codigo: string; dominio: string }[] = [],
  ): Promise<HTMLElement> {
    controller.expectOne(`${BASE}/api/configuracao/fatos-candidato`).flush(catalogoDeFatos);
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao'), 'só o que aguarda a decisão').toBe('SOLICITADA');
    req.flush(itens);
    await assentar();
    return fixture.nativeElement as HTMLElement;
  }

  const botao = (tela: HTMLElement, nome: string): HTMLButtonElement | null =>
    tela.querySelector<HTMLButtonElement>(`td button[aria-label="${nome}"]`);

  it('lista a proteção declarada de cada item que aguarda a decisão', async () => {
    const tela = await carregar([laudo, comprovante]);

    const texto = tela.textContent?.replace(/\s+/gu, ' ') ?? '';
    expect(texto).toContain('Laudo médico complementar');
    expect(texto).toContain('Interno');
    expect(texto).toContain('Execução de políticas públicas');
    expect(texto).toContain('Conferir o laudo do candidato com deficiência.');
    expect(texto).toContain('Fato do candidato');
  });

  it('aprovar leva a proteção conferida, com Idempotency-Key, e relê a lista', async () => {
    const tela = await carregar([laudo]);
    botao(tela, 'Aprovar Laudo médico complementar')?.click();

    const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toMatchObject({
      cadastro: 'TIPO_DOCUMENTO',
      itemId: laudo.id,
      decisao: 'APROVADA',
      classificacaoProtecao: 'INTERNO',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
    });
    post.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();

    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    await assentar();
    expect(tela.textContent).toContain('Nenhum item aguardando a sua decisão');
    expect(document.activeElement?.id).toBe('cfg-protecao-titulo');
  });

  it('negar sem a classificação recomendada não envia e pede a classificação', async () => {
    const tela = await carregar([laudo]);
    botao(tela, 'Negar Laudo médico complementar')?.click();
    fixture.detectChanges();
    // O diálogo leva o foco ao botão de fechar assim que abre; o erro vem depois, por ação da pessoa.
    await assentar();

    component['negar']();
    fixture.detectChanges();

    controller.expectNone((r) => r.method === 'POST');
    expect(tela.querySelector('#cfg-negativa-erro')?.textContent).toContain(
      'Indique a classificação recomendada.',
    );
    const campo = tela.querySelector('dialog select');
    expect(document.activeElement, 'o foco vai ao seletor').toBe(campo);
    expect(campo?.getAttribute('aria-describedby')).toContain('cfg-negativa-erro');
  });

  it('negar leva a classificação recomendada, e a atual não é oferecida como recomendação', async () => {
    const tela = await carregar([laudo]);
    botao(tela, 'Negar Laudo médico complementar')?.click();
    fixture.detectChanges();

    const opcoes = Array.from(tela.querySelectorAll<HTMLOptionElement>('dialog select option')).map((o) => o.value);
    expect(opcoes).toContain('SENSIVEL');
    expect(opcoes).not.toContain('INTERNO');
    // A hipótese declarada (execução de políticas públicas) existe no art. 7º e no art. 11, então a sensível cabe.

    component['recomendada'].setValue('SENSIVEL');
    component['negar']();

    const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
    expect(post.request.body).toMatchObject({
      decisao: 'NEGADA',
      classificacaoRecomendada: 'SENSIVEL',
      classificacaoProtecao: 'INTERNO',
    });
    post.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
  });

  it('no fato de texto, não oferece classificação abaixo de pessoal, que a API também recusa', async () => {
    const tela = await carregar(
      [{ ...comprovante, classificacaoProtecao: 'SENSIVEL' }],
      [{ codigo: 'RESIDE_EM_AREA_RURAL', dominio: 'TEXTO' }],
    );
    botao(tela, 'Negar Reside em área rural')?.click();
    fixture.detectChanges();

    const opcoes = Array.from(tela.querySelectorAll<HTMLOptionElement>('dialog select option')).map((o) => o.value);
    expect(opcoes).toContain('PESSOAL');
    expect(opcoes).not.toContain('PUBLICO');
    expect(opcoes).not.toContain('INTERNO');
  });

  it('a leitura nova cancela a em voo: a resposta velha não prevalece', async () => {
    await carregar([]);
    component['carregar']();
    const velha = controller.expectOne((r) => r.method === 'GET' && r.url === URL);
    component['carregar']();
    expect(velha.cancelled).toBe(true);
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([laudo]);
    await assentar();

    expect(component['itens']()).toEqual([laudo]);
  });

  it('não oferece a classificação que a hipótese legal declarada não admite', async () => {
    const tela = await carregar([{ ...laudo, classificacaoProtecao: 'PESSOAL', hipoteseLegal: 'INTERESSE_LEGITIMO' }]);
    botao(tela, 'Negar Laudo médico complementar')?.click();
    fixture.detectChanges();

    const opcoes = Array.from(tela.querySelectorAll<HTMLOptionElement>('dialog select option')).map((o) => o.value);
    expect(opcoes, 'interesse legítimo é só do art. 7º: o dado sensível não o admite').not.toContain('SENSIVEL');
    expect(opcoes).toContain('INTERNO');
  });

  it('a recusa da recomendação fica no diálogo, com a mensagem da API, e a lista não é relida', async () => {
    const tela = await carregar([laudo]);
    botao(tela, 'Negar Laudo médico complementar')?.click();
    component['recomendada'].setValue('PUBLICO');
    component['negar']();

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(
        ...recusa(
          422,
          'uniplus.configuracao.protecao_do_catalogo.recomendacao_incompativel_com_a_hipotese_legal',
          'A base legal do item não cabe na classificação recomendada',
        ),
      );
    await assentar();

    expect(component['negativaAberta']()).toBe(true);
    expect(component['erroDaNegativa']()).toBe('A base legal do item não cabe na classificação recomendada');
  });

  it('quando a proteção mudou, não repete a decisão: relê a lista e avisa para decidir de novo', async () => {
    const tela = await carregar([laudo]);
    botao(tela, 'Aprovar Laudo médico complementar')?.click();

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(
        ...recusa(
          409,
          'uniplus.configuracao.protecao_do_catalogo.protecao_mudou',
          'A proteção do item mudou depois de conferida',
        ),
      );
    await assentar();

    const editado = { ...laudo, classificacaoProtecao: 'SENSIVEL', hipoteseLegal: 'TUTELA_DA_SAUDE' };
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([editado]);
    await assentar();

    expect(tela.textContent).toContain('A proteção do item mudou depois de conferida');
    expect(tela.textContent).toContain('decida de novo');
    expect(tela.textContent).toContain('Pessoal sensível');
    controller.expectNone((r) => r.method === 'POST');
  });

  it('item que já saiu da solicitação (decidido por outra pessoa) relê a lista em vez de manter os botões', async () => {
    const tela = await carregar([laudo]);
    botao(tela, 'Aprovar Laudo médico complementar')?.click();

    controller
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush(
        ...recusa(
          422,
          'uniplus.configuracao.protecao_do_catalogo.item_fora_de_solicitacao',
          'O item não está numa solicitação da proteção de dados',
        ),
      );
    await assentar();

    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    await assentar();
    expect(botao(tela, 'Aprovar Laudo médico complementar')).toBeNull();
  });

  it('a mesma decisão repetida depois de erro do servidor reusa a chave; a recusa 4xx troca a chave', async () => {
    const tela = await carregar([laudo]);
    const falha = (status: number) =>
      [JSON.stringify({ status, title: 'Falha' }), { status, statusText: 'Falha', headers: { 'content-type': 'application/problem+json' } }] as const;
    const postar = () => {
      botao(tela, 'Aprovar Laudo médico complementar')?.click();
      return controller.expectOne((r) => r.method === 'POST' && r.url === URL);
    };

    const primeira = postar();
    const chave = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(...falha(503));
    await assentar();

    const segunda = postar();
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda.flush(...falha(422));
    await assentar();

    const terceira = postar();
    expect(terceira.request.headers.get('Idempotency-Key')).not.toBe(chave);
    terceira.flush(null, { status: 204, statusText: 'No Content' });
    await assentar();
    controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
  });

  it('sem a permissão de aprovar, não oferece Aprovar nem Negar', async () => {
    concedidas.set([]);
    const tela = await carregar([laudo]);

    expect(botao(tela, 'Aprovar Laudo médico complementar')).toBeNull();
    expect(botao(tela, 'Negar Laudo médico complementar')).toBeNull();
  });
});
