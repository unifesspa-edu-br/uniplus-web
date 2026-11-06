import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  LocalOfertaDto,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaPage } from './locais-oferta.page';
import { LocaisOfertaStore } from './locais-oferta.store';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';

const BASE = 'http://localhost:5000';
// Teto de página aceito pela API (ADR-0026 do uniplus-api): `limit` fora da
// faixa 1..100 responde 422 `uniplus.cursor.limit_invalido`, e o lookup
// rejeitado deixa o select vazio e a listagem sem rótulo resolvido.
const LIMITE_MAXIMO_API = 100;

const localSeed: LocalOfertaDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  tipo: TipoLocalOferta.poloEad,
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const enderecoResolvido: EnderecoEstruturado = {
  cep: '68507590',
  logradouro: 'Folha 31',
  numero: null,
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  latitude: null,
  longitude: null,
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

describe('LocaisOfertaPage', () => {
  let fixture: ComponentFixture<LocaisOfertaPage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LocaisOfertaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(LocaisOfertaPage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const injetar = <T>(token: Type<T>): T => fixture.debugElement.injector.get(token);
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const achado = raiz().querySelector<T>(seletor);
    expect(achado, seletor).not.toBeNull();
    return achado as T;
  };
  const abrirCadastro = (): void =>
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
  const abrirEdicao = (): void =>
    elemento<HTMLButtonElement>('button[aria-label^="Editar local de oferta"]').click();
  const enviar = (): void => {
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
  };

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  // Casa a requisição de lookup exigindo `limit` dentro da faixa aceita pela
  // API. Comparar só `r.url` não basta: a query string não entra nele quando os
  // parâmetros vêm de `HttpParams`, então um limite inválido passaria batido.
  const expectLookup = (url: string): TestRequest => {
    const req = controller.expectOne((r) => r.url === url);
    const limit = Number(req.request.params.get('limit'));
    expect(limit).toBeGreaterThanOrEqual(1);
    expect(limit).toBeLessThanOrEqual(LIMITE_MAXIMO_API);
    return req;
  };

  async function flushLista(itens: readonly LocalOfertaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/locais-oferta`);
    req.flush(itens);
    await propagate();
  }

  async function flushCampiLookup(): Promise<void> {
    await propagate();
    expectLookup(`${BASE}/api/configuracao/campi`).flush([]);
    await propagate();
  }

  it('pede o máximo de uma página da API no lookup de campi responsáveis', async () => {
    await flushLista([]);
    abrirCadastro();
    await propagate();
    const campi = expectLookup(`${BASE}/api/configuracao/campi`);
    campi.flush([]);

    // O valor pedido é o teto da API, não um número escolhido à toa: acima
    // dele a resposta é 422 e o select fica sem opção.
    expect(campi.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
  });

  it('cancela o lookup de campi anterior ao clicar "Tentar novamente" antes da resposta chegar', async () => {
    await flushLista([]);
    abrirCadastro();
    await propagate();

    const primeira = expectLookup(`${BASE}/api/configuracao/campi`);

    injetar(LocaisOfertaStore).campi.recarregar();
    await propagate();

    // A primeira travessia precisa ter sido cancelada de verdade (não só
    // ignorada) — senão ela ainda pode ganhar a corrida se responder por
    // último, sobrescrevendo o resultado da segunda com dado obsoleto.
    expect(primeira.cancelled).toBe(true);

    const segunda = expectLookup(`${BASE}/api/configuracao/campi`);
    segunda.flush([
      {
        id: 'cmp1',
        sigla: 'MAB',
        nome: 'Campus de Marabá',
        codigoEmec: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        endereco: null,
        criadoEm: '2026-06-10T12:00:00Z',
      },
    ]);
    await propagate();

    expect(injetar(LocaisOfertaStore).campi.opcoes()).toHaveLength(1);

    // Se a primeira ainda estivesse "viva", flush aqui explodiria (request já
    // consumido) ou reabriria uma disputa — confirma que não sobra nada pendente.
    controller.verify();
  });

  it('renderiza a lista com tipo e cidade', async () => {
    await flushLista([localSeed]);
    expect(injetar(LocaisOfertaStore).locais()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Polo EAD');
    expect(fixture.nativeElement.textContent).toContain('Marabá — PA');
  });

  it('navega pelo cursor e volta à primeira página ao recarregar', async () => {
    const store = injetar(LocaisOfertaStore);
    const primeira = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/locais-oferta`,
    );
    expect(primeira.request.params.get('limit')).toBe('50');
    primeira.flush([localSeed], {
      headers: new HttpHeaders({
        Link: `<${BASE}/api/configuracao/locais-oferta?cursor=pagina-2&direction=next>; rel="next"`,
      }),
    });
    await propagate();
    store.proximaPagina();
    await propagate();
    const segunda = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/locais-oferta`);
    expect(segunda.request.params.get('cursor')).toBe('pagina-2');
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([]);
    await propagate();
    store.recarregar();
    await propagate();
    const recarga = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/locais-oferta`);
    expect(recarga.request.params.get('limit')).toBe('50');
    recarga.flush([localSeed]);
    await propagate();
  });

  it('CA-04: cria local de oferta com tipo + endereço aninhado', async () => {
    await flushLista([]);

    abrirCadastro();
    await flushCampiLookup();
    injetar(EdicaoDosLocaisOferta).form.setValue({
      tipo: TipoLocalOferta.poloEad,
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: enderecoResolvido,
    });

    enviar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/locais-oferta`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({
      tipo: 'poloEad',
      campusResponsavelId: null,
      cidadeCodigoIbge: '1504208',
      endereco: { cep: '68507590' },
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([localSeed]);
    expect(injetar(EdicaoDosLocaisOferta).formOpen()).toBe(false);
  });

  it('bloqueia ações durante a gravação e a recarga, liberando após receber a lista', async () => {
    await flushLista([localSeed]);
    abrirEdicao();
    await flushCampiLookup();
    const edicao = injetar(EdicaoDosLocaisOferta);
    edicao.form.controls.endereco.setValue(enderecoResolvido);
    enviar();
    const escrita = controller.expectOne((r) => r.method === 'PUT');
    edicao.fechar();
    edicao.pedirRemocao(localSeed);
    edicao.salvar();
    expect(edicao.formOpen()).toBe(true);
    expect(edicao.confirmOpen()).toBe(false);
    escrita.flush(null);
    await propagate();
    expect(edicao.gravando()).toBe(true);
    abrirCadastro();
    expect(edicao.formOpen()).toBe(false);
    await flushLista([localSeed]);
    expect(edicao.gravando()).toBe(false);
    abrirCadastro();
    expect(edicao.formOpen()).toBe(true);
  });

  it('mantém ações indisponíveis e anuncia o salvamento dentro do drawer', async () => {
    await flushLista([localSeed]);
    abrirEdicao();
    await flushCampiLookup();
    const edicao = injetar(EdicaoDosLocaisOferta);
    edicao.form.controls.endereco.setValue(enderecoResolvido);
    enviar();
    const escrita = controller.expectOne((r) => r.method === 'PUT');
    await propagate();
    const host = fixture.nativeElement as HTMLElement;
    const acao = host.querySelector<HTMLButtonElement>(
      'cfg-locais-oferta-lista button[aria-label^="Remover"]',
    );
    expect(acao?.disabled).toBe(true);
    expect(
      host.querySelector('cfg-local-oferta-formulario dialog p[role="status"]')?.textContent,
    ).toContain('Salvando');
    expect(
      host.querySelector('cfg-locais-oferta-lista td span[aria-hidden="true"]')?.textContent,
    ).toContain('Salvando');
    acao?.click();
    expect(edicao.confirmOpen()).toBe(false);
    escrita.flush(null);
    await propagate();
    await flushLista([localSeed]);
  });

  it('marca o campo recusado pelo servidor e leva o foco até ele', async () => {
    await flushLista([]);
    abrirCadastro();
    await flushCampiLookup();
    const edicao = injetar(EdicaoDosLocaisOferta);
    edicao.form.setValue({
      tipo: TipoLocalOferta.poloEad,
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: enderecoResolvido,
    });
    const campo = fixture.nativeElement.querySelector(
      'input[formcontrolname="codigoEmec"]',
    ) as HTMLInputElement;
    const foco = vi.spyOn(campo, 'focus');
    enviar();
    await propagate();
    controller.expectOne(`${BASE}/api/configuracao/admin/locais-oferta`).flush(
      JSON.stringify({
        type: 'about:blank',
        code: 'uniplus.validacao',
        status: 422,
        title: 'Recusado',
        errors: [
          {
            field: 'codigoEmec',
            code: 'uniplus.configuracao.local.codigo_invalido',
            message: 'Código inválido.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    expect(campo.closest('label')?.textContent).toContain('Código inválido.');
    expect(foco).toHaveBeenCalled();
  });

  it('I1: lista com local vinculado dispara o lookup de campi e exibe a sigla/nome', async () => {
    const localVinculado: LocalOfertaDto = { ...localSeed, campusResponsavelId: 'cmp1' };
    await flushLista([localVinculado]);
    await propagate();
    expectLookup(`${BASE}/api/configuracao/campi`).flush([
      {
        id: 'cmp1',
        sigla: 'MAB',
        nome: 'Campus de Marabá',
        codigoEmec: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        endereco: null,
        criadoEm: '2026-06-10T12:00:00Z',
      },
    ]);
    await propagate();
    expect(
      fixture.debugElement.injector
        .get(LocaisOfertaStore)
        .campi.opcoes()
        .map((campus) => `${campus.sigla} — ${campus.nome}`)[0],
    ).toBe('MAB — Campus de Marabá');
  });

  // A coluna resolvia o campus por lookup e, quando a busca falhava, trocava o
  // rótulo por "Vinculado" — texto de aparência normal que escondia a falha
  // Cada desfecho agora tem marcador próprio.
  it('lookup de campi recusado sinaliza a coluna e oferece recarregar', async () => {
    const localVinculado: LocalOfertaDto = { ...localSeed, campusResponsavelId: 'cmp1' };
    await flushLista([localVinculado]);
    await propagate();
    expectLookup(`${BASE}/api/configuracao/campi`).flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );
    await propagate();
    fixture.detectChanges();

    const celula: HTMLElement = fixture.nativeElement.querySelector(
      'td[data-label="Campus responsável"]',
    );
    expect(celula.querySelector('.lookup-label--failed')?.textContent?.trim()).toBe(
      'Não carregado',
    );

    const alerta: HTMLElement = fixture.nativeElement.querySelector('.alert--warning');
    expect(alerta.textContent).toContain('Recarregar campi');

    const botaoRecarregar: HTMLButtonElement =
      fixture.nativeElement.querySelector('.alert--warning button');
    botaoRecarregar.focus();
    botaoRecarregar.click();
    await propagate();
    fixture.detectChanges();
    expect(botaoRecarregar.isConnected).toBe(true);
    expect(botaoRecarregar.getAttribute('aria-disabled')).toBe('true');
    expect(botaoRecarregar.disabled).toBe(false);
    expect(document.activeElement).toBe(botaoRecarregar);
    expectLookup(`${BASE}/api/configuracao/campi`).flush([
      {
        id: 'cmp1',
        sigla: 'MAB',
        nome: 'Campus de Marabá',
        codigoEmec: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        endereco: null,
        criadoEm: '2026-06-10T12:00:00Z',
      },
    ]);
    await propagate();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert--warning')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('td[data-label="Campus responsável"]').textContent,
    ).toContain('MAB — Campus de Marabá');
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#cfg-locais-list-title'),
    );
  });

  describe('"Recarregar campi" da lista com a lista ocupada', () => {
    const CAMPI = `${BASE}/api/configuracao/campi`;
    const recarregarCampi = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('ui-lookup-alert button');

    async function comCampiEmFalha(): Promise<void> {
      await flushLista([{ ...localSeed, campusResponsavelId: 'cmp1' }]);
      await propagate();
      expectLookup(CAMPI).flush({}, { status: 500, statusText: 'Server Error' });
      await propagate();
      fixture.detectChanges();
    }

    it('com a gravação e a recarga pendentes, fica indisponível e não pede os campi', async () => {
      await comCampiEmFalha();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBeNull();
      const edicao = injetar(EdicaoDosLocaisOferta);

      edicao.pedirRemocao(localSeed);
      edicao.removerConfirmado();
      await propagate();
      fixture.detectChanges();
      expect(edicao.gravando()).toBe(true);
      expect(recarregarCampi().getAttribute('aria-disabled')).toBe('true');
      recarregarCampi().click();
      controller.expectNone((r) => r.url === CAMPI);

      controller.expectOne((r) => r.method === 'DELETE').flush(null);
      await propagate();
      fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBe('true');
      recarregarCampi().click();
      controller.expectNone((r) => r.url === CAMPI);

      await flushLista([localSeed]);
      fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBeNull();
    });

    it('com a lista em carga, fica indisponível e não pede os campi', async () => {
      await comCampiEmFalha();

      injetar(LocaisOfertaStore).tentarNovamente();
      await propagate();
      fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBe('true');
      recarregarCampi().click();
      controller.expectNone((r) => r.url === CAMPI);

      await flushLista([localSeed]);
      fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBeNull();
    });

    it('anuncia, fora do drawer, a nova tentativa acionada na lista, também a segunda falha seguida', async () => {
      await comCampiEmFalha();
      const anuncio = (): string =>
        fixture.nativeElement.querySelector(
          ':scope > p.sr-only[role="status"] + p.sr-only[role="status"]',
        )?.textContent ?? '';

      for (let vez = 0; vez < 2; vez++) {
        recarregarCampi().click();
        await propagate();
        expect(anuncio()).toBe('Lendo campi...');
        expectLookup(CAMPI).flush({}, { status: 500, statusText: 'Server Error' });
        await propagate();
        expect(anuncio()).toBe('Falha na leitura: campi.');
      }
    });
  });

  it('campus fora do catálogo carregado é "não identificado", não "não carregado"', async () => {
    const localVinculado: LocalOfertaDto = { ...localSeed, campusResponsavelId: 'cmp-removido' };
    await flushLista([localVinculado]);
    await propagate();
    // Catálogo íntegro, sem o id da linha: o vínculo é que está quebrado —
    // esperar ou tentar de novo não resolve, e o marcador precisa dizer isso.
    expectLookup(`${BASE}/api/configuracao/campi`).flush([]);
    await propagate();
    fixture.detectChanges();

    const celula: HTMLElement = fixture.nativeElement.querySelector(
      'td[data-label="Campus responsável"]',
    );
    expect(celula.querySelector('.lookup-label--missing')?.textContent?.trim()).toBe(
      'Não identificado',
    );
    expect(fixture.nativeElement.querySelector('.alert--warning')).toBeNull();
  });

  it('local sem campus responsável mostra o traço, não marcador de lookup', async () => {
    await flushLista([{ ...localSeed, campusResponsavelId: null }]);
    await propagate();
    fixture.detectChanges();

    const celula: HTMLElement = fixture.nativeElement.querySelector(
      'td[data-label="Campus responsável"]',
    );
    expect(celula.textContent?.trim()).toBe('—');
    expect(celula.querySelector('.lookup-label')).toBeNull();
  });

  it('percorre todas as páginas do lookup de campi sem truncar', async () => {
    await flushLista([]);
    abrirCadastro();
    await propagate();

    const pagina1 = expectLookup(`${BASE}/api/configuracao/campi`);
    pagina1.flush(
      [
        {
          id: 'cmp1',
          sigla: 'MAB',
          nome: 'Campus de Marabá',
          codigoEmec: null,
          cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
          endereco: null,
          criadoEm: '2026-06-10T12:00:00Z',
        },
      ],
      {
        headers: {
          Link: `<${BASE}/api/configuracao/campi?cursor=pagina-2&direction=next>; rel="next"`,
        },
      },
    );
    await propagate();

    // Segunda página vem só com o cursor — sem `limit`, por contrato do client
    // gerado — então não reaproveita `expectLookup` (que exige `limit`).
    const pagina2 = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/campi`);
    expect(pagina2.request.params.get('cursor')).toBe('pagina-2');
    expect(pagina2.request.params.get('direction')).toBe('next');
    pagina2.flush([
      {
        id: 'cmp2',
        sigla: 'XIN',
        nome: 'Campus de Xinguara',
        codigoEmec: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        endereco: null,
        criadoEm: '2026-06-10T12:00:00Z',
      },
    ]);
    await propagate();

    expect(injetar(LocaisOfertaStore).campi.opcoes()).toHaveLength(2);
    expect(
      fixture.debugElement.injector
        .get(LocaisOfertaStore)
        .campi.opcoes()
        .map((campus) => `${campus.sigla} — ${campus.nome}`)[0],
    ).toBe('MAB — Campus de Marabá');
    expect(
      fixture.debugElement.injector
        .get(LocaisOfertaStore)
        .campi.opcoes()
        .map((campus) => `${campus.sigla} — ${campus.nome}`)[1],
    ).toBe('XIN — Campus de Xinguara');
  });

  it('exige tipo e cidade — bloqueia salvar inválido', async () => {
    await flushLista([]);
    abrirCadastro();
    await flushCampiLookup();
    // sem tipo nem cidade
    enviar();
    controller.expectNone(`${BASE}/api/configuracao/admin/locais-oferta`);
    expect(injetar(EdicaoDosLocaisOferta).enderecoErro()).toContain('cidade');
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([localSeed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    // Sem `sr-only` a legenda vira texto visível acima da tabela e quebra o layout.
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Locais de oferta, com tipo, cidade, campus responsável e código e-MEC',
    );
  });

  it('volta à página anterior pelo cursor que a API devolveu', async () => {
    const store = injetar(LocaisOfertaStore);
    const url = `${BASE}/api/configuracao/locais-oferta`;
    controller
      .expectOne((r) => r.url === url)
      .flush([localSeed], {
        headers: new HttpHeaders({ Link: `<${url}?cursor=p2&direction=next>; rel="next"` }),
      });
    await propagate();
    store.proximaPagina();
    await propagate();
    controller
      .expectOne((r) => r.url === url)
      .flush([localSeed], {
        headers: new HttpHeaders({ Link: `<${url}?cursor=p1&direction=prev>; rel="prev"` }),
      });
    await propagate();
    store.paginaAnterior();
    await propagate();
    const anterior = controller.expectOne((r) => r.url === url);
    expect(anterior.request.params.get('cursor')).toBe('p1');
    expect(anterior.request.params.get('direction')).toBe('prev');
    anterior.flush([localSeed]);
    await propagate();
  });

  it('notifica a falha do servidor na listagem e mostra o alerta com a mensagem', async () => {
    const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/locais-oferta`)
      .flush(
        JSON.stringify({ type: 'about:blank', title: 'Erro interno', status: 500, code: 'x' }),
        {
          status: 500,
          statusText: 'Server Error',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagate();
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('ui-alert')?.textContent).toContain(
      injetar(LocaisOfertaStore).mensagemDeErro(),
    );
  });

  it('"Tentar novamente" que dá certo leva o foco, que estava no botão, ao título da lista', async () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/locais-oferta`)
      .flush(JSON.stringify({ type: 'about:blank', title: 'Falha', status: 400, code: 'x' }), {
        status: 400,
        statusText: 'Bad',
        headers: { 'content-type': 'application/problem+json' },
      });
    await propagate();
    const tentar = elemento<HTMLButtonElement>('.cfg-locais__retry button');
    tentar.focus();
    tentar.click();
    await propagate();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    await flushLista([localSeed]);
    await propagate();
    expect(raiz().querySelector('.cfg-locais__retry')).toBeNull();
    expect(document.activeElement).toBe(elemento('#cfg-locais-list-title'));
  });

  it('ignora "Tentar novamente" enquanto a listagem ainda carrega', () => {
    const store = injetar(LocaisOfertaStore);
    store.tentarNovamente();
    const pendentes = controller.match((r) => r.url === `${BASE}/api/configuracao/locais-oferta`);
    expect(pendentes).toHaveLength(1);
  });

  it('não abre a edição com uma gravação em curso', async () => {
    await flushLista([localSeed]);
    abrirEdicao();
    await flushCampiLookup();
    const edicao = injetar(EdicaoDosLocaisOferta);
    edicao.form.controls.endereco.setValue(enderecoResolvido);
    enviar();
    const escrita = controller.expectOne((r) => r.method === 'PUT');
    const iniciarCampi = vi.spyOn(injetar(LocaisOfertaStore), 'iniciarCampi');
    edicao.fechar();
    abrirEdicao();
    expect(iniciarCampi).not.toHaveBeenCalled();
    expect(edicao.localEmEdicaoId()).toBe(localSeed.id);
    escrita.flush(null);
    await propagate();
    await flushLista([localSeed]);
  });
});
