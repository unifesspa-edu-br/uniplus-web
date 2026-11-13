import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type DetalheDaProtecaoDoCatalogoDto,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';

export const BASE = 'http://localhost:5000';
export const URL_DA_FILA = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
export const URL_DAS_DECISOES = `${URL_DA_FILA}/decisoes`;
export const URL_DAS_CATEGORIAS = `${BASE}/api/configuracao/categorias-documento`;
export const SEM_CONTEUDO = { status: 204, statusText: 'No Content' } as const;

export const CODIGO_PROTECAO_MUDOU = 'uniplus.configuracao.protecao_do_catalogo.protecao_mudou';
export const CODIGO_DE_PROCESSAMENTO = 'uniplus.idempotency.processing_conflict';

export const laudo: ItemDaProtecaoDoCatalogoDto = {
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
    justificativa: null,
    aceitaEm: null,
    ciclo: 1,
    manifestadaEm: null,
    manifestacaoDesfavoravel: false,
  },
};

export const detalheDoLaudo: DetalheDaProtecaoDoCatalogoDto = {
  ...laudo,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg', tamanhoMaximoMb: 10 },
  manifestacoesVigentes: [],
  atos: [],
};

/** Uma resposta de erro da API no formato que o cliente interpreta. */
export const problema = (status: number, code: string, title: string) =>
  [
    JSON.stringify({ status, code, title }),
    { status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export interface PaginaMontada {
  readonly fixture: ComponentFixture<ProtecaoDoCatalogoPage>;
  readonly controller: HttpTestingController;
  readonly tela: HTMLElement;
  assentar(): Promise<void>;
  carregarFila(itens: readonly ItemDaProtecaoDoCatalogoDto[]): Promise<void>;
  abrirDetalhe(): Promise<void>;
  encerrar(): void;
}

export function clicar(alvo: Element | null | undefined, descricao = 'o alvo do clique'): void {
  expect(alvo, `${descricao} existe`).toBeTruthy();
  (alvo as HTMLElement).click();
}

/** Procura o botão pelo texto exato dentro de `raiz`; falha se não existe. */
export function botaoPorTexto(raiz: ParentNode, texto: string): HTMLButtonElement {
  const botao = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === texto,
  );
  expect(botao, `botão "${texto}"`).toBeDefined();
  return botao as HTMLButtonElement;
}

/** Monta a página com a permissão de aprovar (ou sem ela) e devolve o que os cenários usam. */
export function montarPagina(permissoes: readonly string[]): PaginaMontada {
  TestBed.configureTestingModule({
    imports: [ProtecaoDoCatalogoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      {
        provide: PermissoesService,
        useValue: { tem: (codigo: string) => permissoes.includes(codigo) },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProtecaoDoCatalogoPage);
  const controller = TestBed.inject(HttpTestingController);
  const appRef = TestBed.inject(ApplicationRef);
  const tela = fixture.nativeElement as HTMLElement;
  const assentar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };
  fixture.detectChanges();
  return {
    fixture,
    controller,
    tela,
    assentar,
    async carregarFila(itens) {
      controller.expectOne((r) => r.url === URL_DA_FILA).flush(itens);
      await assentar();
    },
    async abrirDetalhe() {
      clicar(
        tela.querySelector(`td button[aria-label="Ver o detalhe de ${laudo.nome}"]`),
        'a linha',
      );
      await assentar();
      controller.expectOne(`${URL_DA_FILA}/tipos-documento/${laudo.id}`).flush(detalheDoLaudo);
      await assentar();
    },
    encerrar() {
      controller.match((r) => r.url === URL_DAS_CATEGORIAS).forEach((req) => req.flush([]));
      controller.verify();
    },
  };
}
