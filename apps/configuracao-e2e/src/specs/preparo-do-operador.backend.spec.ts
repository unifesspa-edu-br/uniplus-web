import { test, expect } from '@playwright/test';
import { OPERADOR_DO_ROTEIRO, chamarApi, garantirOperadorDoRoteiro } from '@uniplus/shared-e2e';

/**
 * O preparo dos testes com a API real: o operador do roteiro recebe, pelo fluxo de pedido, o perfil
 * da instituição inteira e o da unidade do certame. Cobre a criação do perfil, a espera pela
 * verificação do documento e a condução do pedido de concessão no formato que a API devolve.
 */
test.describe('Preparo do operador do roteiro', () => {
  test('o operador passa a ter o perfil da instituição e o da unidade', async () => {
    test.setTimeout(600_000);
    await garantirOperadorDoRoteiro();

    const resposta = await chamarApi<{
      perfis: readonly {
        readonly nome: string;
        readonly escopoTipo: { readonly codigo: string };
      }[];
    }>(OPERADOR_DO_ROTEIRO, 'GET', '/api/profile/me');

    expect(resposta.status).toBe(200);
    const alcanceDo = (parteDoNome: string): string | undefined =>
      resposta.corpo.perfis.find((perfil) => perfil.nome.includes(parteDoNome))?.escopoTipo.codigo;
    expect(alcanceDo('cadastros e publicações')).toBe('INSTITUICAO');
    expect(alcanceDo('processo seletivo')).toBe('UNIDADE');
  });
});
