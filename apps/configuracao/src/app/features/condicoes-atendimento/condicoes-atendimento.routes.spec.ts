import { describe, expect, it } from 'vitest';
import { CONDICOES_ATENDIMENTO } from './condicoes-atendimento.routes';
import { CondicoesAtendimentoPage } from './condicoes-atendimento.page';

describe('CONDICOES_ATENDIMENTO', () => {
  it('carrega a página da tela na rota raiz', async () => {
    const [raiz] = CONDICOES_ATENDIMENTO;
    expect(raiz.path).toBe('');
    expect(await (raiz.loadComponent as () => Promise<unknown>)()).toBe(CondicoesAtendimentoPage);
  });
});
