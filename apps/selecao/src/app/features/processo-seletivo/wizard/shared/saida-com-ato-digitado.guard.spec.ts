import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import type { ProcessoSeletivoPage } from '../../processo-seletivo.page';
import {
  AVISO_DE_ATO_DIGITADO,
  ConfirmacaoDeSaida,
  saidaComAtoDigitadoGuard,
} from './saida-com-ato-digitado.guard';

function sairDaPagina(atoDigitadoPendente: boolean, resposta = false) {
  const confirmar = vi.fn(() => resposta);
  TestBed.configureTestingModule({
    providers: [{ provide: ConfirmacaoDeSaida, useValue: { confirmar } }],
  });
  const pagina = { atoDigitadoPendente: () => atoDigitadoPendente } as ProcessoSeletivoPage;
  const rota = {} as ActivatedRouteSnapshot;
  const estado = {} as RouterStateSnapshot;
  const permitida = TestBed.runInInjectionContext(() =>
    saidaComAtoDigitadoGuard(pagina, rota, estado, estado),
  );
  return { permitida, confirmar };
}

describe('saidaComAtoDigitadoGuard', () => {
  it('deixa sair sem perguntar quando não há ato digitado', () => {
    const { permitida, confirmar } = sairDaPagina(false);

    expect(permitida).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('avisa que sair descarta o ato digitado e barra a saída se a pessoa não confirma', () => {
    const { permitida, confirmar } = sairDaPagina(true, false);

    expect(confirmar).toHaveBeenCalledWith(AVISO_DE_ATO_DIGITADO);
    expect(permitida).toBe(false);
  });

  it('deixa sair quando a pessoa confirma a perda', () => {
    expect(sairDaPagina(true, true).permitida).toBe(true);
  });
});
