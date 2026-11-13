import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type CadastroDoCatalogo,
  type ManifestacaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HistoricoDasManifestacoesComponent,
  type OrigemDoHistoricoDasManifestacoes,
} from './historico-das-manifestacoes.component';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000d2';
const ADMIN = `${BASE}/api/configuracao/admin`;

const manifestacao = (extra: Partial<ManifestacaoDaProtecaoDto>): ManifestacaoDaProtecaoDto => ({
  id: 'm1',
  ciclo: 2,
  parecer: 'INADEQUADA',
  texto: 'O laudo identifica o candidato; a classificação interna não basta.',
  autorNome: 'Isabella Figueiredo',
  instante: '2026-11-02T14:00:00Z',
  substituiId: null,
  situacao: 'VIGENTE',
  ...extra,
});

const problema = (status: number, code: string, title: string) =>
  [
    JSON.stringify({ status, code, title, type: 'about:blank', traceId: 't' }),
    {
      status,
      statusText: title,
      headers: { 'content-type': 'application/problem+json' },
    },
  ] as const;

describe('HistoricoDasManifestacoesComponent', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function montar(
    cadastro: CadastroDoCatalogo,
    origem?: OrigemDoHistoricoDasManifestacoes,
  ): ComponentFixture<HistoricoDasManifestacoesComponent> {
    const fixture = TestBed.createComponent(HistoricoDasManifestacoesComponent);
    fixture.componentRef.setInput('cadastro', cadastro);
    fixture.componentRef.setInput('id', ID);
    if (origem) fixture.componentRef.setInput('origem', origem);
    fixture.detectChanges();
    return fixture;
  }

  async function assentar(fixture: ComponentFixture<unknown>): Promise<HTMLElement> {
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texto = (tela: HTMLElement): string => tela.textContent?.replace(/\s+/g, ' ') ?? '';

  it.each([
    ['TIPO_DOCUMENTO', `${ADMIN}/tipos-documento/${ID}/protecao/manifestacoes`],
    ['FATO', `${ADMIN}/fatos-candidato/${ID}/protecao/manifestacoes`],
  ] as const)(
    'na tela de cadastro (%s), lê da rota do cadastro com o media type do histórico',
    async (cadastro, url) => {
      const fixture = montar(cadastro, 'cadastro');
      const req = controller.expectOne(url);
      expect(req.request.headers.get('Accept')).toBe(
        buildVendorMimeAccept('protecao-do-catalogo-manifestacao', 1),
      );
      req.flush([]);
      expect(texto(await assentar(fixture))).toContain(
        'O item ainda não recebeu manifestação técnica.',
      );
    },
  );

  it('na fila da proteção de dados, lê da rota da fila', () => {
    montar('FATO');
    controller.expectOne(`${ADMIN}/protecao-do-catalogo/fatos/${ID}/manifestacoes`).flush([]);
  });

  it('mostra parecer, texto, autor, instante e situação, sem nenhuma ação', async () => {
    const fixture = montar('TIPO_DOCUMENTO', 'cadastro');
    controller
      .expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/manifestacoes`)
      .flush([manifestacao({}), manifestacao({ id: 'm0', ciclo: 1, situacao: 'ENCERRADA' })]);
    const tela = await assentar(fixture);

    const lido = texto(tela);
    expect(lido).toContain('Inadequada');
    expect(lido).toContain('O laudo identifica o candidato');
    expect(lido).toContain('Isabella Figueiredo');
    expect(lido).toContain('02/11/2026');
    expect(lido).toContain('Vigente');
    expect(lido).toContain('De ciclo encerrado');
    expect(tela.querySelectorAll('button, input, textarea, select')).toHaveLength(0);
  });

  it('com o registro de acesso fora do ar (503), mostra a falha sem dado e tenta de novo', async () => {
    const fixture = montar('FATO', 'cadastro');
    const url = `${ADMIN}/fatos-candidato/${ID}/protecao/manifestacoes`;
    controller
      .expectOne(url)
      .flush(
        ...problema(
          503,
          'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar',
          'Registro de acesso indisponível',
        ),
      );
    const tela = await assentar(fixture);

    expect(texto(tela)).toContain('Não foi possível carregar as manifestações');
    expect(tela.querySelector('[aria-label="Histórico das manifestações técnicas"]')).toBeNull();
    const tentar = Array.from(tela.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    expect(tentar, 'o botão Tentar novamente').toBeDefined();
    tentar?.click();
    fixture.detectChanges();
    controller.expectOne(url).flush([manifestacao({})]);
    expect(texto(await assentar(fixture))).toContain('Isabella Figueiredo');
  });

  it.each([
    [403, 'Acesso negado'],
    [404, 'Item não encontrado'],
  ])('a recusa %i não oferece nova tentativa nem mostra dado', async (status, titulo) => {
    const fixture = montar('TIPO_DOCUMENTO', 'cadastro');
    controller
      .expectOne(`${ADMIN}/tipos-documento/${ID}/protecao/manifestacoes`)
      .flush(...problema(status, 'uniplus.recusa', 'Recusa'));
    const tela = await assentar(fixture);

    expect(texto(tela)).toContain(titulo);
    expect(texto(tela)).not.toContain('Tentar novamente');
    expect(tela.querySelector('[aria-label="Histórico das manifestações técnicas"]')).toBeNull();
  });
});
