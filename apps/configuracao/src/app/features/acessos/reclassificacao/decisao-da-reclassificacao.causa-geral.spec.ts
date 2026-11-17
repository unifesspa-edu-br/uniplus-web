import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recusa } from '../testes';
import { abrirReclassificacao, api, botao, caixaDe, presente } from './reclassificacao.testing';

const CAUSA_GERAL = {
  code: 'uniplus.autorizacao.reclassificacao.bloqueada',
  message: 'A reclassificação está bloqueada.',
};

describe('decisão da reclassificação — causa geral na recusa do motivo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  it('o motivo recusado fica no campo e a causa geral aparece no diálogo, sem seguir o fluxo do código', async () => {
    api.decidir.mockReturnValue(
      of({
        ...recusa('x', 422),
        problem: {
          type: 'x',
          title: 'Documento não lido',
          status: 422,
          code: 'uniplus.autorizacao.reclassificacao.documento_nao_lido',
          traceId: '',
          errors: [
            {
              field: 'Motivo',
              code: 'uniplus.autorizacao.reclassificacao.motivo_invalido',
              message: 'Motivo inválido.',
            },
            CAUSA_GERAL,
          ],
        },
      }),
    );
    const pagina = await abrirReclassificacao();
    presente(caixaDe(pagina.host, 'Betina Teste')).click();
    await pagina.assentar();
    presente(botao(pagina.host, 'Manter suspensas')).click();
    await pagina.assentar();
    const campo = presente(
      pagina.host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea'),
    );
    campo.value = 'Motivo longo.';
    campo.dispatchEvent(new Event('input'));
    await pagina.assentar();

    presente(
      botao(presente(pagina.host.querySelector('cfg-motivo-dialog')), 'Manter suspensas'),
    ).click();
    await pagina.assentar();

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(pagina.host.querySelector('cfg-motivo-dialog')?.textContent).toContain(
      'A reclassificação está bloqueada.',
    );
    expect(document.activeElement?.id).not.toBe('cfg-versoes-em-uso');
  });
});
