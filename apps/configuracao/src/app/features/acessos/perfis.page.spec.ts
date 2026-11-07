import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { map } from 'rxjs';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { apiFailure } from '@uniplus/shared-core/http';
import { HttpHeaders } from '@angular/common/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PerfisApi, type PerfilDto } from '@uniplus/shared-data/autorizacao';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import { PerfisPage } from './perfis.page';
import { ok, recusa } from './testes';

function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

const COMUM: PerfilDto = {
  id: 'p1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  ativo: true,
  governanca: null,
  sensibilidade: 'interno',
  permissoes: [
    {
      codigo: 'selecao:processos:configurar',
      nome: 'Configurar processos',
      sensibilidade: 'interno',
    },
  ],
};
const GOVERNANCA: PerfilDto = {
  ...COMUM,
  id: 'p2',
  nome: 'Gestor de acessos',
  governanca: 'gestor',
};
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

describe('PerfisPage', async () => {
  const api = {
    listar: vi.fn(),
    catalogoDePermissoes: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    ativar: vi.fn(),
    desativar: vi.fn(),
  };
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };

  async function abrir() {
    vi.resetAllMocks();
    api.listar.mockReturnValue(of(ok([COMUM, GOVERNANCA])));
    api.catalogoDePermissoes.mockReturnValue(of(ok(CATALOGO)));
    return abrirComListagem();
  }

  async function abrirComListagem() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) =>
              (req.url.endsWith('/permissoes')
                ? api.catalogoDePermissoes()
                : api.listar({ cursor: undefined, direction: undefined })
              ).pipe(map((body: unknown) => new HttpResponse({ body }))),
          ]),
        ),
        { provide: PerfisApi, useValue: api },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    const fixture = TestBed.createComponent(PerfisPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      host: fixture.nativeElement as HTMLElement,
      pagina: fixture.debugElement.injector.get(EdicaoDosPerfis),
    };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('lista os perfis e só deixa editar o perfil comum', async () => {
    const { host } = await abrir();

    expect(host.textContent).toContain('Operador de inscrições');
    expect(
      host.querySelector('button[aria-label="Editar o perfil Operador de inscrições"]'),
    ).not.toBeNull();
    expect(host.querySelector('button[aria-label="Editar o perfil Gestor de acessos"]')).toBeNull();
    expect(host.textContent).toContain('Governança');
  });

  it('oferece as permissões do catálogo agrupadas por módulo e resource', async () => {
    const { fixture, host, pagina } = await abrir();

    pagina.abrirCriacao();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('[formcontrolname="nome"]')?.getAttribute('aria-required')).toBe(
      'true',
    );
    expect(host.querySelector('[formcontrolname="descricao"]')?.getAttribute('aria-required')).toBe(
      'true',
    );

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
    expect(host.textContent).toContain('selecao:inscricoes:consultar');
    expect(host.textContent).toContain('Consultar dados pessoais');
    expect(host.textContent).toContain('selecao:dados-identificadores:consultar');
    expect(host.textContent).toContain('selecao:dados-identificadores:revelar');
  });

  it('mostra a sensibilidade das permissões de arquivo e permite marcá-las na tela', async () => {
    const { fixture, host, pagina } = await abrir();
    api.criar.mockReturnValue(of(ok('novo')));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Habilitação', descricao: 'Confere os documentos.' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const codigos = [
      'selecao:documentos-identificadores:consultar',
      'selecao:documentos-internos:consultar',
      'selecao:documentos-publicos:consultar',
    ];
    const rotulos: string[] = [];
    for (const codigo of codigos) {
      const rotulo = [...host.querySelectorAll('label.checkbox')].find((l) =>
        l.querySelector('code')?.textContent?.includes(codigo),
      );
      rotulos.push(rotulo?.querySelector('.field__hint')?.textContent?.split('·')[1]?.trim() ?? '');
      const caixa = rotulo?.querySelector('input') as HTMLInputElement;
      caixa.checked = true;
      caixa.dispatchEvent(new Event('change'));
    }
    await pagina.salvar();

    expect(rotulos).toEqual(['Dado identificador', 'Interna', 'Pública']);
    expect(api.criar.mock.calls[0]?.[0].permissoes).toEqual(codigos);
  });

  it('mantém o formulário indisponível durante a gravação e recusa novo envio', async () => {
    const { fixture, host, pagina } = await abrir();
    const resposta = new Subject<ReturnType<typeof ok<string>>>();
    api.criar.mockReturnValue(resposta);
    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
    fixture.detectChanges();

    const botao = presente(host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'));
    botao.focus();
    botao.click();
    fixture.detectChanges();

    expect(
      host.querySelector<HTMLInputElement>('input[formControlName="nome"]:disabled'),
    ).not.toBeNull();
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('dialog [role="status"]')?.textContent).toContain('Salvando perfil');
    expect(pagina.salvando()).toBe(true);
    const fechar = presente(host.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]'));
    const cancelar = presente(
      [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Cancelar')),
    );
    expect(fechar.disabled).toBe(true);
    expect(cancelar.disabled).toBe(true);
    fechar.click();
    cancelar.click();
    const escape = new Event('cancel', { cancelable: true });
    presente(host.querySelector('dialog')).dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(pagina.formAberto()).toBe(true);
    expect(document.activeElement).toBe(botao);
    botao.click();
    presente(host.querySelector('form')).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await pagina.alternarAtivacao(COMUM);
    await pagina.salvar();
    expect(api.criar).toHaveBeenCalledTimes(1);
    expect(api.desativar).not.toHaveBeenCalled();

    resposta.next(ok('novo'));
    resposta.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pagina.formAberto()).toBe(false);
    expect(pagina.salvando()).toBe(false);
  });

  it.each([true, false])(
    'preserva campo desabilitado após edição (sucesso: %s)',
    async (sucesso) => {
      const { fixture, host, pagina } = await abrir();
      const resposta = new Subject<ReturnType<typeof ok<void>> | ReturnType<typeof recusa>>();
      api.atualizar.mockReturnValue(resposta);
      pagina.abrirEdicao(COMUM);
      pagina.form.controls.descricao.disable();
      const pendente = pagina.salvar();
      fixture.detectChanges();
      expect(host.querySelector('input[formControlName="nome"]:disabled')).not.toBeNull();
      expect(host.querySelector('textarea[formControlName="descricao"]:disabled')).not.toBeNull();
      resposta.next(sucesso ? ok(undefined) : recusa('erro', 409));
      resposta.complete();
      await pendente;
      fixture.detectChanges();
      expect(pagina.form.controls.descricao.disabled).toBe(true);
      if (!sucesso) {
        expect(host.querySelector('input[formControlName="nome"]:disabled')).toBeNull();
        expect(host.querySelector('textarea[formControlName="descricao"]:disabled')).not.toBeNull();
      }
    },
  );

  it('mostra a recusa do servidor no campo e leva o foco a ele', async () => {
    const { fixture, host, pagina } = await abrir();
    const resposta = new Subject<ReturnType<typeof recusa>>();
    api.criar.mockReturnValue(resposta);
    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
    fixture.detectChanges();
    const botao = presente(host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'));
    botao.focus();
    botao.click();
    fixture.detectChanges();

    resposta.next(
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
    );
    resposta.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const campo = presente(host.querySelector<HTMLInputElement>('input[formControlName="nome"]'));
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe('cfg-perfil-erro-nome');
    expect(host.textContent).toContain('Nome recusado.');
    expect(document.activeElement).toBe(campo);
  });

  it('o envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
    const { fixture, host, pagina } = await abrir();
    pagina.abrirCriacao();
    fixture.detectChanges();
    await fixture.whenStable();
    const botao = presente(host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'));
    botao.focus();
    botao.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(host.querySelector('input[formControlName="nome"]'));
    expect(api.criar).not.toHaveBeenCalled();
  });

  it('impede escritas concorrentes durante a mudança de situação', async () => {
    const { fixture, host, pagina } = await abrir();
    const resposta = new Subject<ReturnType<typeof ok<void>>>();
    api.desativar.mockReturnValue(resposta);
    const pendente = pagina.alternarAtivacao(COMUM);
    fixture.detectChanges();

    expect(pagina.gravando()).toBe(true);
    expect(pagina.salvando()).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('button.btn--primary')?.disabled).toBe(true);
    expect(
      host.querySelector<HTMLButtonElement>(
        'button[aria-label="Editar o perfil Operador de inscrições"]',
      )?.disabled,
    ).toBe(true);
    pagina.abrirCriacao();
    await pagina.alternarAtivacao(COMUM);
    await pagina.salvar();
    expect(api.desativar).toHaveBeenCalledTimes(1);
    expect(api.criar).not.toHaveBeenCalled();
    expect(pagina.formAberto()).toBe(false);

    resposta.next(ok(undefined));
    resposta.complete();
    await pendente;
  });

  it('cria o perfil com as permissões marcadas', async () => {
    const { pagina } = await abrir();
    api.criar.mockReturnValue(of(ok('novo')));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
    pagina.alternar('selecao:inscricoes:consultar');
    await pagina.salvar();

    expect(api.criar.mock.calls[0]?.[0]).toEqual({
      nome: 'Consulta',
      descricao: 'Só consulta.',
      permissoes: ['selecao:inscricoes:consultar'],
    });
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil criado');
    expect(pagina.formAberto()).toBe(false);
  });

  it('depois de falha de rede, repete o mesmo perfil sob a mesma chave', async () => {
    const { pagina } = await abrir();
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.client.network_error', 0)))
      .mockReturnValueOnce(of(ok('novo')));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
    await pagina.salvar();
    await pagina.salvar();

    const [primeira, segunda] = api.criar.mock.calls;
    expect(segunda?.[0]).toEqual(primeira?.[0]);
    expect(segunda?.[1].get(IDEMPOTENCY_KEY_TOKEN)).toBe(primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN));
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil criado');
  });

  it('depois de falha de rede seguida de recusa definitiva, reabilita o formulário e a próxima tentativa usa chave nova', async () => {
    const { fixture, host, pagina } = await abrir();
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.client.network_error', 0)))
      .mockReturnValueOnce(of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)))
      .mockReturnValueOnce(of(ok('novo')));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
    await pagina.salvar();
    fixture.detectChanges();
    expect(host.querySelector<HTMLInputElement>('input[formControlName="nome"]')?.readOnly).toBe(
      true,
    );
    await pagina.salvar();
    fixture.detectChanges();
    expect(host.querySelector<HTMLInputElement>('input[formControlName="nome"]')?.readOnly).toBe(
      false,
    );
    pagina.form.patchValue({ nome: 'Consulta 2' });
    await pagina.salvar();

    const [primeira, , terceira] = api.criar.mock.calls;
    expect(terceira?.[1].get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(
      primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN),
    );
  });

  it('edita o perfil partindo das permissões que ele já tem', async () => {
    const { pagina } = await abrir();
    api.atualizar.mockReturnValue(of(ok(undefined)));

    pagina.abrirEdicao(COMUM);
    pagina.alternar('selecao:processos:configurar');
    await pagina.salvar();

    expect(api.atualizar.mock.calls[0]?.slice(0, 2)).toEqual([
      'p1',
      {
        id: 'p1',
        nome: 'Operador de inscrições',
        descricao: 'Opera as inscrições.',
        permissoes: [],
      },
    ]);
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil atualizado');
  });

  it('não salva sem nome e descrição', async () => {
    const { pagina } = await abrir();

    pagina.abrirCriacao();
    await pagina.salvar();

    expect(api.criar).not.toHaveBeenCalled();
  });

  it('mostra a recusa da API no formulário e o mantém aberto', async () => {
    const { pagina } = await abrir();
    api.criar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.erro_qualquer', 422)));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Operador', descricao: 'x' });
    await pagina.salvar();

    expect(pagina.erroDoForm()).toBe('Recusado');
    expect(pagina.formAberto()).toBe(true);
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it.each(['criar', 'atualizar'] as const)(
    'a falha de servidor ao %s o perfil vira notificação, sem aviso de sucesso',
    async (operacao) => {
      const { pagina } = await abrir();
      api[operacao].mockReturnValue(of(recusa('uniplus.internal.unexpected', 500, 'Erro interno')));

      if (operacao === 'criar') pagina.abrirCriacao();
      else pagina.abrirEdicao(COMUM);
      pagina.form.patchValue({ nome: 'Operador', descricao: 'x' });
      await pagina.salvar();

      expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
      expect(notificacoes.errorFromProblem.mock.calls[0]?.[1]).toEqual({ title: 'Erro interno' });
      expect(notificacoes.success).not.toHaveBeenCalled();
    },
  );

  it('a falha de servidor ao mudar a situação vira notificação', async () => {
    const { pagina } = await abrir();
    api.desativar.mockReturnValue(of(recusa('uniplus.internal.unexpected', 500, 'Erro interno')));

    await pagina.alternarAtivacao(COMUM);

    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('o nome já existente (409) marca o campo, renova a chave e não vai para o alerta geral', async () => {
    const { pagina } = await abrir();
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)))
      .mockReturnValueOnce(of(ok('novo')));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Operador', descricao: 'x' });
    await pagina.salvar();

    expect(pagina.erroDoForm()).toBeNull();
    expect(pagina.form.controls.nome.errors?.['backend']).toBeDefined();
    pagina.form.patchValue({ nome: 'Operador 2' });
    await pagina.salvar();
    const [primeira, segunda] = api.criar.mock.calls;
    expect(segunda?.[1].get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(
      primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN),
    );
  });

  it('reenviar sem editar o nome recusado volta a enviar a edição à API', async () => {
    const { pagina } = await abrir();
    api.atualizar
      .mockReturnValueOnce(of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)))
      .mockReturnValueOnce(of(ok('comum')));

    pagina.abrirEdicao(COMUM);
    await pagina.salvar();
    expect(pagina.form.controls.nome.hasError('backend')).toBe(true);

    await pagina.salvar();

    expect(api.atualizar).toHaveBeenCalledTimes(2);
  });

  it('a edição com nome já existente marca o campo; o conflito de processamento mantém a chave e fala no alerta', async () => {
    const { pagina } = await abrir();
    api.atualizar
      .mockReturnValueOnce(of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)))
      .mockReturnValueOnce(of(recusa('uniplus.idempotency.processing_conflict', 409)))
      .mockReturnValueOnce(of(recusa('uniplus.idempotency.processing_conflict', 409)));

    pagina.abrirEdicao(COMUM);
    await pagina.salvar();
    expect(pagina.erroDoForm()).toBeNull();
    expect(pagina.form.controls.nome.hasError('backend')).toBe(true);

    pagina.form.patchValue({ nome: 'Outro nome' });
    await pagina.salvar();
    await pagina.salvar();

    expect(pagina.erroDoForm()).toBe('Recusado');
    const [, segunda, terceira] = api.atualizar.mock.calls;
    expect(terceira?.[2].get(IDEMPOTENCY_KEY_TOKEN)).toBe(segunda?.[2].get(IDEMPOTENCY_KEY_TOKEN));
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it('desativa o perfil ativo e reativa o desativado', async () => {
    const { fixture, pagina } = await abrir();
    api.desativar.mockReturnValue(of(ok(undefined)));
    api.ativar.mockReturnValue(of(ok(undefined)));

    await pagina.alternarAtivacao(COMUM);
    fixture.detectChanges();
    await fixture.whenStable();
    await pagina.alternarAtivacao({ ...COMUM, ativo: false });

    expect(api.desativar.mock.calls[0]?.[0]).toBe('p1');
    expect(api.ativar.mock.calls[0]?.[0]).toBe('p1');
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil desativado');
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil reativado');
  });

  it('mostra a recusa da mudança de situação', async () => {
    const { pagina } = await abrir();
    api.desativar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.governanca_imutavel')));

    await pagina.alternarAtivacao(COMUM);

    expect(pagina.erroDaAcao()).toBe('Recusado');
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  describe('lista indisponível e foco durante a escrita', () => {
    const titulo = (host: HTMLElement) => presente(host.querySelector('#cfg-perfis-titulo'));
    const botaoDaLinha = (host: HTMLElement, rotulo: string) =>
      presente(host.querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`));
    // O navegador tira o foco de um botão que se desabilita; o jsdom não, então o teste o tira.
    const perderOFoco = (host: HTMLElement) => {
      const provisorio = host.appendChild(document.createElement('button'));
      provisorio.focus();
      provisorio.remove();
      expect(document.activeElement).toBe(document.body);
    };
    const assentar = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
      await new Promise((resolver) => setTimeout(resolver));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
    };

    it('anuncia o andamento e o desfecho da mudança de situação, com a lista indisponível', async () => {
      const { fixture, host, pagina } = await abrir();
      const resposta = new Subject<ReturnType<typeof ok<void>>>();
      api.desativar.mockReturnValue(resposta);
      const anuncio = () => host.querySelector('.sr-only[role="status"]')?.textContent?.trim();

      const pendente = pagina.alternarAtivacao(COMUM);
      fixture.detectChanges();
      expect(anuncio()).toBe('Desativando o perfil Operador de inscrições.');
      expect(
        host.querySelector<HTMLButtonElement>(
          'button[aria-label="Desativar o perfil Operador de inscrições"]',
        )?.disabled,
      ).toBe(true);

      resposta.next(ok(undefined));
      resposta.complete();
      await pendente;
      await assentar(fixture);
      expect(anuncio()).toBe('Perfil Operador de inscrições desativado.');
    });

    it('com a mudança de situação pendente, "Tentar novamente" fica indisponível e não recarrega', async () => {
      vi.resetAllMocks();
      api.listar.mockReturnValue(of(recusa('uniplus.internal.unexpected', 500, 'Erro interno')));
      api.catalogoDePermissoes.mockReturnValue(of(ok(CATALOGO)));
      const { fixture, host, pagina } = await abrirComListagem();
      const resposta = new Subject<ReturnType<typeof ok<void>>>();
      api.desativar.mockReturnValue(resposta);
      const tentar = presente(
        [...host.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('Tentar novamente'),
        ),
      );
      expect(tentar.getAttribute('aria-disabled')).toBeNull();

      void pagina.alternarAtivacao(COMUM);
      fixture.detectChanges();
      const consultas = api.listar.mock.calls.length;
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      fixture.detectChanges();
      expect(api.listar.mock.calls.length).toBe(consultas);
    });

    it('depois de reativar, devolve o foco ao botão da mesma linha', async () => {
      vi.resetAllMocks();
      api.listar.mockReturnValue(of(ok([{ ...COMUM, ativo: false }, GOVERNANCA])));
      api.catalogoDePermissoes.mockReturnValue(of(ok(CATALOGO)));
      const { fixture, host } = await abrirComListagem();
      const resposta = new Subject<ReturnType<typeof ok<void>>>();
      api.ativar.mockReturnValue(resposta);
      const acionador = botaoDaLinha(host, 'Reativar o perfil Operador de inscrições');
      acionador.focus();
      acionador.click();
      fixture.detectChanges();
      expect(acionador.disabled).toBe(true);
      perderOFoco(host);

      api.listar.mockReturnValue(of(ok([COMUM, GOVERNANCA])));
      resposta.next(ok(undefined));
      resposta.complete();
      await assentar(fixture);

      expect(api.ativar.mock.calls[0]?.[0]).toBe('p1');
      const reativado = botaoDaLinha(host, 'Desativar o perfil Operador de inscrições');
      expect(document.activeElement).toBe(reativado);
      expect(reativado.closest('tr')?.textContent).toContain('Operador de inscrições');
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
      expect(acionador.disabled).toBe(true);
      perderOFoco(host);

      resposta.next(ok(undefined));
      resposta.complete();
      await assentar(fixture);

      expect(document.activeElement).toBe(botaoDaLinha(host, rotulo));
    });

    it('depois de salvar a edição, devolve o foco ao botão Editar da linha', async () => {
      const { fixture, host, pagina } = await abrir();
      api.atualizar.mockReturnValue(of(ok(undefined)));
      botaoDaLinha(host, 'Editar o perfil Operador de inscrições').click();
      await assentar(fixture);
      expect(pagina.formAberto()).toBe(true);

      await pagina.salvar();
      await assentar(fixture);

      expect(pagina.formAberto()).toBe(false);
      expect(document.activeElement).toBe(
        botaoDaLinha(host, 'Editar o perfil Operador de inscrições'),
      );
    });

    it('depois de criar, devolve o foco ao botão Novo perfil', async () => {
      const { fixture, host, pagina } = await abrir();
      api.criar.mockReturnValue(of(ok('novo')));
      const novo = presente(host.querySelector<HTMLButtonElement>('#cfg-perfis-novo'));
      novo.click();
      await assentar(fixture);
      pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });

      await pagina.salvar();
      await assentar(fixture);

      expect(document.activeElement).toBe(novo);
    });

    it('se a recarga não traz mais a linha, o foco vai ao título da lista', async () => {
      const { fixture, host, pagina } = await abrir();
      api.atualizar.mockReturnValue(of(ok(undefined)));
      botaoDaLinha(host, 'Editar o perfil Operador de inscrições').click();
      await assentar(fixture);
      api.listar.mockReturnValue(of(ok([GOVERNANCA])));

      await pagina.salvar();
      await assentar(fixture);

      expect(document.activeElement).toBe(titulo(host));
    });

    it('Enter num campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async () => {
      const { fixture, host, pagina } = await abrir();
      const resposta = new Subject<ReturnType<typeof recusa>>();
      api.criar.mockReturnValue(resposta);
      pagina.abrirCriacao();
      pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
      await assentar(fixture);
      const nome = presente(host.querySelector<HTMLInputElement>('input[formControlName="nome"]'));
      nome.focus();

      nome.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      const botao = presente(
        host.querySelector<HTMLButtonElement>('button[form="cfg-perfil-form"]'),
      );
      expect(nome.matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(botao);

      resposta.next(recusa('uniplus.internal.unexpected', 500, 'Erro interno'));
      resposta.complete();
      await assentar(fixture);
      expect(host.textContent).toContain('Erro interno');
      expect(nome.matches(':disabled')).toBe(false);
      expect(document.activeElement).toBe(botao);
      expect(api.criar).toHaveBeenCalledTimes(1);
    });

    it('a recusa da lista por falta de permissão não oferece nova tentativa', async () => {
      vi.resetAllMocks();
      api.listar.mockReturnValue(of(recusa('uniplus.x', 403, 'Sem permissão para os perfis')));
      api.catalogoDePermissoes.mockReturnValue(of(ok(CATALOGO)));
      const { host } = await abrirComListagem();

      expect(host.textContent).toContain('Sem permissão para os perfis');
      expect(host.textContent).not.toContain('Tentar novamente');
    });

    it('a recusa do catálogo por falta de permissão não oferece nova tentativa', async () => {
      const { fixture, host, pagina } = await abrir();
      api.catalogoDePermissoes.mockReset();
      api.catalogoDePermissoes.mockReturnValue(
        of(recusa('uniplus.x', 403, 'Sem permissão para o catálogo')),
      );
      pagina.abrirCriacao();
      await assentar(fixture);

      expect(host.textContent).toContain('Sem permissão para o catálogo');
      expect(host.textContent).not.toContain('Tentar novamente');
    });

    describe('catálogo de permissões indisponível', () => {
      async function abrirComCatalogoIndisponivel() {
        const aberta = await abrir();
        document.body.append(aberta.host);
        api.catalogoDePermissoes.mockReset();
        api.catalogoDePermissoes
          .mockReturnValueOnce(of(recusa('uniplus.internal.unexpected', 503, 'Indisponível')))
          .mockReturnValue(of(ok(CATALOGO)));
        aberta.pagina.abrirCriacao();
        await assentar(aberta.fixture);
        const tentar = presente(
          [...aberta.host.querySelectorAll('button')].find((b) =>
            b.textContent?.includes('Tentar novamente'),
          ),
        );
        return { ...aberta, tentar };
      }

      it('"Tentar novamente" recarrega o catálogo e leva o foco ao grupo de permissões', async () => {
        const { fixture, host, tentar } = await abrirComCatalogoIndisponivel();
        expect(host.textContent).toContain('Catálogo indisponível');
        const consultas = api.catalogoDePermissoes.mock.calls.length;
        tentar.focus();

        tentar.click();
        await assentar(fixture);

        expect(api.catalogoDePermissoes.mock.calls.length).toBe(consultas + 1);
        expect(host.textContent).not.toContain('Catálogo indisponível');
        expect(host.querySelectorAll('label.checkbox').length).toBeGreaterThan(0);
        expect(document.activeElement).toBe(host.querySelector('#cfg-perfil-permissoes'));
        host.remove();
      });

      it('o botão fica indisponível enquanto o catálogo carrega e não pede de novo', async () => {
        const { fixture, host, tentar } = await abrirComCatalogoIndisponivel();
        const resposta = new Subject<ReturnType<typeof ok>>();
        api.catalogoDePermissoes.mockReturnValue(resposta);
        tentar.click();
        fixture.detectChanges();
        const consultas = api.catalogoDePermissoes.mock.calls.length;

        expect(tentar.getAttribute('aria-disabled')).toBe('true');
        tentar.click();
        await new Promise((resolver) => setTimeout(resolver));
        fixture.detectChanges();
        expect(api.catalogoDePermissoes.mock.calls.length).toBe(consultas);
        resposta.next(ok(CATALOGO));
        resposta.complete();
        await assentar(fixture);
        host.remove();
      });
    });
  });
});
