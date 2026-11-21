import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposBancaPage } from './tipos-banca.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/tipos-banca`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
const ESCRITA = `${BASE}/api/configuracao/admin/tipos-banca/b2`;
const banca: TipoBancaDto = {
  id: 'b2',
  codigo: {
    codigo: 'BANCA_ENTREVISTA' as TipoBancaDto['codigo']['codigo'],
    rotulo: 'BANCA_ENTREVISTA',
  },
  nome: 'Banca de Entrevista',
  faseTipica: null,
  descricao: null,
  papel: {
    codigo: 'AVALIA_O_MERITO' as TipoBancaDto['papel']['codigo'],
    rotulo: 'Avalia o mérito',
  },
  exigeDuasOuMaisBancas: false,
  encerraRecursoNaPrimeiraInstancia: false,
  tiposDeDecisaoJulgados: [],
  criadoEm: '2026-06-10T12:00:00Z',
};

const problema = (status: number, corpo: object) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

describe('TiposBancaPage — recusas de papel e decisões', () => {
  let fixture: ComponentFixture<TiposBancaPage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TiposBancaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposBancaPage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === LISTA).flush([banca]);
    await propagar();
  });
  afterEach(() => {
    controller
      .match((r) => r.url.endsWith('/vocabularios/papeis-de-banca'))
      .forEach((r) => r.flush([]));
    controller
      .match((r) => r.url.endsWith('/vocabularios/tipos-de-decisao'))
      .forEach((r) => r.flush([]));
    controller.verify();
  });

  async function propagar(): Promise<void> {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  }
  function elemento<T extends HTMLElement>(seletor: string): T {
    const encontrado = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  }
  const editar = (): HTMLButtonElement =>
    elemento(`button[aria-label="Editar tipo de banca ${banca.codigo.rotulo}"]`);
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-tipo-banca-form"]');
  async function abrirEdicao(): Promise<void> {
    editar().focus();
    editar().click();
    await propagar();
    controller.expectOne((r) => r.url === FASES).flush([]);
    await propagar();
  }
  async function enviar() {
    salvar().focus();
    salvar().click();
    await propagar();
    return controller.expectOne(ESCRITA);
  }
  it.each([
    ['papel_obrigatorio', 'papel', '[formcontrolname="papel"]'],
    ['papel_fora_do_vocabulario', 'papel', '[formcontrolname="papel"]'],
    [
      'tipo_de_decisao_fora_do_vocabulario',
      'tiposDeDecisaoJulgados[0]',
      'fieldset[aria-describedby="cfg-tipos-erro"]',
    ],
    [
      'tipo_de_decisao_repetido',
      'tiposDeDecisaoJulgados[1]',
      'fieldset[aria-describedby="cfg-tipos-erro"]',
    ],
    [
      'tipos_de_decisao_incoerentes_com_o_papel',
      'tiposDeDecisaoJulgados',
      'fieldset[aria-describedby="cfg-tipos-erro"]',
    ],
  ])('mostra a recusa %s junto do campo', async (codigo, field, seletor) => {
    await abrirEdicao();
    (await enviar()).flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        detail: 'Detalhe enviado pela API.',
        errors: [
          {
            field,
            code: `uniplus.configuracao.tipo_banca.${codigo}`,
            message: 'Outra mensagem.',
          },
        ],
      }),
    );
    await propagar();
    expect(elemento(seletor).getAttribute('aria-invalid')).toBe('true');
    const descricao = elemento(seletor).getAttribute('aria-describedby');
    expect(descricao).toBeTruthy();
    expect(
      descricao
        ?.split(' ')
        .some((id) => elemento(`#${id}`).textContent?.includes('Outra mensagem.')),
    ).toBe(true);
  });

  function recusasDeNomeEPapel() {
    return problema(422, {
      code: 'uniplus.validacao',
      detail: 'Confira os dados.',
      errors: [
        { field: 'nome', code: 'nome_invalido', message: 'Nome recusado.' },
        { field: 'papel', code: 'papel_invalido', message: 'Papel recusado.' },
      ],
    });
  }

  it('mostra a mensagem própria de nome e papel quando ambos são recusados', async () => {
    await abrirEdicao();
    (await enviar()).flush(...recusasDeNomeEPapel());
    await propagar();
    expect(elemento('[formcontrolname="nome"]').closest('label')?.textContent).toContain(
      'Nome recusado.',
    );
    expect(elemento('#cfg-papel-erro').textContent).toContain('Papel recusado.');
  });

  it('usa o detalhe quando a recusa do campo não tem mensagem', async () => {
    await abrirEdicao();
    (await enviar()).flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        detail: 'Confira o papel.',
        errors: [{ field: 'papel', code: 'papel_invalido', message: '' }],
      }),
    );
    await propagar();
    expect(elemento('#cfg-papel-erro').textContent).toContain('Confira o papel.');
  });

  it('mostra o aviso de que a mudança da marca não altera processo já configurado', async () => {
    await abrirEdicao();
    expect(fixture.nativeElement.textContent).toContain(
      'Mudar a marca não altera processo já configurado: cada processo guarda a cópia do tipo.',
    );
  });
});
