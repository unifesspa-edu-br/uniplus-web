import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  PerfisApi,
  VersoesDoPerfilApi,
  type PerfilDto,
} from '@uniplus/shared-data/autorizacao';
import { EdicaoDosPerfis } from '../edicao-dos-perfis';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa } from '../testes';
import { CancelamentoDaVersao } from './cancelamento-da-versao';
import { DocumentoDaVersaoService } from './documento-da-versao.service';
import { PerfilDetalhePage } from './perfil-detalhe.page';
import { ESCRITA, LEITURA, perfilDoDetalhe, versaoPendente } from './perfis.testing';
import { RemocaoDePermissoes } from './remocao-de-permissoes';

function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

describe('PerfilDetalhePage', () => {
  const perfis = { remover: vi.fn(), criar: vi.fn() };
  const versoes = { cancelar: vi.fn(), propor: vi.fn() };
  const documento = { reenviar: vi.fn(), abrir: vi.fn(), enviar: vi.fn() };
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  const leitura = vi.fn();

  const assentar = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(resposta: unknown = ok(perfilDoDetalhe())) {
    leitura.mockReturnValue(of(resposta));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMensagensDeAcesso(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) =>
              (req.url.endsWith('/permissoes') ? of(ok([])) : leitura()).pipe(
                map((body: unknown) => new HttpResponse({ body })),
              ),
          ]),
        ),
        { provide: PerfisApi, useValue: perfis },
        { provide: PermissoesService, useValue: { tem: () => true } },
        { provide: VersoesDoPerfilApi, useValue: versoes },
        { provide: DocumentoDaVersaoService, useValue: documento },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    const fixture = TestBed.createComponent(PerfilDetalhePage);
    fixture.componentRef.setInput('id', 'p1');
    await assentar(fixture);
    const injector = fixture.debugElement.injector;
    return {
      fixture,
      host: fixture.nativeElement as HTMLElement,
      edicao: injector.get(EdicaoDosPerfis),
      cancelamento: injector.get(CancelamentoDaVersao),
      remocao: injector.get(RemocaoDePermissoes),
    };
  }

  const botao = (host: HTMLElement, texto: string): HTMLButtonElement | undefined =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  it('mostra a versão em vigor com o protocolo e as permissões, e as ações do perfil ativo', async () => {
    const { host } = await abrir();

    expect(host.querySelector('h1')?.textContent).toContain('Operador de inscrições');
    expect(host.textContent).toContain('Em vigor');
    expect(host.textContent).toContain('P-1/2026');
    expect(host.textContent).toContain('selecao:processos:consultar');
    expect(botao(host, 'Propor nova versão')).toBeDefined();
    expect(botao(host, 'Remover permissões')).toBeDefined();
    expect(botao(host, 'Desativar')).toBeDefined();
    expect(botao(host, 'Cancelar versão pendente')).toBeUndefined();
  });

  it('com versão pendente, mostra o que muda, a etapa e oferece cancelar em vez de propor outra', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })));

    expect(host.textContent).toContain('Versão pendente de aprovação');
    expect(host.textContent).toContain('Aguarda gestão de acessos');
    expect(host.textContent).toContain('Acrescentadas (1)');
    expect(host.textContent).toContain('Aprovar processos');
    expect(botao(host, 'Cancelar versão pendente')).toBeDefined();
    expect(botao(host, 'Propor nova versão')).toBeUndefined();
  });

  it('com a janela de migração aberta, mostra o prazo e o caminho para a janela e não propõe versão nova', async () => {
    const janela = { id: 'j1', prazo: '2026-11-12T12:00:00Z', situacao: 'aberta' };
    const { host } = await abrir(ok(perfilDoDetalhe({ janela })));

    expect(host.textContent).toContain('Janela de migração aberta');
    expect(host.textContent).toContain('12/11/2026');
    expect(
      host.querySelector('a[href="/acessos/perfis/p1/janela"]')?.textContent,
    ).toContain('Abrir a janela de migração');
    expect(botao(host, 'Propor nova versão')).toBeUndefined();
    expect(botao(host, 'Remover permissões')).toBeDefined();
  });

  it('sem janela de migração, não mostra o aviso', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ janela: null })));

    expect(host.textContent).not.toContain('Janela de migração');
  });

  it('perfil suspenso mostra o estado, desde quando e as etapas da retomada', async () => {
    const { host } = await abrir(
      ok(
        perfilDoDetalhe({
          suspensao: {
            desde: '2026-11-09T15:00:00Z',
            papelDeQuemSuspendeu: 'gestao_de_acessos',
            etapasExigidasAgora: ['gestao_de_acessos', 'protecao_de_dados'],
            etapasDecididas: ['gestao_de_acessos'],
          },
        }),
      ),
    );

    expect(host.querySelector('.cfg-tags')?.textContent).toContain('Suspenso');
    expect(host.querySelector('cfg-suspensao-do-perfil')?.textContent).toContain(
      'Retomada pela proteção de dados: aguarda a decisão',
    );
  });

  it('perfil desativado mostra desde quando', async () => {
    const { host } = await abrir(
      ok(perfilDoDetalhe({ ativo: false, desativadoDesde: '2026-11-08T15:00:00Z' })),
    );

    expect(host.querySelector('.cfg-tags')?.textContent).toContain('Desativado');
    expect(host.querySelector('.cfg-tags')?.textContent).toContain('desde 08/11/2026');
  });

  it('perfil desativado só se reativa', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ ativo: false })));

    expect(host.textContent).toContain('Desativado');
    expect(botao(host, 'Reativar')).toBeDefined();
    expect(botao(host, 'Desativar')).toBeUndefined();
    expect(botao(host, 'Propor nova versão')).toBeUndefined();
  });

  it('o perfil de governança não oferece nenhuma ação', async () => {
    const { host } = await abrir(ok(perfilDoDetalhe({ governanca: 'gestor' })));

    expect(host.querySelector('.page-header__actions button')).toBeNull();
  });

  it('avisa que a última versão proposta não entrou em vigor', async () => {
    const { host } = await abrir(
      ok(
        perfilDoDetalhe({
          ultimaVersaoEncerradaSemVigor: {
            numero: 3,
            situacao: 'recusada',
            etapa: 'protecao_de_dados',
            instante: '2026-11-03T12:00:00Z',
          },
        }),
      ),
    );

    expect(host.textContent).toContain('A última versão proposta não entrou em vigor');
    expect(host.textContent).toContain('A versão 3 foi recusada.');
  });

  it('propor nova versão abre o formulário com as permissões em vigor marcadas', async () => {
    const { fixture, host, edicao } = await abrir();

    presente(botao(host, 'Propor nova versão')).click();
    await assentar(fixture);

    expect(edicao.formAberto()).toBe(true);
    expect(edicao.base()?.id).toBe('p1');
    expect([...edicao.marcadas()].sort()).toEqual([ESCRITA.codigo, LEITURA.codigo].sort());
  });

  it('propõe versão preenchendo só o protocolo e o PDF, sem mexer em nome, descrição nem permissões', async () => {
    const { fixture, host } = await abrir();
    versoes.propor.mockReturnValue(
      of(ok({ perfilId: 'p1', versaoId: 'v3', urlDeEnvio: 'https://armazenamento.test/u', tipoDeMidia: 'application/pdf', expiraEm: '2026-11-10T12:00:00Z' })),
    );
    documento.enviar.mockResolvedValue({ ok: true });
    presente(botao(host, 'Propor nova versão')).click();
    await assentar(fixture);

    const formulario = presente(host.querySelector<HTMLElement>('cfg-perfil-formulario'));
    const protocolo = presente(formulario.querySelector<HTMLInputElement>('input[formcontrolname="protocolo"]'));
    protocolo.value = 'P-9/2026';
    protocolo.dispatchEvent(new Event('input'));
    const envio = fixture.debugElement.query(
      (d) => d.name === 'ui-file-upload' && d.nativeElement.closest('cfg-perfil-formulario') !== null,
    );
    envio.componentInstance.selectedFile.set(new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' }));
    await assentar(fixture);
    presente(
      [...formulario.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].find((b) => b.textContent?.includes('Enviar proposta')),
    ).click();
    await assentar(fixture);

    expect(versoes.propor).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        nome: 'Operador de inscrições',
        protocolo: 'P-9/2026',
        permissoes: [ESCRITA.codigo, LEITURA.codigo].sort(),
      }),
      expect.anything(),
    );
    expect(documento.enviar).toHaveBeenCalled();
  });

  describe('cancelar a versão pendente', () => {
    const pendente = () => ok(perfilDoDetalhe({ versaoPendente: versaoPendente() }));

    it('exige o motivo antes de chamar a API', async () => {
      const { fixture, host, cancelamento } = await abrir(pendente());

      presente(botao(host, 'Cancelar versão pendente')).click();
      await assentar(fixture);
      expect(cancelamento.aberto()).toBe(true);
      await cancelamento.confirmar('p1', 'v2');

      expect(versoes.cancelar).not.toHaveBeenCalled();
      expect(cancelamento.motivo.invalid).toBe(true);
      expect(cancelamento.tentou()).toBe(true);
    });

    it('cancela com o motivo, fecha o diálogo, avisa e relê o perfil', async () => {
      const { fixture, cancelamento } = await abrir(pendente());
      versoes.cancelar.mockReturnValue(of(ok(perfilDoDetalhe())));
      cancelamento.abrir();
      cancelamento.motivo.setValue(' Engano na composição. ');
      leitura.mockReturnValue(of(ok(perfilDoDetalhe())));

      await cancelamento.confirmar('p1', 'v2');
      await assentar(fixture);

      expect(versoes.cancelar).toHaveBeenCalledWith('p1', 'v2', 'Engano na composição.', expect.anything());
      expect(cancelamento.aberto()).toBe(false);
      expect(notificacoes.success).toHaveBeenCalledWith('Versão pendente cancelada');
      expect(fixture.nativeElement.textContent).not.toContain('Versão pendente de aprovação');
    });

    it('mostra a recusa da API dentro do diálogo e o mantém aberto', async () => {
      const { cancelamento } = await abrir(pendente());
      versoes.cancelar.mockReturnValue(
        of(recusa('uniplus.autorizacao.perfil.versao_nao_pendente', 409)),
      );
      cancelamento.abrir();
      cancelamento.motivo.setValue('Engano.');

      await cancelamento.confirmar('p1', 'v2');

      expect(cancelamento.erro()).toContain('A versão já foi decidida, cancelada ou substituída');
      expect(cancelamento.aberto()).toBe(true);
    });
  });

  describe('remover permissões', () => {
    it('pede as permissões, o motivo e a categoria, e a remoção vale na hora', async () => {
      const { fixture, host, remocao } = await abrir();
      perfis.remover.mockReturnValue(of(ok(perfilDoDetalhe())));

      presente(botao(host, 'Remover permissões')).click();
      await assentar(fixture);
      expect(remocao.aberto()).toBe(true);
      await remocao.confirmar('p1');
      expect(perfis.remover).not.toHaveBeenCalled();
      expect(remocao.erroDasPermissoes()).toBe('Marque ao menos uma permissão a remover.');
      expect(remocao.form.controls.motivo.invalid).toBe(true);

      remocao.alternar(LEITURA.codigo);
      remocao.form.patchValue({ motivo: ' Acesso excessivo. ', categoria: 'erro_de_composicao' });
      await remocao.confirmar('p1');

      expect(perfis.remover).toHaveBeenCalledWith(
        'p1',
        { permissoes: [LEITURA.codigo], motivo: 'Acesso excessivo.', categoria: 'erro_de_composicao' },
        expect.anything(),
      );
      expect(remocao.aberto()).toBe(false);
      expect(notificacoes.success).toHaveBeenCalledWith('Permissões removidas');
    });

    it('mostra a recusa do motivo no campo e a das permissões junto à lista', async () => {
      const { remocao } = await abrir();
      remocao.abrir();
      remocao.alternar(LEITURA.codigo);
      remocao.form.patchValue({ motivo: 'x', categoria: 'incidente' });
      perfis.remover.mockReturnValue(
        of({
          ...recusa('validacao', 422),
          problem: {
            type: 'x',
            title: 'Recusado',
            status: 422,
            code: 'validacao',
            traceId: '',
            errors: [
              { field: 'Motivo', code: 'motivo_invalido', message: 'Motivo recusado.' },
              { field: 'Permissoes', code: 'permissao_inexistente', message: 'Permissão fora da versão.' },
            ],
          },
        }),
      );

      await remocao.confirmar('p1');

      expect(remocao.form.controls.motivo.errors).not.toBeNull();
      expect(remocao.erroDasPermissoes()).toBe('Permissão fora da versão.');
      expect(remocao.aberto()).toBe(true);
    });
  });

  describe('diálogo de remoção', () => {
    it('aponta o que falta ao confirmar vazio e lista as permissões em vigor com a sensibilidade', async () => {
      const { fixture, host, remocao } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })));

      presente(botao(host, 'Remover permissões')).click();
      await assentar(fixture);
      const dialogo = presente(host.querySelector<HTMLElement>('cfg-remocao-dialog'));
      expect(dialogo.textContent).toContain('Ela cancela a versão pendente.');
      expect(dialogo.textContent).toContain('Configurar processos');
      const confirmar = presente(
        [...dialogo.querySelectorAll('button')].find((b) => b.textContent?.includes('Remover permissões')),
      );
      confirmar.click();
      await assentar(fixture);

      expect(dialogo.textContent).toContain('Marque ao menos uma permissão a remover.');
      expect(dialogo.textContent).toContain('Campo obrigatório.');
      expect(remocao.aberto()).toBe(true);
      expect(perfis.remover).not.toHaveBeenCalled();
      expect(document.activeElement?.closest('fieldset.field')?.textContent).toContain(
        'Permissões a remover',
      );
    });

    it('leva o foco ao campo que a API recusou', async () => {
      const { fixture, host, remocao } = await abrir();
      presente(botao(host, 'Remover permissões')).click();
      await assentar(fixture);
      remocao.alternar(LEITURA.codigo);
      remocao.form.patchValue({ motivo: 'x', categoria: 'incidente' });
      perfis.remover.mockReturnValue(
        of({
          ...recusa('validacao', 422),
          problem: {
            type: 'x',
            title: 'Recusado',
            status: 422,
            code: 'validacao',
            traceId: '',
            errors: [{ field: 'Motivo', code: 'motivo_invalido', message: 'Motivo recusado.' }],
          },
        }),
      );
      const confirmar = presente(
        [...host.querySelectorAll<HTMLButtonElement>('cfg-remocao-dialog button')].find((b) =>
          b.textContent?.includes('Remover permissões'),
        ),
      );

      confirmar.click();
      await assentar(fixture);

      expect(document.activeElement?.tagName).toBe('TEXTAREA');
    });

    it('leva o foco ao aviso quando a recusa não é de campo', async () => {
      const { fixture, host, remocao } = await abrir();
      presente(botao(host, 'Remover permissões')).click();
      await assentar(fixture);
      remocao.alternar(LEITURA.codigo);
      remocao.form.patchValue({ motivo: 'x', categoria: 'incidente' });
      perfis.remover.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.sem_versao_em_vigor', 422)));
      const confirmar = presente(
        [...host.querySelectorAll<HTMLButtonElement>('cfg-remocao-dialog button')].find((b) =>
          b.textContent?.includes('Remover permissões'),
        ),
      );

      confirmar.click();
      await assentar(fixture);

      expect(document.activeElement?.id).toBe('cfg-remocao-aviso');
    });
  });

  describe('documento da versão pendente', () => {
    it('mostra a falha do envio junto ao campo e não avisa sucesso', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      const { fixture } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })));
      documento.reenviar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });
      const envio = fixture.debugElement.query(
        (d) => d.name === 'ui-file-upload' && d.nativeElement.closest('cfg-versao-pendente') !== null,
      );

      envio.componentInstance.selectedFile.set(new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' }));
      await assentar(fixture);

      expect(fixture.nativeElement.textContent).toContain('Falha ao enviar o arquivo.');
      expect(notificacoes.success).not.toHaveBeenCalled();
    });

    it('depois de falha no envio, relê a versão e oferece a tentativa do estado lido', async () => {
      const recusado = versaoPendente({ situacaoDoDocumento: 'recusado' });
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: recusado })));
      const aguardando = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      leitura.mockReturnValue(of(ok(perfilDoDetalhe({ versaoPendente: aguardando }))));
      documento.reenviar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });
      const chamadasAntes = leitura.mock.calls.length;
      const envio = fixture.debugElement.query(
        (d) => d.name === 'ui-file-upload' && d.nativeElement.closest('cfg-versao-pendente') !== null,
      );

      envio.componentInstance.selectedFile.set(new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' }));
      await assentar(fixture);

      expect(leitura.mock.calls.length).toBeGreaterThan(chamadasAntes);
      expect(host.textContent).toContain('Falta o documento instituidor');
      expect(host.textContent).not.toContain('A verificação recusou o documento enviado.');
    });

    it('depois de confirmação sem resposta, relê e deixa de oferecer o envio quando já está em verificação', async () => {
      const aguardando = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: aguardando })));
      const emVerificacao = versaoPendente({ situacaoDoDocumento: 'em_verificacao' });
      leitura.mockReturnValue(of(ok(perfilDoDetalhe({ versaoPendente: emVerificacao }))));
      documento.reenviar.mockResolvedValue({ ok: false, mensagem: 'Não foi possível confirmar o envio.' });
      const envio = fixture.debugElement.query(
        (d) => d.name === 'ui-file-upload' && d.nativeElement.closest('cfg-versao-pendente') !== null,
      );

      envio.componentInstance.selectedFile.set(new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' }));
      await assentar(fixture);

      expect(host.textContent).not.toContain('Falta o documento instituidor');
    });

    it('limpar a escolha do arquivo não envia nada', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      const { fixture } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })));
      const envio = fixture.debugElement.query(
        (d) => d.name === 'ui-file-upload' && d.nativeElement.closest('cfg-versao-pendente') !== null,
      );

      envio.componentInstance.selectedFile.set(null);
      await assentar(fixture);

      expect(documento.reenviar).not.toHaveBeenCalled();
    });

    it('oferece o envio quando o documento aguarda o arquivo e reemite o envio', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })));
      documento.reenviar.mockResolvedValue({ ok: true });
      const arquivo = new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' });

      expect(host.textContent).toContain('Falta o documento instituidor');
      const envio = fixture.debugElement.query((d) => d.name === 'ui-file-upload' && d.nativeElement.closest('cfg-versao-pendente') !== null);
      envio.componentInstance.selectedFile.set(arquivo);
      await assentar(fixture);

      expect(documento.reenviar).toHaveBeenCalledWith('p1', pendente, arquivo, expect.any(Function));
      expect(notificacoes.success).toHaveBeenCalledWith('Documento enviado', 'Ele segue para verificação.');
    });

    it('com o documento recusado na verificação, pede outro PDF', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'recusado' });
      const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })));

      expect(host.textContent).toContain('A verificação recusou o documento enviado.');
    });

    it('com o documento verificado, não pede arquivo e abre o documento numa aba', async () => {
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })));
      documento.abrir.mockResolvedValue('aberta');

      expect(host.querySelector('cfg-versao-pendente ui-file-upload')).toBeNull();
      const daPendente = [...host.querySelectorAll('cfg-versao-pendente button')].find(
        (b) => b.textContent?.trim() === 'Abrir documento',
      );
      (daPendente as HTMLButtonElement).click();
      await assentar(fixture);

      expect(documento.abrir).toHaveBeenCalledWith('p1', 'v2', expect.any(Function));
    });

    it('diz que o navegador bloqueou a aba do documento', async () => {
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })));
      documento.abrir.mockResolvedValue('bloqueada');

      presente(botao(host, 'Abrir documento')).click();
      await assentar(fixture);

      expect(documento.abrir).toHaveBeenCalledWith('p1', 'v1', expect.any(Function));
      expect(host.textContent).toContain('O navegador bloqueou a abertura do documento.');
    });
  });

  it('perfil que não existe mostra a recusa sem oferecer nova tentativa', async () => {
    const { host } = await abrir(recusa('uniplus.autorizacao.perfil.nao_encontrado', 404));

    expect(host.textContent).toContain('Perfil não encontrado');
    expect(botao(host, 'Tentar novamente')).toBeUndefined();
  });

  it('com a leitura falha, oferece tentar novamente', async () => {
    const { fixture, host } = await abrir(recusa('uniplus.internal.unexpected', 500, 'Erro interno'));
    leitura.mockReturnValue(of(ok<PerfilDto>(perfilDoDetalhe())));

    presente(botao(host, 'Tentar novamente')).click();
    await assentar(fixture);

    expect(host.querySelector('h1')?.textContent).toContain('Operador de inscrições');
  });
});
