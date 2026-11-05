import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { map } from 'rxjs';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { TestBed } from '@angular/core/testing';
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
  const notificacoes = { success: vi.fn() };

  async function abrir() {
    vi.resetAllMocks();
    api.listar.mockReturnValue(of(ok([COMUM, GOVERNANCA])));
    api.catalogoDePermissoes.mockReturnValue(of(ok(CATALOGO)));
    TestBed.configureTestingModule({
      providers: [
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
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Salvando perfil');
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
    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
    fixture.detectChanges();
    await pagina.salvar();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const campo = presente(host.querySelector<HTMLInputElement>('input[formControlName="nome"]'));
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Nome recusado.');
    expect(document.activeElement).toBe(campo);
  });

  it('impede escritas concorrentes durante a mudança de situação', async () => {
    const { fixture, host, pagina } = await abrir();
    const resposta = new Subject<ReturnType<typeof ok<void>>>();
    api.desativar.mockReturnValue(resposta);
    const pendente = pagina.alternarAtivacao(COMUM);
    fixture.detectChanges();

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
  });

  it('não salva sem nome e descrição', async () => {
    const { pagina } = await abrir();

    pagina.abrirCriacao();
    await pagina.salvar();

    expect(api.criar).not.toHaveBeenCalled();
  });

  it('mostra a recusa da API no formulário e o mantém aberto', async () => {
    const { pagina } = await abrir();
    api.criar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Operador', descricao: 'x' });
    await pagina.salvar();

    expect(pagina.erroDoForm()).toBe('Recusado');
    expect(pagina.formAberto()).toBe(true);
  });

  it('desativa o perfil ativo e ativa o desativado', async () => {
    const { pagina } = await abrir();
    api.desativar.mockReturnValue(of(ok(undefined)));
    api.ativar.mockReturnValue(of(ok(undefined)));

    await pagina.alternarAtivacao(COMUM);
    await pagina.alternarAtivacao({ ...COMUM, ativo: false });

    expect(api.desativar.mock.calls[0]?.[0]).toBe('p1');
    expect(api.ativar.mock.calls[0]?.[0]).toBe('p1');
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil desativado');
    expect(notificacoes.success).toHaveBeenCalledWith('Perfil ativado');
  });

  it('mostra a recusa da mudança de situação', async () => {
    const { pagina } = await abrir();
    api.desativar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.governanca_imutavel')));

    await pagina.alternarAtivacao(COMUM);

    expect(pagina.erroDaAcao()).toBe('Recusado');
  });
});
