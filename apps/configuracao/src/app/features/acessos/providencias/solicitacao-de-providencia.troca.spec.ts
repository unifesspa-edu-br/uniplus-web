import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { ConcessaoDetalhePage } from '../concessao-detalhe.page';
import {
  ROTA,
  SOLICITAR,
  assentar,
  botao,
  digitar,
  montar,
  notificacoes,
  pessoa,
  providencia,
  type Montagem,
} from './providencias.testing';

const CONSULTAR = PERMISSAO.autorizacao.concessoesConsultar;
const CONCESSOES = 'http://api.test/api/autorizacao/concessoes';

function concessao(id: string): ConcessaoDto {
  return {
    id,
    beneficiario: pessoa(`sub-${id}`, 'Leandro Viana'),
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
}

describe('Solicitar providência — o diálogo preso à concessão em que abriu', () => {
  let tela: Montagem<ConcessaoDetalhePage>;

  beforeEach(async () => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    tela = montar(ConcessaoDetalhePage, [CONSULTAR, SOLICITAR]);
    await irPara('c1');
  });

  afterEach(() => {
    tela.http.verify();
    document.body.innerHTML = '';
  });

  async function irPara(id: string): Promise<void> {
    tela.fixture.componentRef.setInput('id', id);
    tela.fixture.detectChanges();
    tela.http.expectOne(`${CONCESSOES}/${id}`).flush(concessao(id));
    tela.http.expectOne(`${CONCESSOES}/${id}/trilha`).flush([]);
    await assentar();
  }

  const dialogo = () => document.querySelector('cfg-solicitar-providencia-dialog');
  const fundamento = () => dialogo()?.querySelector('textarea') as HTMLTextAreaElement;
  const aberto = () => dialogo()?.querySelector('dialog')?.hasAttribute('open') === true;

  async function escrever(texto: string): Promise<void> {
    botao('Solicitar providência')?.click();
    await assentar();
    dialogo()?.querySelector<HTMLInputElement>('input[type="radio"]')?.click();
    digitar(fundamento(), texto);
    await assentar();
  }

  function confirmar(): void {
    [...(dialogo()?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((b) => b.textContent?.trim() === 'Solicitar providência')
      ?.click();
  }

  it('de c1 para c2 para c1, o diálogo de c1 fecha e o fundamento dele não vai a nenhum pedido', async () => {
    await escrever('Fundamento escrito para a concessão c1.');

    await irPara('c2');
    expect(aberto()).toBe(false);

    await irPara('c1');
    botao('Solicitar providência')?.click();
    await assentar();
    expect(aberto()).toBe(true);
    expect(fundamento().value).toBe('');
    tela.http.expectNone(ROTA);
  });

  it('o pedido sai sempre com a concessão em que o diálogo abriu', async () => {
    await escrever('Fundamento escrito para a concessão c1.');
    confirmar();
    await assentar();

    expect(tela.http.expectOne(ROTA).request.body).toMatchObject({ concessaoId: 'c1' });
  });

  it('a resposta do pedido de c1 que chega já em c2 não avisa nem navega', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await escrever('Fundamento escrito para a concessão c1.');
    confirmar();
    await assentar();
    const envio = tela.http.expectOne(ROTA);

    await irPara('c2');
    envio.flush(providencia(), { status: 201, statusText: 'Created' });
    await assentar();

    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('sair da página com o pedido pendente: a resposta não navega nem avisa', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await escrever('Fundamento escrito para a concessão c1.');
    confirmar();
    await assentar();
    const envio = tela.http.expectOne(ROTA);

    tela.fixture.destroy();
    envio.flush(providencia(), { status: 201, statusText: 'Created' });
    await new Promise((resolver) => setTimeout(resolver));

    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });
});
