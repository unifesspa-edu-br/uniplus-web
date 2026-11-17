import { TestBed } from '@angular/core/testing';
import { StatusProcesso } from '@uniplus/shared-data/selecao';
import { okResult } from '@uniplus/shared-testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MONTAGEM_LENTA,
  detalhe,
  documento,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

/**
 * O agregado recusa mutação fora de rascunho, e a listagem oferece "Abrir"
 * para qualquer processo. Sem esta condição o editor monta os mesmos
 * controles e promete uma gravação que o servidor negaria depois de o
 * operador preencher a tela.
 */
describe('ProcessoSeletivoPage — processo fora de rascunho', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  const PASSO_PAGAMENTO = 2;

  const publicado = () =>
    montar({ obter: vi.fn(() => of(okResult(detalhe({ status: StatusProcesso.publicado })))) });

  it('não promete gravação no rótulo do avanço', async () => {
    const cenario = publicado();
    await propagar();

    cenario.store.goTo(PASSO_PAGAMENTO);
    cenario.fixture.detectChanges();

    expect(cenario.componente.rotuloDeAvanco()).toBe('Próximo');
  });

  it('avança sem emitir comando de escrita', async () => {
    const cenario = publicado();
    await propagar();

    cenario.store.goTo(PASSO_PAGAMENTO);
    cenario.fixture.detectChanges();
    await cenario.componente.nextOrPublish();

    expect(cenario.definirTaxaInscricao).not.toHaveBeenCalled();
    expect(cenario.store.passoAtual()).toBe(PASSO_PAGAMENTO + 1);
  });

  it('retira o botão de avanço do último passo, onde ele só publicaria', async () => {
    const cenario = publicado();
    await propagar();

    cenario.store.goTo(cenario.store.totalDePassos - 1);
    cenario.fixture.detectChanges();

    expect(cenario.componente.ofereceAvanco()).toBe(false);
  });

  it('recusa alterar o rascunho pelos passos que não gravam', async () => {
    const cenario = publicado();
    await propagar();

    const antes = cenario.store.draft().opcoesDeCurso;
    cenario.store.patchSection('opcoesDeCurso', {
      ...antes,
      numero: antes.numero === '2' ? '1' : '2',
    });

    expect(cenario.store.draft().opcoesDeCurso).toEqual(antes);
  });

  it('explica a consulta conforme o status, sem prometer retificação a quem não a tem', async () => {
    const cancelado = montar({
      obter: vi.fn(() => of(okResult(detalhe({ status: StatusProcesso.cancelado })))),
    });
    await propagar();
    expect(cancelado.store.motivoDeSomenteLeitura()).toContain('cancelado');
    expect(cancelado.store.motivoDeSomenteLeitura()).not.toContain('retificação');

    TestBed.resetTestingModule();
    const publicadoCenario = publicado();
    await propagar();
    expect(publicadoCenario.store.motivoDeSomenteLeitura()).toContain('retificação');
  });

  it('relê o edital confirmado, que é o que a consulta existe para mostrar', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(okResult(detalhe({ status: StatusProcesso.publicado })))),
      listarDocumentos: vi.fn(() => of(okResult([documento()]))),
    });
    await propagar();

    expect(cenario.store.draft().identificacao.uploads.length).toBe(1);
  });

  it('não nomeia a situação de um status que este cliente não conhece', async () => {
    const cenario = montar({
      // Fora do enum de propósito: simula um backend mais novo. O cast é o objeto
      // do teste — sem ele não há como exprimir o token que o contrato não declara.
      obter: vi.fn(() => of(okResult(detalhe({ status: 'Arquivado' as StatusProcesso })))),
    });
    await propagar();

    const motivo = cenario.store.motivoDeSomenteLeitura();
    expect(motivo).toContain('não está em rascunho');
    expect(motivo).not.toContain('cancelado');
    expect(motivo).not.toContain('encerrado');
  });

  it('mantém a edição liberada enquanto o detalhe não chegou', () => {
    const cenario = montar();

    expect(cenario.store.edicaoPermitida()).toBe(true);
  });
});
