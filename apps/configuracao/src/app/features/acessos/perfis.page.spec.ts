import { HttpHeaders, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, map, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  PerfisApi,
  type EnvioDoDocumentoDto,
  type PerfilListadoDto,
} from '@uniplus/shared-data/autorizacao';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import { provideMensagensDeAcesso } from './mensagens-de-acesso';
import { PerfisPage } from './perfis.page';
import { ok, recusa } from './testes';
import { DocumentoDaVersaoService } from './versoes/documento-da-versao.service';
import { EscritaDoPerfil } from './versoes/escrita-do-perfil';

function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

const COMUM: PerfilListadoDto = {
  id: 'p1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  temVersaoVigente: true,
  temVersaoPendente: false,
};
const GOVERNANCA: PerfilListadoDto = {
  ...COMUM,
  id: 'p2',
  nome: 'Gestor de acessos',
  governanca: 'gestor',
};
const ENVIO = {
  perfilId: 'p9',
  versaoId: 'v9',
  urlDeEnvio: 'https://armazenamento.test/envio',
} as EnvioDoDocumentoDto;
const PDF = new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' });
const CATALOGO = [
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


describe('PerfisPage', () => {
  const api = { criar: vi.fn(), ativar: vi.fn(), desativar: vi.fn() };
  const documento = { enviar: vi.fn() };
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  const leituras = { perfis: vi.fn() };

  async function abrir(perfis: unknown = ok([COMUM, GOVERNANCA])) {
    leituras.perfis.mockReturnValue(of(perfis));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMensagensDeAcesso(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) =>
              (req.url.endsWith('/permissoes') ? of(ok(CATALOGO)) : leituras.perfis()).pipe(
                map((body: unknown) => new HttpResponse({ body })),
              ),
          ]),
        ),
        { provide: PerfisApi, useValue: api },
        { provide: DocumentoDaVersaoService, useValue: documento },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    const fixture = TestBed.createComponent(PerfisPage);
    await assentar(fixture);
    return {
      fixture,
      host: fixture.nativeElement as HTMLElement,
      edicao: fixture.debugElement.injector.get(EdicaoDosPerfis),
      escrita: fixture.debugElement.injector.get(EscritaDoPerfil),
    };
  }

  const assentar = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const botaoDaLinha = (host: HTMLElement, rotulo: string) =>
    presente(host.querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`));

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    documento.enviar.mockResolvedValue({ ok: true });
  });

  it('lista os perfis com ligação ao detalhe e sem botão de editar', async () => {
    const { host } = await abrir();

    expect(host.textContent).toContain('Operador de inscrições');
    expect(host.querySelector('a[href="/acessos/perfis/p1"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label^="Editar"]')).toBeNull();
    expect(host.querySelector('tr[data-perfil-id="p2"] button')).toBeNull();
    expect(host.textContent).toContain('Governança');
  });

  it('o botão Novo perfil abre o formulário de perfil novo', async () => {
    const { fixture, host, edicao } = await abrir();

    presente(host.querySelector<HTMLButtonElement>('#cfg-perfis-novo')).click();
    await assentar(fixture);

    expect(edicao.formAberto()).toBe(true);
    expect(edicao.base()).toBeNull();
  });

  it('oferece as permissões do catálogo agrupadas por módulo e resource, com a sensibilidade de cada uma', async () => {
    const { fixture, host, edicao } = await abrir();

    edicao.abrirCriacao();
    await assentar(fixture);

    const grupos = [...host.querySelectorAll('fieldset.field fieldset.field legend')].map((l) =>
      l.textContent?.trim(),
    );
    expect(grupos).toEqual([
      'selecao · processos',
      'selecao · documentos-identificadores',
      'selecao · documentos-internos',
      'selecao · documentos-publicos',
      'selecao · dados-pessoais',
      'selecao · dados-identificadores',
      'selecao · inscricoes',
    ]);
    const rotulo = (codigo: string) =>
      [...host.querySelectorAll('label.checkbox')].find((l) =>
        l.querySelector('code')?.textContent?.includes(codigo),
      );
    expect(rotulo('selecao:documentos-identificadores:consultar')?.textContent).toContain(
      'Dado identificador',
    );
    expect(rotulo('selecao:documentos-internos:consultar')?.textContent).toContain('Interna');
    expect(rotulo('selecao:documentos-publicos:consultar')?.textContent).toContain('Pública');
    expect(host.querySelector('[formcontrolname="nome"]')?.getAttribute('aria-required')).toBe('true');
  });

  it('pede o documento instituidor no perfil novo e envia o PDF pela API', async () => {
    const { fixture, host, edicao } = await abrir();
    api.criar.mockReturnValue(of(ok(ENVIO)));
    edicao.abrirCriacao();
    await assentar(fixture);

    expect(host.querySelector('[formcontrolname="protocolo"]')).not.toBeNull();
    expect(host.querySelector('ui-file-upload')).not.toBeNull();

    edicao.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.', protocolo: 'P-1' });
    edicao.alternar('selecao:inscricoes:consultar');
    edicao.documento.set(PDF);
    await edicao.salvar();

    expect(api.criar.mock.calls[0]?.[0]).toEqual({
      nome: 'Consulta',
      descricao: 'Só consulta.',
      permissoes: ['selecao:inscricoes:consultar'],
      protocolo: 'P-1',
      tamanhoDoDocumento: PDF.size,
    });
    expect(documento.enviar).toHaveBeenCalledWith(ENVIO, PDF, expect.any(Function));
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil criado');
    expect(edicao.formAberto()).toBe(false);
  });

  it('mantém o formulário indisponível durante a gravação e recusa novo envio', async () => {
    const { fixture, host, edicao } = await abrir();
    const resposta = new Subject<ReturnType<typeof ok<EnvioDoDocumentoDto>>>();
    api.criar.mockReturnValue(resposta);
    edicao.abrirCriacao();
    edicao.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.', protocolo: 'P-1' });
    edicao.alternar('selecao:inscricoes:consultar');
    edicao.documento.set(PDF);
    await assentar(fixture);

    const botao = presente(host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'));
    botao.focus();
    botao.click();
    fixture.detectChanges();

    expect(
      host.querySelector<HTMLInputElement>('input[formControlName="nome"]:disabled'),
    ).not.toBeNull();
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    const fechar = presente(host.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]'));
    expect(fechar.disabled).toBe(true);
    const escape = new Event('cancel', { cancelable: true });
    presente(host.querySelector('dialog')).dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(botao);
    botao.click();
    await edicao.salvar();
    expect(api.criar).toHaveBeenCalledTimes(1);

    resposta.next(ok(ENVIO));
    resposta.complete();
    await assentar(fixture);
    expect(edicao.formAberto()).toBe(false);
  });

  it('mostra a recusa do servidor no campo e leva o foco a ele', async () => {
    const { fixture, host, edicao } = await abrir();
    api.criar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Recusado',
            status: 422,
            code: 'validacao',
            traceId: '',
            errors: [{ field: 'Nome', code: 'nome_invalido', message: 'Nome recusado.' }],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    edicao.abrirCriacao();
    edicao.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.', protocolo: 'P-1' });
    edicao.alternar('selecao:inscricoes:consultar');
    edicao.documento.set(PDF);
    await assentar(fixture);
    const botao = presente(host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'));
    botao.focus();
    botao.click();
    await assentar(fixture);
    await assentar(fixture);

    const campo = presente(host.querySelector<HTMLInputElement>('input[formControlName="nome"]'));
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe('cfg-perfil-erro-nome');
    expect(host.textContent).toContain('Nome recusado.');
    expect(document.activeElement).toBe(campo);
  });

  it('o envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
    const { fixture, host, edicao } = await abrir();
    edicao.abrirCriacao();
    await assentar(fixture);
    const botao = presente(host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'));
    botao.focus();
    botao.click();
    await assentar(fixture);

    expect(document.activeElement).toBe(host.querySelector('input[formControlName="nome"]'));
    expect(api.criar).not.toHaveBeenCalled();
  });

  it('desativa o perfil ativo e reativa o desativado, e anuncia o desfecho', async () => {
    const { fixture, host } = await abrir(ok([COMUM, { ...GOVERNANCA, governanca: null, ativo: false }]));
    api.desativar.mockReturnValue(of(ok(undefined)));
    api.ativar.mockReturnValue(of(ok(undefined)));

    botaoDaLinha(host, 'Desativar o perfil Operador de inscrições').click();
    await assentar(fixture);
    botaoDaLinha(host, 'Reativar o perfil Gestor de acessos').click();
    await assentar(fixture);

    expect(api.desativar.mock.calls[0]?.[0]).toBe('p1');
    expect(api.ativar.mock.calls[0]?.[0]).toBe('p2');
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil desativado');
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil reativado');
    expect(host.querySelector('.sr-only[role="status"]')?.textContent).toContain(
      'Perfil Gestor de acessos reativado.',
    );
  });

  it('impede escritas concorrentes durante a mudança de situação', async () => {
    const { fixture, host, edicao, escrita } = await abrir();
    const resposta = new Subject<ReturnType<typeof ok<void>>>();
    api.desativar.mockReturnValue(resposta);

    botaoDaLinha(host, 'Desativar o perfil Operador de inscrições').click();
    fixture.detectChanges();

    expect(escrita.gravando()).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('#cfg-perfis-novo')?.disabled).toBe(true);
    edicao.abrirCriacao();
    await edicao.salvar();
    expect(edicao.formAberto()).toBe(false);
    expect(api.criar).not.toHaveBeenCalled();

    resposta.next(ok(undefined));
    resposta.complete();
    await assentar(fixture);
  });

  it('mostra a recusa da mudança de situação junto à lista', async () => {
    const { fixture, host, escrita } = await abrir();
    api.desativar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.governanca_imutavel')));

    botaoDaLinha(host, 'Desativar o perfil Operador de inscrições').click();
    await assentar(fixture);

    expect(escrita.erroDaAcao()).toContain('Perfil de governança não se altera.');
    expect(host.textContent).toContain('Não foi possível concluir');
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('com a leitura falha, oferece tentar novamente e relê a lista', async () => {
    const { fixture, host } = await abrir(recusa('uniplus.internal.unexpected', 500, 'Erro interno'));
    const tentar = presente(
      [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Tentar novamente')),
    );
    leituras.perfis.mockReturnValue(of(ok([COMUM])));

    tentar.click();
    await assentar(fixture);

    expect(host.textContent).toContain('Operador de inscrições');
  });

  it('depois de desativar, devolve o foco ao botão da mesma linha', async () => {
    const { fixture, host } = await abrir();
    const resposta = new Subject<ReturnType<typeof ok<void>>>();
    api.desativar.mockReturnValue(resposta);
    const rotulo = 'Desativar o perfil Operador de inscrições';
    const acionador = botaoDaLinha(host, rotulo);
    acionador.focus();
    acionador.click();
    fixture.detectChanges();
    const provisorio = host.appendChild(document.createElement('button'));
    provisorio.focus();
    provisorio.remove();

    resposta.next(ok(undefined));
    resposta.complete();
    await assentar(fixture);
    await assentar(fixture);

    expect(document.activeElement).toBe(botaoDaLinha(host, rotulo));
  });
});
