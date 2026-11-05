import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  LocalOfertaDto,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  let component: LocaisOfertaPage;
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
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

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
    component['abrirCadastro']();
    await propagate();
    const campi = expectLookup(`${BASE}/api/configuracao/campi`);
    campi.flush([]);

    // O valor pedido é o teto da API, não um número escolhido à toa: acima
    // dele a resposta é 422 e o select fica sem opção.
    expect(campi.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
  });

  it('cancela o lookup de campi anterior ao clicar "Tentar novamente" antes da resposta chegar', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();

    const primeira = expectLookup(`${BASE}/api/configuracao/campi`);

    fixture.debugElement.injector.get(LocaisOfertaStore).campi.recarregar();
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

    expect(fixture.debugElement.injector.get(LocaisOfertaStore).campi.opcoes()).toHaveLength(1);

    // Se a primeira ainda estivesse "viva", flush aqui explodiria (request já
    // consumido) ou reabriria uma disputa — confirma que não sobra nada pendente.
    controller.verify();
  });

  it('renderiza a lista com tipo e cidade', async () => {
    await flushLista([localSeed]);
    expect(fixture.debugElement.injector.get(LocaisOfertaStore).locais()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Polo EAD');
    expect(fixture.nativeElement.textContent).toContain('Marabá — PA');
  });

  it('navega pelo cursor e volta à primeira página ao recarregar', async () => {
    const store = fixture.debugElement.injector.get(LocaisOfertaStore);
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

    component['abrirCadastro']();
    await flushCampiLookup();
    component['edicao'].form.setValue({
      tipo: TipoLocalOferta.poloEad,
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: enderecoResolvido,
    });

    component['edicao'].salvar();

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
    expect(component['edicao'].formOpen()).toBe(false);
  });

  it('bloqueia ações durante a gravação e a recarga, liberando após receber a lista', async () => {
    await flushLista([localSeed]);
    component['abrirEdicao'](localSeed);
    await flushCampiLookup();
    const edicao = component['edicao'];
    edicao.form.controls.endereco.setValue(enderecoResolvido);
    edicao.salvar();
    const escrita = controller.expectOne((r) => r.method === 'PUT');
    edicao.fechar();
    edicao.pedirRemocao(localSeed);
    edicao.salvar();
    expect(edicao.formOpen()).toBe(true);
    expect(edicao.confirmOpen()).toBe(false);
    escrita.flush(null);
    await propagate();
    expect(edicao.gravando()).toBe(true);
    component['abrirCadastro']();
    expect(edicao.formOpen()).toBe(false);
    await flushLista([localSeed]);
    expect(edicao.gravando()).toBe(false);
    component['abrirCadastro']();
    expect(edicao.formOpen()).toBe(true);
  });

  it('mantém ações indisponíveis e anuncia o salvamento dentro do drawer', async () => {
    await flushLista([localSeed]);
    component['abrirEdicao'](localSeed);
    await flushCampiLookup();
    const edicao = component['edicao'];
    edicao.form.controls.endereco.setValue(enderecoResolvido);
    edicao.salvar();
    const escrita = controller.expectOne((r) => r.method === 'PUT');
    await propagate();
    const host = fixture.nativeElement as HTMLElement;
    const acao = host.querySelector<HTMLButtonElement>(
      'cfg-locais-oferta-lista button[aria-label^="Remover"]',
    );
    expect(acao?.getAttribute('aria-disabled')).toBe('true');
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
    component['abrirCadastro']();
    await flushCampiLookup();
    const edicao = component['edicao'];
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
    edicao.salvar();
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
    botaoRecarregar.click();
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
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert--warning')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('td[data-label="Campus responsável"]').textContent,
    ).toContain('MAB — Campus de Marabá');
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
    component['abrirCadastro']();
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

    expect(fixture.debugElement.injector.get(LocaisOfertaStore).campi.opcoes()).toHaveLength(2);
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
    component['abrirCadastro']();
    await flushCampiLookup();
    // sem tipo nem cidade
    component['edicao'].salvar();
    controller.expectNone(`${BASE}/api/configuracao/admin/locais-oferta`);
    expect(component['edicao'].enderecoErro()).toContain('cidade');
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
});
