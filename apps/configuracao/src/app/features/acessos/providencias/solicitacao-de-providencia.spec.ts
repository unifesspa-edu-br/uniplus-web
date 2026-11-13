import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { ConcessaoDetalhePage } from '../concessao-detalhe.page';
import {
  ID,
  ROTA,
  SOLICITAR,
  assentar,
  botao,
  digitar,
  montar,
  notificacoes,
  pessoa,
  problema,
  providencia,
  type Montagem,
} from './providencias.testing';
import { tamanhoDoFundamento } from './solicitacao-de-providencia';

const CONSULTAR = PERMISSAO.autorizacao.concessoesConsultar;
const CONCESSAO = 'http://api.test/api/autorizacao/concessoes/c1';
const FUNDAMENTO = 'Deixou a banca e mantém acesso a documentos sensíveis.';

const ATIVA: ConcessaoDto = {
  id: 'c1',
  beneficiario: pessoa('sub-leandro', 'Leandro Viana'),
  perfil: { id: 'p1', nome: 'Banca de documentos' },
  versao: 1,
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

describe('Solicitar providência a partir da concessão', () => {
  let tela: Montagem<ConcessaoDetalhePage>;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    tela.http.verify();
    document.body.innerHTML = '';
  });

  async function abrir(concedidas: readonly string[], concessao: ConcessaoDto = ATIVA) {
    tela = montar(ConcessaoDetalhePage, concedidas);
    tela.fixture.componentRef.setInput('id', 'c1');
    tela.fixture.detectChanges();
    tela.http.expectOne(CONCESSAO).flush(concessao);
    tela.http.expectOne(`${CONCESSAO}/trilha`).flush([]);
    await assentar();
  }

  const dialogo = () => document.querySelector('cfg-solicitar-providencia-dialog') as HTMLElement;
  const fundamento = () => dialogo().querySelector('textarea') as HTMLTextAreaElement;

  async function preencher(tipo: string | null, texto: string): Promise<void> {
    botao('Solicitar providência')?.click();
    await assentar();
    if (tipo !== null) {
      const radio = [...dialogo().querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
        (r) => r.closest('label')?.textContent?.includes(tipo),
      );
      radio?.click();
    }
    digitar(fundamento(), texto);
    await assentar();
  }

  function confirmar(): void {
    [...dialogo().querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Solicitar providência')
      ?.click();
  }

  it('só quem tem a permissão de solicitar vê o botão, e só na concessão ativa', async () => {
    await abrir([CONSULTAR]);
    expect(botao('Solicitar providência')).toBeUndefined();
    document.body.innerHTML = '';
    TestBed.resetTestingModule();

    await abrir([CONSULTAR, SOLICITAR], { ...ATIVA, ativa: false });
    expect(botao('Solicitar providência')).toBeUndefined();
  });

  it('o fundamento conta os caracteres depois de aparado', () => {
    expect(tamanhoDoFundamento('  curto  ')).toBe(5);
    expect(tamanhoDoFundamento('😀'.repeat(3))).toBe(3);
  });

  it('sem tipo ou com fundamento abaixo de 10 caracteres depois de aparado, não envia', async () => {
    await abrir([CONSULTAR, SOLICITAR]);
    await preencher(null, '   curto     ');
    confirmar();
    await assentar();

    tela.http.expectNone(ROTA);
    expect(fundamento().getAttribute('aria-invalid')).toBe('true');
    expect(dialogo().textContent).toContain('Escolha a retirada ou a revisão do acesso.');
    expect(fundamento().getAttribute('aria-describedby')).toContain('cfg-fundamento-erro');
    expect(dialogo().querySelector('[role="radiogroup"]')?.getAttribute('aria-describedby')).toBe(
      'cfg-tipo-erro',
    );
  });

  it('envia o tipo e o fundamento aparado com chave, e abre o detalhe da providência', async () => {
    await abrir([CONSULTAR, SOLICITAR]);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await preencher('Retirada do acesso', `  ${FUNDAMENTO}  `);
    confirmar();
    await assentar();

    const envio = tela.http.expectOne(ROTA);
    expect(envio.request.body).toEqual({
      concessaoId: 'c1',
      tipo: 'retirada',
      fundamento: FUNDAMENTO,
    });
    expect(envio.request.headers.get('Idempotency-Key')).toBeTruthy();
    envio.flush(providencia(), { status: 201, statusText: 'Created' });
    await assentar();

    expect(notificacoes.success).toHaveBeenCalledWith('Providência solicitada');
    expect(navegar).toHaveBeenCalledWith(['/acessos/providencias', ID]);
  });

  it('o lote de 422 vai a cada campo de uma vez', async () => {
    await abrir([CONSULTAR, SOLICITAR]);
    await preencher('Revisão do acesso', FUNDAMENTO);
    confirmar();
    await assentar();

    tela.http.expectOne(ROTA).flush(
      ...problema(422, 'uniplus.autorizacao.providencia.fundamento_invalido', {
        errors: [
          {
            field: 'tipo',
            code: 'uniplus.autorizacao.providencia.tipo_invalido',
            message: 'Tipo inválido.',
          },
          {
            field: 'fundamento',
            code: 'uniplus.autorizacao.providencia.fundamento_invalido',
            message: 'Fundamento inválido.',
          },
        ],
      }),
    );
    await assentar();

    expect(dialogo().textContent).toContain('Fundamento inválido.');
    expect(fundamento().getAttribute('aria-invalid')).toBe('true');
  });

  it('escolher o tipo depois do erro tira o erro e o aria-invalid', async () => {
    await abrir([CONSULTAR, SOLICITAR]);
    await preencher(null, FUNDAMENTO);
    confirmar();
    await assentar();
    expect(dialogo().textContent).toContain('Escolha a retirada ou a revisão do acesso.');

    const radio = dialogo().querySelector<HTMLInputElement>('input[type="radio"]');
    radio?.click();
    await assentar();

    expect(dialogo().textContent).not.toContain('Escolha a retirada ou a revisão do acesso.');
    expect(radio?.getAttribute('aria-invalid')).toBeNull();
    tela.http.expectNone(ROTA);
  });

  it('a recusa 422 do tipo aparece no campo do tipo', async () => {
    await abrir([CONSULTAR, SOLICITAR]);
    await preencher('Revisão do acesso', FUNDAMENTO);
    confirmar();
    await assentar();

    const code = 'uniplus.autorizacao.providencia.tipo_invalido';
    tela.http
      .expectOne(ROTA)
      .flush(
        ...problema(422, code, { errors: [{ field: 'tipo', code, message: 'Tipo inválido.' }] }),
      );
    await assentar();

    expect(dialogo().querySelector('#cfg-tipo-erro')?.textContent).toContain('Tipo inválido.');
    expect(dialogo().querySelector('input[type="radio"]')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('a providência já aberta fica no alerta do diálogo', async () => {
    await abrir([CONSULTAR, SOLICITAR]);
    await preencher('Retirada do acesso', FUNDAMENTO);
    confirmar();
    await assentar();

    tela.http
      .expectOne(ROTA)
      .flush(...problema(409, 'uniplus.autorizacao.providencia.ja_ha_aberta'));
    await assentar();

    expect(dialogo().textContent).toContain('Já existe providência aberta para a concessão.');
  });
});
