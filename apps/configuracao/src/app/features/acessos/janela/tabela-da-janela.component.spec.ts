import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { CatalogoDePermissoesStore } from '../versoes/catalogo-de-permissoes.store';
import { itemDaJanela } from './janela.testing';
import { TabelaDaJanelaComponent } from './tabela-da-janela.component';

const URL_DO_CATALOGO = 'http://api.test/api/autorizacao/permissoes';
const CODIGO = 'selecao:processos:aprovar';
const CATALOGO = [
  {
    modulo: 'selecao',
    resources: [
      {
        resource: 'processos',
        permissoes: [
          { codigo: CODIGO, nome: 'Aprovar processos', descricao: '', sensibilidade: 'pessoal' },
        ],
      },
    ],
  },
];
const CONSULTAR_CATALOGO = PERMISSAO.autorizacao.permissoesConsultarCatalogo;

@Component({
  standalone: true,
  imports: [TabelaDaJanelaComponent],
  template: `<cfg-tabela-da-janela
    [itens]="itens"
    legenda="Concessões da janela"
    [nomeDoEscopo]="nomeDoEscopo"
  />`,
})
class HospedeiroComponent {
  protected readonly itens = [itemDaJanela()];
  protected readonly nomeDoEscopo = (): string => 'Unidade 1';
}

describe('TabelaDaJanelaComponent: nome das permissões', () => {
  const concedidas = signal<readonly string[]>([]);
  let fixture: ComponentFixture<HospedeiroComponent>;
  let http: HttpTestingController;

  const assentar = async (): Promise<void> => {
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.tick();
    fixture.detectChanges();
  };
  const acrescimo = (): string =>
    fixture.nativeElement.querySelector('td[data-label="Acréscimo"]').textContent;
  const conceder = async (permissoes: readonly string[]): Promise<void> => {
    concedidas.set(permissoes);
    await assentar();
  };

  function configurarOTestBed(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: NotificationService, useValue: { errorFromProblem: vi.fn() } },
        { provide: PermissoesService, useValue: { tem: (c: string) => concedidas().includes(c) } },
        CatalogoDePermissoesStore,
      ],
    });
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    concedidas.set([]);
    configurarOTestBed();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HospedeiroComponent);
    await assentar();
  });

  afterEach(() => http.verify());

  it('sem a permissão, mostra o código e não lê o catálogo', () => {
    expect(acrescimo()).toContain(CODIGO);
    http.expectNone(URL_DO_CATALOGO);
  });

  it('com a permissão concedida com a página aberta, lê o catálogo e mostra o nome', async () => {
    await conceder([CONSULTAR_CATALOGO]);
    http.expectOne(URL_DO_CATALOGO).flush(CATALOGO);
    await assentar();

    expect(acrescimo()).toContain('Aprovar processos');
    expect(acrescimo()).not.toContain(CODIGO);
  });

  it('com a permissão revogada com a página aberta, volta a mostrar o código', async () => {
    await conceder([CONSULTAR_CATALOGO]);
    http.expectOne(URL_DO_CATALOGO).flush(CATALOGO);
    await assentar();

    await conceder([]);

    expect(acrescimo()).toContain(CODIGO);
    expect(acrescimo()).not.toContain('Aprovar processos');
  });
});
