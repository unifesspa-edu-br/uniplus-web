import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { ConcessaoDto, EventoDaTrilhaDto } from '@uniplus/shared-data/autorizacao';
import { ConcessaoDetalhePage } from './concessao-detalhe.page';
import { assentar, botao, botoes, leituras, pessoa, provedores } from './revisoes/revisao.testing';
import { ok, recusaPeloInterceptor } from './testes';

const CONSULTAR = PERMISSAO.autorizacao.concessoesConsultar;
const ID = 'c9';
const MOTIVO = 'Mudou de setor e não opera mais inscrições.';

const ATIVA: ConcessaoDto = {
  id: ID,
  beneficiario: pessoa('sub-fernanda', 'Fernanda Drumond'),
  perfil: { id: 'p1', nome: 'Operador de inscrições' },
  versao: 2,
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  origem: { tipo: 'pedido', id: 'pd1' },
  concedidaEm: '2026-03-02T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  revogadaPelaJanelaId: null,
  motivoRevogacao: null,
  ativa: true,
};

const REVOGADA: ConcessaoDto = {
  ...ATIVA,
  revogadaEm: '2026-11-10T13:00:00Z',
  revogadaPor: pessoa('sub-betina', 'Betina Neves'),
  motivoRevogacao: MOTIVO,
  ativa: false,
};

const TRILHA: EventoDaTrilhaDto[] = [
  {
    tipo: 'revisao_revogada',
    instante: '2026-11-10T13:00:00Z',
    autor: pessoa('sub-betina', 'Betina Neves'),
    detalhe: MOTIVO,
    ator: 'humano',
  },
];

function falhaDoRegistro() {
  const error = {
    type: 'x',
    title: 'Não foi possível registrar o acesso aos dados.',
    status: 503,
    code: 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar',
  };
  return throwError(() => new HttpErrorResponse({ status: 503, error }));
}

/** Responde a concessão e a trilha pelo endereço pedido. */
function responder(concessao: unknown, trilha: unknown = ok(TRILHA)) {
  leituras.mockImplementation((url) => {
    if (url.includes('unidades')) return of(ok([]));
    return of(url.endsWith('/trilha') ? trilha : concessao);
  });
}

async function abrir(): Promise<HTMLElement> {
  TestBed.configureTestingModule({ providers: provedores([CONSULTAR]) });
  const fixture = TestBed.createComponent(ConcessaoDetalhePage);
  fixture.componentRef.setInput('id', ID);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return host;
}

describe('ConcessaoDetalhePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lê a concessão e a trilha pelo id', async () => {
    responder(ok(ATIVA));
    await abrir();

    const urls = leituras.mock.calls.map(([url]) => url);
    expect(urls).toContain(`http://api.test/api/autorizacao/concessoes/${ID}`);
    expect(urls).toContain(`http://api.test/api/autorizacao/concessoes/${ID}/trilha`);
  });

  it('na revogada mostra quem revogou, quando e o motivo', async () => {
    responder(ok(REVOGADA));
    const host = await abrir();

    expect(host.textContent).toContain('Revogação');
    expect(host.textContent).toContain('Betina Neves');
    expect(host.textContent).toContain('10/11/2026');
    expect(host.textContent).toContain(MOTIVO);
    expect(host.textContent).toContain('Revogada');
  });

  it('na revogada pela janela de migração, quem revogou é a janela', async () => {
    responder(ok({ ...REVOGADA, revogadaPor: null, revogadaPelaJanelaId: 'j1' }));
    const host = await abrir();

    expect(host.textContent).toContain('Janela de migração');
  });

  it('a revogada sem motivo gravado diz isso', async () => {
    responder(ok({ ...REVOGADA, motivoRevogacao: null }));
    const host = await abrir();

    expect(host.textContent).toContain('Sem motivo registrado');
  });

  it('a ativa não mostra revogação, e a tela não tem ação de escrita', async () => {
    responder(ok(ATIVA));
    const host = await abrir();

    expect(host.textContent).toContain('Ativa');
    expect(host.textContent).toContain('Fernanda Drumond');
    expect(host.textContent).not.toContain('Revogada em');
    expect(botoes(host)).toEqual([]);
  });

  it('com o registro de acesso fora do ar (503), mostra a falha sem dado e lê de novo', async () => {
    let vez = 0;
    leituras.mockImplementation((url) =>
      vez++ < 2 && !url.includes('unidades') ? falhaDoRegistro() : of(ok(REVOGADA)),
    );
    const host = await abrir();

    expect(host.textContent).toContain('Não foi possível carregar a concessão');
    expect(host.textContent).not.toContain(MOTIVO);
    expect(botoes(host)).toEqual(['Tentar novamente']);

    responder(ok(REVOGADA));
    botao(host, 'Tentar novamente').click();
    await assentar();

    expect(host.textContent).toContain(MOTIVO);
  });

  it('com só a trilha recusada pelo registro de acesso (503), nenhum dado da concessão aparece', async () => {
    leituras.mockImplementation((url) => {
      if (url.includes('unidades')) return of(ok([]));
      return url.endsWith('/trilha') ? falhaDoRegistro() : of(ok(REVOGADA));
    });
    const host = await abrir();

    expect(host.textContent).toContain('Não foi possível carregar a concessão');
    expect(host.textContent).not.toContain(MOTIVO);
    expect(host.textContent).not.toContain('Fernanda Drumond');
  });

  it('concessão inexistente é recusa definitiva, sem nova tentativa', async () => {
    responder(
      recusaPeloInterceptor('uniplus.autorizacao.concessao.nao_encontrada', 404, 'Não encontrada'),
    );
    const host = await abrir();

    expect(host.textContent).toContain('Concessão não encontrada');
    expect(botoes(host)).not.toContain('Tentar novamente');
  });
});
