import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { EdicaoDasModalidades } from './edicao-das-modalidades';
import { ModalidadesListPage } from './modalidades-list.page';
import { ModalidadesStore } from './modalidades.store';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/modalidades`;
const URL_CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;

function modalidade(over: Partial<ModalidadeDto>): ModalidadeDto {
  return {
    id: over.id ?? crypto.randomUUID(),
    codigo: 'AC',
    legalFixa: true,
    descricao: 'Ampla concorrência',
    naturezaLegal: 'AMPLA',
    composicaoVagas: 'RESIDUAL_DO_VO',
    composicaoOrigem: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
    regraDeAplicabilidade: [],
    acaoQuandoIndeferido: null,
    baseLegal: null,
    criadoEm: '2026-07-03T12:00:00Z',
    ...over,
  };
}

const AC = modalidade({ id: 'id-ac', codigo: 'AC' });
// V retira suas vagas de AC e remaneja para AC (referencia AC como origem e destino).
const V = modalidade({
  id: 'id-v',
  codigo: 'V',
  legalFixa: false,
  descricao: 'PcD ampla concorrência',
  naturezaLegal: 'ACAO_AFIRMATIVA',
  composicaoVagas: 'RETIRA_DE',
  composicaoOrigem: 'AC',
  regraRemanejamento: 'DESTINO_UNICO',
  remanejamentoDestino: 'AC',
  regraDeAplicabilidade: [
    [
      { fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: true },
      { fato: 'COR_RACA', operador: 'EM', valor: ['PRETA', 'INDIGENA'] },
    ],
    [{ fato: 'COR_RACA', operador: 'IGUAL', valor: 'PARDA' }],
  ],
});

describe('ModalidadesListPage', () => {
  let fixture: ComponentFixture<ModalidadesListPage>;
  let component: ModalidadesListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModalidadesListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'modalidades', children: [] }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ModalidadesListPage);
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

  async function flushLista(itens: readonly ModalidadeDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush(itens);
    for (const catalogo of controller.match(URL_CATALOGO)) catalogo.flush(CATALOGO);
    await propagate();
  }

  it('CA-01: renderiza código e natureza', async () => {
    await flushLista([AC, V]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(component['modalidadesFiltradas']()).toHaveLength(2);
    expect(texto).toContain('AC');
    expect(texto).toContain('Ampla concorrência');
  });

  it('mostra a composição com a origem sem repetir a preposição do rótulo', async () => {
    await flushLista([AC, V]);
    fixture.detectChanges();

    const composicao = (codigo: string) =>
      (
        fixture.nativeElement.querySelector(
          `tr[data-codigo="${codigo}"] td[data-label="Composição de vagas"]`,
        ) as HTMLElement
      ).textContent
        ?.replace(/\s+/g, ' ')
        .trim();
    expect(composicao('V')).toBe('Retira de AC');
    expect(composicao('AC')).toBe('Residual do VO');
  });

  it('resume a regra de aplicabilidade pelos nomes do catálogo, e a regra sem condição como todos', async () => {
    await flushLista([AC, V]);
    fixture.detectChanges();

    const quemConcorre = (codigo: string) =>
      (
        fixture.nativeElement.querySelector(
          `tr[data-codigo="${codigo}"] td[data-label="Quem concorre"]`,
        ) as HTMLElement
      ).textContent?.trim();
    expect(quemConcorre('AC')).toBe('Todos os candidatos');
    expect(quemConcorre('V')).toBe(
      'Cursou o ensino médio em escola pública é sim e Cor/raça é um de Preta, Indígena; ou Cor/raça é Parda',
    );
  });

  it('CA-01: chips de natureza contam por token e filtram client-side', async () => {
    await flushLista([AC, V]);
    const chips = component['chipsNatureza']();
    expect(chips.find((c) => c.value === 'AMPLA')?.count).toBe(1);
    expect(chips.find((c) => c.value === 'ACAO_AFIRMATIVA')?.count).toBe(1);

    component['naturezaSelecionada'].set('ACAO_AFIRMATIVA');
    expect(component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual(['V']);
  });

  it('CA-01: busca casa código e descrição', async () => {
    await flushLista([AC, V]);
    component['busca'].set('pcd');
    expect(component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual(['V']);
  });

  it('CA-01: mapa reverso lista quem referencia a modalidade (AC referenciada por V)', async () => {
    await flushLista([AC, V]);
    expect(component['referenciadaPor']('AC').map((m) => m.codigo)).toEqual(['V']);
    expect(component['referenciadaPor']('V')).toEqual([]);
  });

  it('CA-04/CA-06: botão e diálogo falam em remover, não em inativar', async () => {
    await flushLista([AC, V]);
    fixture.detectChanges();
    const botao = fixture.nativeElement.querySelector(
      'button[aria-label="Remover modalidade V"]',
    ) as HTMLButtonElement | null;
    expect(botao?.getAttribute('data-tooltip')).toBe('Remover modalidade');

    component['pedirRemocao'](V);
    fixture.detectChanges();
    const dialogo = (
      Array.from(fixture.nativeElement.querySelectorAll('dialog')) as HTMLElement[]
    ).find((d) => d.textContent?.includes('soft-delete')) as HTMLElement;
    expect(dialogo.textContent).toContain('Remover modalidade');
    expect(dialogo.textContent).toContain('é removida (soft-delete)');
    expect(dialogo.textContent).not.toMatch(/inativ/i);
  });

  it('ModalidadeRemocaoDialog_BloqueiaQuandoReferenciada: sem DELETE quando há dependente', async () => {
    await flushLista([AC, V]);
    component['pedirRemocao'](AC);
    expect(component['remocaoBloqueada']()).toBe(true);
    component['removerConfirmado']();
    controller.expectNone(`${BASE}/api/configuracao/admin/modalidades/${AC.id}`);
  });

  it('ModalidadeRemocaoDialog_SoftDeleteQuandoLivre: DELETE e recarrega', async () => {
    await flushLista([AC, V]);
    component['pedirRemocao'](V);
    expect(component['remocaoBloqueada']()).toBe(false);
    component['removerConfirmado']();
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    expect(component['removendo']()).toBe(true);
    component['removerConfirmado']();
    controller.expectNone(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    expect(component['dialogAberto']()).toBe(false);
    expect(component['removendo']()).toBe(true);
    await flushLista([AC]);
    expect(component['removendo']()).toBe(false);
  });

  it('ModalidadeRemocaoDialog_409Servidor: 409 mantém bloqueio autoritativo', async () => {
    await flushLista([AC, V]);
    component['pedirRemocao'](V);
    component['removerConfirmado']();
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    req.flush(
      {
        type: 'about:blank',
        title: 'Conflito',
        status: 409,
        code: 'Modalidade.RemocaoBloqueadaPorReferencia',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await propagate();
    expect(component['bloqueioServidor']()).toBe(true);
    expect(component['remocaoBloqueada']()).toBe(true);
    // A mensagem do servidor é capturada para exibição quando o referente não está na página.
    expect(component['mensagemBloqueioServidor']()).toBeTruthy();
    await flushLista([AC, V]);
  });

  it('titula o bloqueio por referência com o título de referência', async () => {
    await flushLista([AC, V]);
    component['pedirRemocao'](V);
    component['removerConfirmado']();
    controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Referenciada',
        status: 409,
        code: 'uniplus.configuracao.modalidade.remocao_bloqueada_por_referencia',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('dialog ui-alert[variant="warning"]')?.textContent,
    ).toContain('Modalidade referenciada por outra viva');
    await flushLista([AC, V]);
  });

  it('titula com o genérico o 409 que não é de referência', async () => {
    const livre = modalidade({ id: 'id-livre', codigo: 'LIVRE', descricao: 'Sem referência' });
    await flushLista([livre]);
    component['pedirRemocao'](livre);
    component['removerConfirmado']();
    controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${livre.id}`).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'A modalidade legal fixa não pode ser removida',
        status: 409,
        code: 'uniplus.configuracao.modalidade.remocao_bloqueada_codigo_protegido',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('dialog ui-alert[variant="warning"]')?.textContent,
    ).toContain('Não é possível remover');
    await flushLista([livre]);
  });

  it('mostra uma só vez a mensagem do 409 quando a referência está fora da página', async () => {
    const livre = modalidade({ id: 'id-livre', codigo: 'LIVRE', descricao: 'Sem referência' });
    await flushLista([livre]);
    component['pedirRemocao'](livre);
    component['removerConfirmado']();
    controller
      .expectOne(`${BASE}/api/configuracao/admin/modalidades/${livre.id}`)
      .flush(
        { type: 'about:blank', title: 'Conflito', status: 409, code: 'erro.conflito.remocao' },
        { status: 409, statusText: 'Conflict' },
      );
    await propagate();
    fixture.detectChanges();

    const mensagem = component['mensagemBloqueioServidor']() ?? '';
    const alertas = Array.from(
      fixture.nativeElement.querySelectorAll('dialog ui-alert'),
    ) as HTMLElement[];
    const ocorrencias = alertas.filter((alerta) => alerta.textContent?.includes(mensagem));
    expect(mensagem).not.toBe('');
    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0].textContent?.split(mensagem)).toHaveLength(2);
    await flushLista([livre]);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([AC, V]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Modalidades de concorrência, com quem concorre em cada uma, natureza, composição de vagas, remanejamento e modalidades que a referenciam',
    );
  });

  it('CA-13/CA-14: a tabela não tem a coluna Status e preserva as demais', async () => {
    await flushLista([AC, V]);
    fixture.detectChanges();
    const cabecalhos = Array.from(
      fixture.nativeElement.querySelectorAll('thead th') as NodeListOf<HTMLElement>,
    ).map((th) => th.textContent?.trim());
    expect(cabecalhos).toEqual([
      'Código',
      'Quem concorre',
      'Natureza',
      'Composição de vagas',
      'Remanejamento',
      'Referenciada por',
      'Ações',
    ]);
  });

  describe('leitura e remoção com falha', () => {
    const problema = (status: number): Record<string, unknown> => ({
      type: 'about:blank',
      title: 'Indisponível',
      status,
      code: 'erro',
    });
    const falhar = (req: ReturnType<HttpTestingController['expectOne']>, status: number): void =>
      req.flush(problema(status), { status, statusText: 'Falha' });

    it('navega entre páginas por cursor e volta à primeira ao recarregar', async () => {
      const store = fixture.debugElement.injector.get(ModalidadesStore);
      controller
        .expectOne((r) => r.url === URL)
        .flush([AC], { headers: { Link: `<${URL}?cursor=p2&direction=next>; rel="next"` } });
      controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
      await propagate();
      expect(store.proximo()).not.toBeNull();

      store.proximaPagina();
      await propagate();
      const segunda = controller.expectOne((r) => r.params.get('cursor') === 'p2');
      expect(segunda.request.params.get('direction')).toBe('next');
      segunda.flush([V], { headers: { Link: `<${URL}?cursor=p1&direction=prev>; rel="prev"` } });
      await propagate();
      expect(store.modalidades().map((m) => m.codigo)).toEqual(['V']);

      store.paginaAnterior();
      await propagate();
      const volta = controller.expectOne((r) => r.params.get('cursor') === 'p1');
      expect(volta.request.params.get('direction')).toBe('prev');
      volta.flush([AC]);
      await propagate();

      store.recarregar();
      await propagate();
      expect(
        controller.expectOne((r) => r.params.get('cursor') === null).request.params.get('limit'),
      ).toBe('100');
    });

    it('explica a falha da listagem e só tenta de novo quando não está carregando', async () => {
      const store = fixture.debugElement.injector.get(ModalidadesStore);
      falhar(
        controller.expectOne((r) => r.url === URL),
        503,
      );
      controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
      await propagate();
      expect(store.mensagemDeErro()).toBeTruthy();

      store.tentarNovamente();
      store.tentarNovamente();
      await propagate();
      controller.expectOne((r) => r.url === URL).flush([AC]);
      await propagate();
      expect(store.mensagemDeErro()).toBeNull();
    });

    it('explica que não conectou quando a listagem falha sem resposta do servidor', async () => {
      const store = fixture.debugElement.injector.get(ModalidadesStore);
      controller.expectOne((r) => r.url === URL).error(new ProgressEvent('error'));
      controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
      await propagate();
      expect(store.mensagemDeErro()).toBe('Não foi possível conectar ao servidor');
    });

    it('libera a remoção e informa quando o servidor falha sem ser conflito', async () => {
      await flushLista([V]);
      const edicao = fixture.debugElement.injector.get(EdicaoDasModalidades);
      edicao.remover(V);
      falhar(controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`), 500);
      await propagate();
      expect(edicao.removendo()).toBe(false);
      expect(edicao.mensagemBloqueioServidor()).toBeTruthy();
      expect(edicao.bloqueioServidor()).toBe(false);
    });

    it('anuncia quando a recarga depois da remoção falha', async () => {
      await flushLista([V]);
      const edicao = fixture.debugElement.injector.get(EdicaoDasModalidades);
      edicao.remover(V);
      controller
        .expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await propagate();
      falhar(
        controller.expectOne((r) => r.url === URL),
        503,
      );
      await propagate();
      expect(edicao.removendo()).toBe(false);
      expect(edicao.anuncio()).toBe('Não foi possível recarregar as modalidades.');
    });
  });
});
