import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProvidenciaDetalhePage } from './providencia-detalhe.page';
import {
  ADMINISTRAR,
  ID,
  ROTA,
  assentar,
  botao,
  digitar,
  montar,
  problema,
  providencia,
  type Montagem,
} from './providencias.testing';

const DETALHE = `${ROTA}/${ID}`;
const CODIGO_DO_EMAIL = 'uniplus.autorizacao.concessao.confirmacao_divergente';

describe('ProvidenciaDetalhePage — causa geral na recusa do atendimento', () => {
  let tela: Montagem<ProvidenciaDetalhePage>;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    tela.http.verify();
    document.body.innerHTML = '';
  });

  const daRevogacao = <T extends HTMLElement>(seletor: string) =>
    document.querySelector(`cfg-revogar-concessao-dialog ${seletor}`) as T;

  async function recusarAtendimento(code: string): Promise<void> {
    tela = montar(ProvidenciaDetalhePage, [ADMINISTRAR]);
    tela.fixture.componentRef.setInput('id', ID);
    tela.fixture.detectChanges();
    tela.http.expectOne(DETALHE).flush(providencia());
    await assentar();
    botao('Atender e revogar a concessão')?.click();
    await assentar();
    digitar(daRevogacao<HTMLTextAreaElement>('textarea'), 'Deixou a banca.');
    digitar(daRevogacao<HTMLInputElement>('input[type="email"]'), 'outra@agenciadbd.com');
    await assentar();
    botao('Revogar concessão')?.click();
    await assentar();
    tela.http.expectOne(`${DETALHE}/atendimento`).flush(
      ...problema(422, code, {
        errors: [
          { field: 'confirmacaoEmail', code: CODIGO_DO_EMAIL, message: 'O e-mail não confere.' },
          { code: 'bloqueada', message: 'A providência está bloqueada.' },
        ],
      }),
    );
    await assentar();
  }

  it('o e-mail recusado fica no campo e a causa geral aparece no diálogo', async () => {
    await recusarAtendimento(CODIGO_DO_EMAIL);

    expect(daRevogacao('input[type="email"]').getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain('O e-mail não confere.');
    expect(document.body.textContent).toContain('A providência está bloqueada.');
  });

  it('a causa geral não leva a releitura de uma recusa que a pediria sem campo marcado', async () => {
    await recusarAtendimento('uniplus.autorizacao.providencia.ja_atendida');

    expect(daRevogacao('input[type="email"]').getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain('A providência está bloqueada.');
  });
});
