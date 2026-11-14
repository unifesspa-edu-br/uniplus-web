import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal, computed, type EnvironmentProviders, type Provider } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { PROFILE_BASE_PATH } from '@uniplus/shared-auth/bootstrap';
import { UserHeaderInfoComponent } from './user-header-info.component';
import { AuthService } from '../services/auth.service';
import { UserContextService } from '../services/user-context.service';
import { UserProfile } from '../models/user.model';
import { rotuloDoPerfil, type PerfilConcedido } from '../models/perfil-concedido.model';
import { PerfisDeAcessoService, type EstadoDosPerfis } from '../services/perfis-de-acesso.service';

export const profileData: UserProfile = {
  id: 'abc-123',
  username: 'candidato',
  email: 'candidato@teste.unifesspa.edu.br',
  nomeCivil: 'Usuário Candidato',
  nomeSocial: 'Candidato Teste',
  cpf: '69959836371',
};

export const estadoDosPerfis = signal<EstadoDosPerfis>('carregada');
export const concedidos = signal<readonly PerfilConcedido[]>([]);
let resolverRecarga: (resposta: unknown) => void = () => undefined;
export const recarregar = vi.fn(
  () =>
    new Promise<unknown>((resolver) => {
      resolverRecarga = resolver;
    }),
);

export function perfil(nome: string, sigla: string | null, id = nome): PerfilConcedido {
  return {
    concessaoId: `c-${id}`,
    perfilId: `p-${id}`,
    nome,
    escopoTipo: 'unidade',
    unidadeId: sigla === null ? null : `u-${sigla}`,
    unidadeSigla: sigla,
    unidadeNome: null,
    validaAte: null,
  };
}

export function setup(profile: UserProfile | null = profileData) {
  const acoes = { logout: vi.fn(), login: vi.fn(), atualizarPerfil: vi.fn() };
  estadoDosPerfis.set('carregada');
  concedidos.set([]);
  recarregar.mockClear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [UserHeaderInfoComponent],
    providers: provedoresDoCabecalho(profile, acoes),
  });
  const fixture: ComponentFixture<UserHeaderInfoComponent> =
    TestBed.createComponent(UserHeaderInfoComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement, ...acoes };
}

type AcoesDoAuth = Record<'logout' | 'login' | 'atualizarPerfil', ReturnType<typeof vi.fn>>;

function provedoresDoCabecalho(
  profile: UserProfile | null,
  acoes: AcoesDoAuth,
): (Provider | EnvironmentProviders)[] {
  return [
    { provide: AuthService, useValue: authServiceDeTeste(profile, acoes) },
    { provide: UserContextService, useValue: contextoDoUsuarioDeTeste(profile) },
    { provide: PerfisDeAcessoService, useValue: perfisDeTeste() },
    { provide: PROFILE_BASE_PATH, useValue: 'http://api.test' },
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
  ];
}

function perfisDeTeste(): PerfisDeAcessoService {
  return {
    estado: estadoDosPerfis.asReadonly(),
    perfis: concedidos.asReadonly(),
    rotulos: computed(() => concedidos().map(rotuloDoPerfil)),
    recarregar,
  } as unknown as PerfisDeAcessoService;
}

function authServiceDeTeste(profile: UserProfile | null, acoes: AcoesDoAuth): AuthService {
  return {
    userProfile: signal(profile).asReadonly(),
    authenticated: signal(profile !== null).asReadonly(),
    ...acoes,
  } as unknown as AuthService;
}

function contextoDoUsuarioDeTeste(profile: UserProfile | null): UserContextService {
  const nomeExibido = (): string => profile?.nomeSocial?.trim() || profile?.nomeCivil || '';
  return {
    user: signal(profile).asReadonly(),
    displayName: computed(nomeExibido),
    firstDisplayName: computed(() => (profile ? firstNameFrom(nomeExibido()) : '')),
    isAuthenticated: signal(profile !== null).asReadonly(),
  } as unknown as UserContextService;
}

/** Entrega a resposta da consulta única que o serviço de perfis faz ao abrir o modal. */
export function responderRecarga(resposta: unknown): void {
  resolverRecarga(resposta);
}

function firstNameFrom(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? '';
}
