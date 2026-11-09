import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, map, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  VersoesDoPerfilApi,
  type EtapaDaVersao,
  type ItemDaFilaDeVersoesDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa } from '../testes';
import { propostaPorQuemLe } from './autoria-da-versao';
import { DecisaoDaVersao } from './decisao-da-versao';
import { DocumentoDaVersaoService } from './documento-da-versao.service';
import { FilaDeVersoesPage } from './fila-de-versoes.page';
import { versaoPendente } from './perfis.testing';

vi.mock('./autoria-da-versao', () => ({ propostaPorQuemLe: vi.fn(() => false) }));

function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

const ITEM: ItemDaFilaDeVersoesDto = {
  perfilId: 'p1',
  perfilNome: 'Operador de inscrições',
  versao: versaoPendente(),
};
const OUTRO: ItemDaFilaDeVersoesDto = {
  perfilId: 'p3',
  perfilNome: 'Auditoria',
  versao: versaoPendente({ versaoId: 'v7', numero: 4, situacaoDoDocumento: 'em_verificacao' }),
};

describe('FilaDeVersoesPage', () => {
  const versoes = { aprovar: vi.fn(), recusar: vi.fn() };
  const documento = { abrir: vi.fn() };
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  const leitura = vi.fn();

  const assentar = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(
    etapa: EtapaDaVersao,
    fila: unknown = ok([ITEM, OUTRO]),
  ) {
    leitura.mockReturnValue(of(fila));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMensagensDeAcesso(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) =>
              leitura(req.params.get('fila')).pipe(
                map((body: unknown) => new HttpResponse({ body })),
              ),
          ]),
        ),
        { provide: VersoesDoPerfilApi, useValue: versoes },
        { provide: DocumentoDaVersaoService, useValue: documento },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    const fixture = TestBed.createComponent(FilaDeVersoesPage);
    fixture.componentRef.setInput('etapa', etapa);
    await assentar(fixture);
    return {
      fixture,
      host: fixture.nativeElement as HTMLElement,
      decisao: fixture.debugElement.injector.get(DecisaoDaVersao),
    };
  }

  const secao = (host: HTMLElement, perfil: string): HTMLElement =>
    presente(
      [...host.querySelectorAll<HTMLElement>('section.panel')].find((s) =>
        s.textContent?.includes(perfil),
      ),
    );
  const botao = (area: HTMLElement, texto: string): HTMLButtonElement | undefined =>
    [...area.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  it.each([
    ['gestao_de_acessos', 'Versões de perfil na gestão de acessos'],
    ['protecao_de_dados', 'Versões de perfil na proteção de dados'],
  ] as const)('a etapa %s lê a própria fila e tem o próprio título', async (etapa, titulo) => {
    const { host } = await abrir(etapa);

    expect(leitura).toHaveBeenCalledWith(etapa);
    expect(host.querySelector('h1')?.textContent).toContain(titulo);
  });

  it('lista cada versão com o perfil, o que muda e a etapa em que está', async () => {
    const { host } = await abrir('gestao_de_acessos');

    expect(host.querySelectorAll('section.panel')).toHaveLength(2);
    const primeira = secao(host, 'Operador de inscrições');
    expect(primeira.querySelector('a')?.getAttribute('href')).toBe('/acessos/perfis/p1');
    expect(primeira.textContent).toContain('versão 2');
    expect(primeira.textContent).toContain('Acrescentadas (1)');
    expect(primeira.textContent).toContain('Aprovar processos');
  });

  it('mostra o nome e a descrição propostos junto com o nome em vigor, e aprova a mudança só de texto', async () => {
    const textual: ItemDaFilaDeVersoesDto = {
      perfilId: 'p5',
      perfilNome: 'Operador',
      versao: versaoPendente({
        versaoId: 'v9',
        nome: 'Operador de processos',
        descricao: 'Opera os processos seletivos.',
        acrescimo: [],
        remocao: [],
      }),
    };
    const { fixture, host } = await abrir('gestao_de_acessos', ok([textual]));
    versoes.aprovar.mockReturnValue(of(ok({})));

    const area = secao(host, 'Operador');
    expect(area.textContent).toContain('Operador de processos');
    expect(area.textContent).toContain('(em vigor: Operador)');
    expect(area.textContent).toContain('Opera os processos seletivos.');

    presente(botao(area, 'Aprovar')).click();
    await assentar(fixture);

    expect(versoes.aprovar).toHaveBeenCalledWith('p5', 'v9', 'gestao_de_acessos', expect.anything());
  });

  it('diz que a fila está vazia', async () => {
    const { host } = await abrir('protecao_de_dados', ok([]));

    expect(host.textContent).toContain('Nenhuma versão aguarda a sua aprovação.');
  });

  it('aprova a etapa da fila, avisa e relê a fila', async () => {
    const { fixture, host } = await abrir('protecao_de_dados');
    versoes.aprovar.mockReturnValue(of(ok({})));

    presente(botao(secao(host, 'Operador de inscrições'), 'Aprovar')).click();
    await assentar(fixture);

    expect(versoes.aprovar).toHaveBeenCalledWith('p1', 'v2', 'protecao_de_dados', expect.anything());
    expect(notificacoes.success).toHaveBeenCalledWith('Versão aprovada', 'Operador de inscrições');
    expect(leitura).toHaveBeenCalledTimes(2);
  });

  it('não oferece aprovar a versão que a própria pessoa propôs, e explica', async () => {
    vi.mocked(propostaPorQuemLe).mockImplementation((item) => item.versao.versaoId === 'v2');
    const { host } = await abrir('gestao_de_acessos');

    const propria = secao(host, 'Operador de inscrições');
    expect(botao(propria, 'Aprovar')).toBeUndefined();
    expect(botao(propria, 'Recusar')).toBeDefined();
    expect(propria.textContent).toContain('Você propôs esta versão. Outra pessoa precisa aprová-la.');
    expect(botao(secao(host, 'Auditoria'), 'Aprovar')).toBeDefined();
  });

  it('segura a aprovação enquanto o documento não foi verificado e diz por quê', async () => {
    const { host } = await abrir('gestao_de_acessos');

    const area = secao(host, 'Auditoria');
    const aprovar = presente(botao(area, 'Aprovar'));
    expect(aprovar.disabled).toBe(true);
    expect(area.textContent).toContain('A aprovação espera a verificação do documento instituidor.');
    expect(aprovar.getAttribute('aria-describedby')).toBe(`cfg-versao-ajuda-v7`);
    expect(presente(botao(secao(host, 'Operador de inscrições'), 'Aprovar')).disabled).toBe(false);
  });

  it('mostra a recusa da API junto à versão, sem afetar as outras', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    versoes.aprovar.mockReturnValue(
      of(recusa('uniplus.autorizacao.perfil.decisor_e_autor', 422)),
    );

    presente(botao(secao(host, 'Operador de inscrições'), 'Aprovar')).click();
    await assentar(fixture);

    expect(secao(host, 'Operador de inscrições').textContent).toContain(
      'Quem criou a versão não pode aprová-la nem recusá-la.',
    );
    expect(secao(host, 'Auditoria').textContent).not.toContain('Quem criou a versão não pode aprová-la nem recusá-la.');
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  describe('recusar', () => {
    it('exige o motivo antes de chamar a API', async () => {
      const { fixture, host, decisao } = await abrir('gestao_de_acessos');

      presente(botao(secao(host, 'Operador de inscrições'), 'Recusar')).click();
      await assentar(fixture);
      expect(decisao.aberto()).toBe(true);
      await decisao.recusar('gestao_de_acessos');

      expect(versoes.recusar).not.toHaveBeenCalled();
      expect(decisao.motivo.invalid).toBe(true);
      expect(decisao.tentouRecusar()).toBe(true);
    });

    it('recusa a etapa da fila com o motivo, fecha o diálogo e relê a fila', async () => {
      const { fixture, host, decisao } = await abrir('protecao_de_dados');
      versoes.recusar.mockReturnValue(of(ok({})));

      presente(botao(secao(host, 'Operador de inscrições'), 'Recusar')).click();
      decisao.motivo.setValue(' Sem base legal. ');
      await decisao.recusar('protecao_de_dados');
      await assentar(fixture);

      expect(versoes.recusar).toHaveBeenCalledWith(
        'p1',
        'v2',
        { etapa: 'protecao_de_dados', motivo: 'Sem base legal.' },
        expect.anything(),
      );
      expect(decisao.aberto()).toBe(false);
      expect(notificacoes.success).toHaveBeenCalledWith('Versão recusada', 'Operador de inscrições');
    });

    it('mostra a recusa da API no diálogo e o mantém aberto', async () => {
      const { host, decisao } = await abrir('gestao_de_acessos');
      versoes.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.perfil.etapa_ja_decidida', 409)));

      presente(botao(secao(host, 'Operador de inscrições'), 'Recusar')).click();
      decisao.motivo.setValue('Sem base.');
      await decisao.recusar('gestao_de_acessos');

      expect(decisao.erroDaRecusa()).toContain('A etapa já tem decisão para esta versão');
      expect(decisao.aberto()).toBe(true);
    });
  });

  it('fica indisponível durante a decisão', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    const resposta = new Subject<ReturnType<typeof ok<object>>>();
    versoes.aprovar.mockReturnValue(resposta);

    presente(botao(secao(host, 'Operador de inscrições'), 'Aprovar')).click();
    fixture.detectChanges();

    const decisoes = [...host.querySelectorAll<HTMLButtonElement>('section button')].filter((b) =>
      ['Aprovar', 'Recusar'].includes(b.textContent?.trim() ?? ''),
    );
    expect(decisoes).toHaveLength(4);
    expect(decisoes.every((b) => b.disabled)).toBe(true);
    resposta.next(ok({}));
    resposta.complete();
    await assentar(fixture);
  });

  it('abre o documento da versão e avisa quando o navegador bloqueia', async () => {
    const { fixture, host } = await abrir('gestao_de_acessos');
    documento.abrir.mockResolvedValue('bloqueada');

    presente(botao(secao(host, 'Operador de inscrições'), 'Abrir documento')).click();
    await assentar(fixture);

    expect(documento.abrir).toHaveBeenCalledWith('p1', 'v2', expect.any(Function));
    expect(secao(host, 'Operador de inscrições').textContent).toContain(
      'O navegador bloqueou a abertura do documento.',
    );
  });

  it('com a leitura falha, oferece tentar novamente', async () => {
    const { fixture, host } = await abrir(
      'gestao_de_acessos',
      recusa('uniplus.internal.unexpected', 500, 'Erro interno'),
    );
    leitura.mockReturnValue(of(ok([ITEM])));

    presente(botao(host, 'Tentar novamente')).click();
    await assentar(fixture);

    expect(host.querySelectorAll('section.panel')).toHaveLength(1);
  });

  it('sem permissão para a fila, mostra a recusa sem oferecer nova tentativa', async () => {
    const { host } = await abrir('gestao_de_acessos', recusa('uniplus.forbidden', 403));

    expect(botao(host, 'Tentar novamente')).toBeUndefined();
  });
});
