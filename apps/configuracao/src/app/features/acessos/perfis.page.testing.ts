import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, map, of } from 'rxjs';
import { vi } from 'vitest';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  PerfisApi,
  type EnvioDoDocumentoDto,
  type PerfilListadoDto,
} from '@uniplus/shared-data/autorizacao';
import {
  caixaDaPermissao,
  campoPorRotulo,
  digitar,
  escolherArquivoNoCampo,
} from './interacao.testing';
import { provideMensagensDeAcesso } from './mensagens-de-acesso';
import { PerfisPage } from './perfis.page';
import { ok } from './testes';
import { DocumentoDaVersaoService } from './versoes/documento-da-versao.service';

export function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

export const COMUM: PerfilListadoDto = {
  id: 'p1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  temVersaoVigente: true,
  temVersaoPendente: false,
  suspensao: null,
  desativadoDesde: null,
};
export const GOVERNANCA: PerfilListadoDto = {
  ...COMUM,
  id: 'p2',
  nome: 'Gestor de acessos',
  governanca: 'gestor',
};
export const ENVIO = {
  perfilId: 'p9',
  versaoId: 'v9',
  urlDeEnvio: 'https://armazenamento.test/envio',
} as EnvioDoDocumentoDto;
export const PDF = new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' });
export const CATALOGO = [
  {
    modulo: 'selecao',
    resources: [
      {
        resource: 'processos',
        permissoes: [
          {
            codigo: 'selecao:processos:configurar',
            nome: 'Configurar processos',
            descricao: '',
            sensibilidade: 'interno',
          },
        ],
      },
      {
        resource: 'documentos-identificadores',
        permissoes: [
          {
            codigo: 'selecao:documentos-identificadores:consultar',
            nome: 'Consultar documentos de identificação',
            descricao: '',
            sensibilidade: 'identificador',
          },
        ],
      },
      {
        resource: 'documentos-internos',
        permissoes: [
          {
            codigo: 'selecao:documentos-internos:consultar',
            nome: 'Consultar documentos internos',
            descricao: '',
            sensibilidade: 'interno',
          },
        ],
      },
      {
        resource: 'documentos-publicos',
        permissoes: [
          {
            codigo: 'selecao:documentos-publicos:consultar',
            nome: 'Consultar documentos públicos',
            descricao: '',
            sensibilidade: 'publico',
          },
        ],
      },
      {
        resource: 'dados-pessoais',
        permissoes: [
          {
            codigo: 'selecao:dados-pessoais:consultar',
            nome: 'Consultar dados pessoais',
            descricao: '',
            sensibilidade: 'pessoal',
          },
        ],
      },
      {
        resource: 'dados-identificadores',
        permissoes: [
          {
            codigo: 'selecao:dados-identificadores:consultar',
            nome: 'Consultar dados de identificação mascarados',
            descricao: '',
            sensibilidade: 'identificador',
          },
          {
            codigo: 'selecao:dados-identificadores:revelar',
            nome: 'Revelar dados de identificação',
            descricao: '',
            sensibilidade: 'identificador',
          },
        ],
      },
      {
        resource: 'inscricoes',
        permissoes: [
          {
            codigo: 'selecao:inscricoes:consultar',
            nome: 'Consultar inscrições',
            descricao: '',
            sensibilidade: 'pessoal',
          },
        ],
      },
    ],
  },
];

export const GRUPOS_DO_CATALOGO = [
  'selecao · processos',
  'selecao · documentos-identificadores',
  'selecao · documentos-internos',
  'selecao · documentos-publicos',
  'selecao · dados-pessoais',
  'selecao · dados-identificadores',
  'selecao · inscricoes',
];
export const PERFIL_CRIADO = {
  nome: 'Consulta',
  descricao: 'Só consulta.',
  permissoes: ['selecao:inscricoes:consultar'],
  protocolo: 'P-1',
  tamanhoDoDocumento: PDF.size,
};
export const RECUSA_DO_NOME = {
  type: 'x',
  title: 'Recusado',
  status: 422,
  code: 'validacao',
  traceId: '',
  errors: [{ field: 'Nome', code: 'nome_invalido', message: 'Nome recusado.' }],
};

