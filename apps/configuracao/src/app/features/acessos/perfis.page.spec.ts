import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PerfisApi, type PerfilDto } from '@uniplus/shared-data/autorizacao';
import { PerfisPage } from './perfis.page';
import { ok, recusa } from './testes';

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
    recursos: [
      {
        recurso: 'processos',
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
        recurso: 'inscricoes',
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

interface Interna {
  abrirCriacao(): void;
  abrirEdicao(p: PerfilDto): void;
  alternar(codigo: string): void;
  salvar(): Promise<void>;
  alternarAtivacao(p: PerfilDto): Promise<void>;
  form: { patchValue(v: object): void; readonly disabled: boolean; readonly enabled: boolean };
  erroDoForm(): string | null;
  erroDaAcao(): string | null;
  formAberto(): boolean;
}

describe('PerfisPage', () => {
  const api = {
    listar: vi.fn(),
    catalogoDePermissoes: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    ativar: vi.fn(),
    desativar: vi.fn(),
  };
  const notificacoes = { success: vi.fn() };

  function abrir() {
    vi.resetAllMocks();
    api.listar.mockReturnValue(of(ok([COMUM, GOVERNANCA])));
    api.catalogoDePermissoes.mockReturnValue(of(ok(CATALOGO)));
    TestBed.configureTestingModule({
      providers: [
        { provide: PerfisApi, useValue: api },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    const fixture = TestBed.createComponent(PerfisPage);
    fixture.detectChanges();
    return {
      fixture,
      host: fixture.nativeElement as HTMLElement,
      pagina: fixture.componentInstance as unknown as Interna,
    };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('lista os perfis e só deixa editar o perfil comum', () => {
    const { host } = abrir();

    expect(host.textContent).toContain('Operador de inscrições');
    expect(
      host.querySelector('button[aria-label="Editar o perfil Operador de inscrições"]'),
    ).not.toBeNull();
    expect(host.querySelector('button[aria-label="Editar o perfil Gestor de acessos"]')).toBeNull();
    expect(host.textContent).toContain('Governança');
  });

  it('oferece as permissões do catálogo agrupadas por módulo e recurso', () => {
    const { fixture, host, pagina } = abrir();

    pagina.abrirCriacao();
    fixture.detectChanges();

    const grupos = [...host.querySelectorAll('fieldset fieldset legend')].map((l) =>
      l.textContent?.trim(),
    );
    expect(grupos).toEqual(['selecao · processos', 'selecao · inscricoes']);
    expect(host.textContent).toContain('selecao:inscricoes:consultar');
  });

  it('cria o perfil com as permissões marcadas', async () => {
    const { pagina } = abrir();
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
    const { pagina } = abrir();
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
    const { pagina } = abrir();
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.client.network_error', 0)))
      .mockReturnValueOnce(of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)))
      .mockReturnValueOnce(of(ok('novo')));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Consulta', descricao: 'Só consulta.' });
    await pagina.salvar();
    expect(pagina.form.disabled).toBe(true);
    await pagina.salvar();
    expect(pagina.form.enabled).toBe(true);
    pagina.form.patchValue({ nome: 'Consulta 2' });
    await pagina.salvar();

    const [primeira, , terceira] = api.criar.mock.calls;
    expect(terceira?.[1].get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(
      primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN),
    );
  });

  it('edita o perfil partindo das permissões que ele já tem', async () => {
    const { pagina } = abrir();
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
    const { pagina } = abrir();

    pagina.abrirCriacao();
    await pagina.salvar();

    expect(api.criar).not.toHaveBeenCalled();
  });

  it('mostra a recusa da API no formulário e o mantém aberto', async () => {
    const { pagina } = abrir();
    api.criar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)));

    pagina.abrirCriacao();
    pagina.form.patchValue({ nome: 'Operador', descricao: 'x' });
    await pagina.salvar();

    expect(pagina.erroDoForm()).toBe('Recusado');
    expect(pagina.formAberto()).toBe(true);
  });

  it('desativa o perfil ativo e ativa o desativado', async () => {
    const { pagina } = abrir();
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
    const { pagina } = abrir();
    api.desativar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.governanca_imutavel')));

    await pagina.alternarAtivacao(COMUM);

    expect(pagina.erroDaAcao()).toBe('Recusado');
  });
});
