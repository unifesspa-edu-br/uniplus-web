import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { map, of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  PedidosDeConcessaoApi,
  TermosDeResponsabilidadeApi,
  type VersaoDoTermoDto,
} from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { PedirAcessoPage } from './pedir-acesso.page';
import { UNIDADES, ok, type recusa } from './testes';

/** Apoio dos specs da página de pedir acesso: perfis oferecidos, dublês e montagem. */

export const PERFIL_COMUM = {
  id: 'perfil-1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  escopo: 'unidade',
  exigeAprovacaoDeProtecaoDeDados: false,
  governanca: null,
};
export const PERFIL_INSTITUCIONAL = {
  ...PERFIL_COMUM,
  id: 'perfil-2',
  nome: 'Consulta institucional',
  escopo: 'instituicao',
};

export const PERFIL_DE_GOVERNANCA = {
  ...PERFIL_INSTITUCIONAL,
  id: 'perfil-3',
  nome: 'Representante do controlador',
  exigeAprovacaoDeProtecaoDeDados: true,
  governanca: 'representante-do-controlador',
};

/** Perfil com dado pessoal: exige o termo de responsabilidade. */
export const PERFIL_SENSIVEL = {
  ...PERFIL_COMUM,
  id: 'perfil-4',
  nome: 'Análise de documentos pessoais',
  exigeAprovacaoDeProtecaoDeDados: true,
};

/** A versão vigente do termo, como a API a devolve. */
export function versaoDoTermo(parcial: Partial<VersaoDoTermoDto> = {}): VersaoDoTermoDto {
  return {
    id: 'termo-v2',
    numero: 2,
    texto: 'Declaro que tratarei os dados pessoais acessados apenas para a finalidade do processo.',
    resumo: 'a'.repeat(64),
    ato: 'Portaria 12/2026',
    publicadaEm: '2026-11-01T12:00:00Z',
    vigente: true,
    ...parcial,
  };
}

export function dublesDoPedirAcesso() {
  return {
    api: { criar: vi.fn(), perfisParaPedir: vi.fn() },
    termos: { vigente: vi.fn(() => of(ok(versaoDoTermo()))) },
    anexos: { anexar: vi.fn() },
    notificacoes: { success: vi.fn(), warning: vi.fn(), errorFromProblem: vi.fn() },
  };
}

type Dubles = ReturnType<typeof dublesDoPedirAcesso>;

/** Os perfis em toda leitura; a primeira pode ser substituída por uma recusa. */
function oferecerPerfis(api: Dubles['api'], primeira?: ReturnType<typeof recusa>): void {
  api.perfisParaPedir.mockReturnValue(
    of(ok([PERFIL_COMUM, PERFIL_INSTITUCIONAL, PERFIL_DE_GOVERNANCA, PERFIL_SENSIVEL])),
  );
  if (primeira) api.perfisParaPedir.mockReturnValueOnce(of(primeira));
}

/** A leitura dos perfis passa pelo `HttpClient`, como na página; a resposta vem do dublê. */
function leituraDosPerfis(api: Dubles['api']) {
  return (): Observable<HttpResponse<unknown>> =>
    (
      api.perfisParaPedir({
        cursor: undefined,
        direction: 'next',
        limit: 100,
      }) as Observable<unknown>
    ).pipe(map((body) => new HttpResponse({ body })));
}

function configurar({ api, termos, anexos, notificacoes }: Dubles): void {
  TestBed.configureTestingModule({
    providers: [
      { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
      provideHttpClient(withInterceptors([leituraDosPerfis(api)])),
      provideRouter([]),
      { provide: PedidosDeConcessaoApi, useValue: api },
      { provide: TermosDeResponsabilidadeApi, useValue: termos },
      { provide: AnexoDoPedidoService, useValue: anexos },
      { provide: NotificationService, useValue: notificacoes },
      { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
    ],
  });
}

/** Escreve no campo e avisa o formulário, como a pessoa faria: `change` na lista, `input` no resto. */
function preencher(campo: HTMLInputElement | HTMLSelectElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
}

/** As interações de quem preenche o formulário: achar o campo, digitar e enviar. */
function interacoes(fixture: ComponentFixture<PedirAcessoPage>) {
  const host = fixture.nativeElement as HTMLElement;
  const campo = <T extends HTMLElement>(seletor: string) => host.querySelector(seletor) as T;
  const digitar = (seletor: string, valor: string) => {
    preencher(campo<HTMLInputElement>(seletor), valor);
    fixture.detectChanges();
  };
  const enviar = async () => {
    campo<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, campo, digitar, enviar };
}

/** Monta a página com os perfis oferecidos e a navegação substituída. */
export async function montarPedirAcesso(
  dubles: Dubles,
  primeiraLeituraDosPerfis?: ReturnType<typeof recusa>,
) {
  oferecerPerfis(dubles.api, primeiraLeituraDosPerfis);
  configurar(dubles);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PedirAcessoPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, navegar, ...interacoes(fixture) };
}
