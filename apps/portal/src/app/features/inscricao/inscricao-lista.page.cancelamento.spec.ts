import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';

import {
  CenarioDaListaDeInscricoes,
  INSCRICOES,
  respostaSemConteudo,
} from './inscricao-lista.page.testing';

describe('InscricaoListaPage', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  it('Cancelar inscrição avisa que será preciso se inscrever de novo e só cancela depois da confirmação', async () => {
    const cancelar = vi.fn(respostaSemConteudo);
    cenario.listagem.cancelar = cancelar;
    await cenario.carregar(INSCRICOES);

    cenario.abrirDialogoDoItem(1, 'Cancelar inscrição');

    const dialogo = cenario.dialogo();
    expect(dialogo?.textContent).toContain(
      'Para voltar a participar, você precisará fazer uma nova inscrição, preenchendo novamente todas as informações necessárias ao processo seletivo.',
    );
    expect(dialogo?.textContent).not.toContain('do zero');
    expect(cancelar).not.toHaveBeenCalled();

    const campo = dialogo?.querySelector('textarea') as HTMLTextAreaElement;
    campo.value = '  Mudei de curso  ';
    campo.dispatchEvent(new Event('input'));
    cenario.clicarNoDialogo('Cancelar inscrição');
    await cenario.assentar();

    expect(cancelar).toHaveBeenCalledWith('p2', 'Mudei de curso');
    expect(
      cenario.tela().querySelector('[role="status"][aria-live="polite"] .alert')?.textContent,
    ).toContain('Inscrição em Bolsa de iniciação científica cancelada.');
  });

  it('o cancelamento sem motivo vai sem motivo', async () => {
    const cancelar = vi.fn(respostaSemConteudo);
    cenario.listagem.cancelar = cancelar;
    await cenario.carregar(INSCRICOES);

    cenario.abrirDialogoDoItem(1, 'Cancelar inscrição');
    cenario.clicarNoDialogo('Cancelar inscrição');

    expect(cancelar).toHaveBeenCalledWith('p2', null);
  });

  it('Descartar rascunho pede confirmação e, confirmado, recarrega a lista, anuncia e leva o foco ao título', async () => {
    const descartar = vi.fn(respostaSemConteudo);
    cenario.listagem.descartar = descartar;
    await cenario.carregar(INSCRICOES);

    cenario.abrirDialogoDoItem(0, 'Descartar rascunho');
    expect(descartar).not.toHaveBeenCalled();

    cenario.clicarNoDialogo('Descartar rascunho');
    await cenario.assentar();
    await cenario.carregar(INSCRICOES.slice(1));
    await cenario.macrotarefa();

    expect(descartar).toHaveBeenCalledWith('p1');
    expect(cenario.itens().length).toBe(INSCRICOES.length - 1);
    expect(
      cenario.tela().querySelector('[role="status"][aria-live="polite"] .alert')?.textContent,
    ).toContain('Rascunho de Auxílio estudantil 2026 descartado.');
    expect(document.activeElement).toBe(cenario.tela().querySelector('h1'));
  });

  it('a recusa da API mantém o diálogo aberto, com o motivo, e não anuncia sucesso', async () => {
    cenario.listagem.cancelar = () =>
      of(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Recusado',
            detail: 'O motivo do cancelamento aceita até 500 caracteres.',
            status: 422,
            code: 'x',
            traceId: '',
          },
          422,
          new HttpHeaders(),
        ),
      );
    await cenario.carregar(INSCRICOES);

    cenario.abrirDialogoDoItem(1, 'Cancelar inscrição');
    cenario.clicarNoDialogo('Cancelar inscrição');
    await cenario.assentar();

    expect(cenario.dialogo()?.hasAttribute('open')).toBe(true);
    expect(cenario.dialogo()?.querySelector('.alert')?.textContent).toContain('até 500 caracteres');
    expect(cenario.tela().querySelector('[role="status"] .alert')).toBeNull();
  });
});
