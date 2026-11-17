import { HttpHeaders } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';

import { CenarioDaListaDeInscricoes, INSCRICOES } from './inscricao-lista.page.testing';

describe('InscricaoListaPage — ações e confirmação', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  it('Continuar inscrição abre o formulário do processo', async () => {
    await cenario.carregar(INSCRICOES);
    const navegar = cenario.espiarNavegacao();

    cenario.clicarNoItem(0, 'Continuar inscrição');

    expect(navegar).toHaveBeenCalledWith(['/inscricao', 'p1']);
  });

  it('as ações que desfazem a inscrição abrem a confirmação e não navegam', async () => {
    await cenario.carregar(INSCRICOES);
    const navegar = cenario.espiarNavegacao();

    cenario.abrirDialogoDoItem(0, 'Descartar rascunho');

    expect(cenario.dialogo()?.hasAttribute('open')).toBe(true);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('confirmar de novo enquanto a ação corre não repete a chamada', async () => {
    const cancelar = vi.fn(() => new Subject<ApiResult<void>>());
    cenario.listagem.cancelar = cancelar;
    await cenario.carregar(INSCRICOES);

    cenario.abrirDialogoDoItem(1, 'Cancelar inscrição');
    cenario.clicarNoDialogo('Cancelar inscrição');
    cenario.clicarNoDialogo('Cancelar inscrição');

    expect(cancelar).toHaveBeenCalledTimes(1);
  });

  it('depois da recusa da API a confirmação pode ser tentada de novo e, concluída, apaga o erro', async () => {
    const recusa = apiFailure(
      {
        type: 'about:blank',
        title: 'Recusado',
        detail: 'Tente mais tarde.',
        status: 422,
        code: 'x',
        traceId: '',
      },
      422,
      new HttpHeaders(),
    );
    const cancelar = vi
      .fn()
      .mockReturnValueOnce(of(recusa))
      .mockReturnValueOnce(of(apiOk<void>(undefined, 204, new HttpHeaders())));
    cenario.listagem.cancelar = cancelar;
    await cenario.carregar(INSCRICOES);

    cenario.abrirDialogoDoItem(1, 'Cancelar inscrição');
    cenario.clicarNoDialogo('Cancelar inscrição');
    await cenario.assentar();
    expect(cenario.dialogo()?.querySelector('.alert')?.textContent).toContain('Tente mais tarde.');

    cenario.clicarNoDialogo('Cancelar inscrição');
    await cenario.assentar();

    expect(cancelar).toHaveBeenCalledTimes(2);
    expect(cenario.dialogo()?.querySelector('.alert')).toBeNull();
  });
});
