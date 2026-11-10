import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  ContencaoDoPerfilApi,
  type PerfilDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok } from '../testes';
import { PerfilDetalhePage } from './perfil-detalhe.page';
import { perfilDoDetalhe } from './perfis.testing';

export const GESTAO = PERMISSAO.autorizacao.perfisManter;
export const PROTECAO = PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados;

export const api = {
  suspender: vi.fn(),
  retomar: vi.fn(),
  desativar: vi.fn(),
  reativar: vi.fn(),
};
export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };

export function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

/** As respostas das leituras que a tela faz: o perfil e a trilha da contenção. */
export interface LeiturasDoPerfil {
  perfil: () => Observable<unknown>;
  trilha: () => Observable<unknown>;
}

export const leituras: LeiturasDoPerfil = { perfil: vi.fn(), trilha: vi.fn() };

export async function assentar(fixture: {
  detectChanges(): void;
  whenStable(): Promise<unknown>;
}): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

export const botao = (host: HTMLElement, texto: string): HTMLButtonElement | undefined =>
  [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);

/** Abre o detalhe do perfil `p1` com as permissões informadas, lendo o perfil e a trilha dos dublês. */
export async function abrirPerfil(
  perfil: PerfilDto = perfilDoDetalhe(),
  concedidas: readonly string[] = [GESTAO],
) {
  vi.mocked(leituras.perfil).mockReturnValue(of(ok(perfil)));
  vi.mocked(leituras.trilha).mockReturnValue(of(ok([])));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMensagensDeAcesso(),
      { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
      provideHttpClient(
        withInterceptors([
          (req) =>
            (req.url.endsWith('/permissoes')
              ? of(ok([]))
              : req.url.endsWith('/contencao')
                ? leituras.trilha()
                : leituras.perfil()
            ).pipe(map((body: unknown) => new HttpResponse({ body }))),
        ]),
      ),
      { provide: ContencaoDoPerfilApi, useValue: api },
      { provide: PermissoesService, useValue: { tem: (c: string) => concedidas.includes(c) } },
      { provide: NotificationService, useValue: notificacoes },
    ],
  });
  const fixture = TestBed.createComponent(PerfilDetalhePage);
  fixture.componentRef.setInput('id', 'p1');
  await assentar(fixture);
  return { fixture, host: fixture.nativeElement as HTMLElement };
}
