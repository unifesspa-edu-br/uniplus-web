import { HttpHeaders } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import { ConcessoesPage } from './concessoes.page';
import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import {
  URL,
  ativa,
  atualizar,
  configurarConcessoes,
  dublesDeConcessoes,
} from './concessoes.page.testing';
import { recusasDoControle } from '../../shared/formulario';

const CAUSA_GERAL = {
  code: 'uniplus.autorizacao.concessao.bloqueada',
  message: 'A concessão está bloqueada.',
};

function recusaComCausaGeral(code: string) {
  return apiFailure(
    {
      type: 'x',
      title: 'Recusado',
      status: 409,
      code,
      traceId: '',
      errors: [
        {
          field: 'Motivo',
          code: 'uniplus.autorizacao.concessao.motivo_invalido',
          message: 'Motivo recusado.',
        },
        CAUSA_GERAL,
      ],
    },
    409,
    new HttpHeaders(),
  );
}

describe('ConcessoesPage — causa geral na recusa da revogação', () => {
  let http: HttpTestingController;
  const dubles = dublesDeConcessoes();
  beforeEach(() => {
    vi.resetAllMocks();
    http = configurarConcessoes(dubles);
  });
  afterEach(() => http.verify());

  it('o motivo recusado fica no campo, a causa geral vai ao alerta e a lista não é relida', async () => {
    dubles.api.revogar.mockReturnValue(
      of(recusaComCausaGeral('uniplus.autorizacao.concessao.ja_revogada')),
    );
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    fixture.nativeElement.querySelector('button[aria-label^="Revogar a concessão"]').click();
    fixture.detectChanges();
    const pagina = fixture.debugElement.injector.get(RevogacaoDeConcessoes);

    await pagina.revogar('Saiu da função.', 'betina@uniplus-test.local');
    await atualizar();

    expect(recusasDoControle(pagina.motivo)).toHaveLength(1);
    expect(pagina.erroDaRevogacao()).toBe('A concessão está bloqueada.');
    http.expectNone((r) => r.url === URL);
  });
});