export const api = { criar: vi.fn() };
export const documento = { enviar: vi.fn() };
export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
export const leituras = { perfis: vi.fn() };
export const concedidasAgora = signal<readonly string[] | undefined>(undefined);

export function reiniciarDuplas(): void {
  vi.resetAllMocks();
  TestBed.resetTestingModule();
  documento.enviar.mockResolvedValue({ ok: true });
}

export function provedoresDeHttp() {
  const resposta = (url: string) =>
    url.endsWith('/permissoes') ? of(ok(CATALOGO)) : leituras.perfis();
  return [
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    provideHttpClient(
      withInterceptors([
        (req) => resposta(req.url).pipe(map((body: unknown) => new HttpResponse({ body }))),
      ]),
    ),
  ];
}

export function provedoresDeDuplas() {
  const tem = (c: string) => concedidasAgora()?.includes(c) ?? true;
  return [
    { provide: PerfisApi, useValue: api },
    { provide: DocumentoDaVersaoService, useValue: documento },
    { provide: NotificationService, useValue: notificacoes },
    { provide: PermissoesService, useValue: { tem } },
  ];
}

export function configurar(perfis: unknown, concedidas?: readonly string[]): void {
  leituras.perfis.mockReturnValue(of(perfis));
  concedidasAgora.set(concedidas);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMensagensDeAcesso(),
      ...provedoresDeHttp(),
      ...provedoresDeDuplas(),
    ],
  });
}

export async function abrir(
  perfis: unknown = ok([COMUM, GOVERNANCA]),
  concedidas?: readonly string[],
) {
  configurar(perfis, concedidas);
  const fixture = TestBed.createComponent(PerfisPage);
  await assentar(fixture);
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
  };
}

export type Aberta = Awaited<ReturnType<typeof abrir>>;

export const botaoDeSalvar = (host: HTMLElement) =>
  presente(host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'));

/** Clica em Novo perfil e devolve o formulário que abre. */
export async function abrirOFormulario({ fixture, host }: Pick<Aberta, 'fixture' | 'host'>) {
  presente(host.querySelector<HTMLButtonElement>('#cfg-perfis-novo')).click();
  await assentar(fixture);
  return presente(host.querySelector<HTMLElement>('cfg-perfil-formulario'));
}

export const formularioAberto = (host: HTMLElement): boolean =>
  host.querySelector('cfg-perfil-formulario dialog')?.hasAttribute('open') ?? false;

/** Preenche o formulário como a pessoa: nome, descrição, permissão, protocolo e PDF. */
export function preencherOPerfil(formulario: HTMLElement): void {
  digitar(campoPorRotulo(formulario, 'Nome'), 'Consulta');
  digitar(campoPorRotulo(formulario, 'Descrição'), 'Só consulta.');
  caixaDaPermissao(formulario, 'Consultar inscrições').click();
  digitar(campoPorRotulo(formulario, 'Protocolo'), 'P-1');
  escolherArquivoNoCampo(formulario, PDF);
}

export async function salvarPeloBotao({
  fixture,
  host,
}: Pick<Aberta, 'fixture' | 'host'>): Promise<HTMLButtonElement> {
  const botao = botaoDeSalvar(host);
  botao.focus();
  botao.click();
  await assentar(fixture);
  return botao;
}

export async function abrirGravando() {
  const aberta = await abrir();
  const resposta = new Subject<ReturnType<typeof ok<EnvioDoDocumentoDto>>>();
  api.criar.mockReturnValue(resposta);
  preencherOPerfil(await abrirOFormulario(aberta));
  await assentar(aberta.fixture);
  const botao = await salvarPeloBotao(aberta);
  return { ...aberta, resposta, botao };
}

export const assentar = async (fixture: {
  detectChanges(): void;
  whenStable(): Promise<unknown>;
}) => {
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
};
