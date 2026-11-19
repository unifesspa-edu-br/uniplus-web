import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of } from 'rxjs';
import { vi } from 'vitest';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  VersoesDoPerfilApi,
  type EtapaDaVersao,
  type ItemDaFilaDeVersoesDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok } from '../testes';
import { botaoComTexto, campoPorRotulo, dialogoComTitulo, digitar } from '../interacao.testing';
import { DocumentoDaVersaoService } from './documento-da-versao.service';
import { FilaDeVersoesPage } from './fila-de-versoes.page';
import { versaoPendente } from './perfis.testing';

export function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

export const ITEM: ItemDaFilaDeVersoesDto = {
  perfilId: 'p1',
  perfilNome: 'Operador de inscrições',
  versao: versaoPendente(),
  propostaPorQuemLe: false,
};
export const OUTRO: ItemDaFilaDeVersoesDto = {
  perfilId: 'p3',
  perfilNome: 'Auditoria',
  versao: versaoPendente({ versaoId: 'v7', numero: 4, situacaoDoDocumento: 'em_verificacao' }),
  propostaPorQuemLe: false,
};

export const versoes = { aprovar: vi.fn(), recusar: vi.fn() };
export const documento = { abrir: vi.fn() };
export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
export const leitura = vi.fn();

type Assentavel = { detectChanges(): void; whenStable(): Promise<unknown> };

export async function assentar(fixture: Assentavel): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

export function reiniciarDuplas(): void {
  vi.resetAllMocks();
  TestBed.resetTestingModule();
}

function provedoresDeHttp(): (Provider | EnvironmentProviders)[] {
  return [
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    provideHttpClient(
      withInterceptors([
        (req) =>
          leitura(req.params.get('fila')).pipe(map((body: unknown) => new HttpResponse({ body }))),
      ]),
    ),
  ];
}

function provedoresDeDuplas(concedidas: readonly string[]): Provider[] {
  const temAlguma = (...c: string[]) => c.some((x) => concedidas.includes(x));
  return [
    { provide: VersoesDoPerfilApi, useValue: versoes },
    { provide: DocumentoDaVersaoService, useValue: documento },
    { provide: NotificationService, useValue: notificacoes },
    { provide: PermissoesService, useValue: { temAlguma } },
  ];
}

function configurar(fila: unknown, concedidas: readonly string[]): void {
  leitura.mockReturnValue(of(fila));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMensagensDeAcesso(),
      ...provedoresDeHttp(),
      ...provedoresDeDuplas(concedidas),
    ],
  });
}

/** Monta a fila da etapa dada com a leitura e as permissões dadas. */
export async function abrir(
  etapa: EtapaDaVersao,
  fila: unknown = ok([ITEM, OUTRO]),
  concedidas: readonly string[] = [PERMISSAO.autorizacao.perfisManter],
) {
  configurar(fila, concedidas);
  const fixture = TestBed.createComponent(FilaDeVersoesPage);
  fixture.componentRef.setInput('etapa', etapa);
  await assentar(fixture);
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
  };
}

export function secao(host: HTMLElement, perfil: string): HTMLElement {
  const secoes = host.querySelectorAll<HTMLElement>('section.panel');
  return presente([...secoes].find((s) => s.textContent?.includes(perfil)));
}

export function botao(area: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return [...area.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
}

/** Clica no botão da seção do perfil e deixa a tela assentar. */
export async function clicar(
  fixture: Assentavel,
  host: HTMLElement,
  perfil: string,
  texto: string,
): Promise<void> {
  presente(botao(secao(host, perfil), texto)).click();
  await assentar(fixture);
}

/** Clica em Recusar na seção do perfil e devolve o diálogo que pede o motivo. */
export async function abrirODialogoDeRecusa(
  fixture: Assentavel,
  host: HTMLElement,
  perfil: string,
): Promise<HTMLDialogElement> {
  await clicar(fixture, host, perfil, 'Recusar');
  return presente(dialogoComTitulo(host, 'Recusar a versão'));
}

/** Escreve o motivo, quando dado, e confirma a recusa pelo botão do diálogo. */
export async function recusarNoDialogo(
  fixture: Assentavel,
  dialogo: HTMLElement,
  motivo?: string,
): Promise<void> {
  if (motivo !== undefined) digitar(campoPorRotulo(dialogo, 'Motivo'), motivo);
  presente(botaoComTexto(dialogo, 'Recusar versão')).click();
  await assentar(fixture);
}
