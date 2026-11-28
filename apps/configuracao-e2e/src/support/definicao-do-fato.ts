import { expect, type Locator, type Page } from '@playwright/test';
import { mockApi } from './api-simulada-das-escritas-dos-fatos';

/** Uma só recusa 422 que traz o aviso das citações e o aviso do campo sem controle na tela. */
export const RECUSA_COM_CITACAO_E_CAMPO_SEM_CONTROLE = {
  type: 'about:blank',
  title: 'Requisição inválida',
  status: 422,
  code: 'uniplus.validation_failed',
  traceId: 'e2e',
  errors: [
    {
      field: 'citacoes.regrasPadrao.REGRA_DE_EXEMPLO',
      code: 'uniplus.configuracao.fato_candidato.citado',
      message: 'A regra padrão de outro fato usa este fato.',
    },
    {
      field: 'campoSemControleNaTela',
      code: 'uniplus.configuracao.fato_candidato.campo_recusado',
      message: 'Valor não admitido.',
    },
  ],
};

/** Abre o painel do fato de exemplo e expande o bloco "Definição", que começa recolhido. */
export async function abrirADefinicaoDoFato(page: Page): Promise<Locator> {
  await page.goto('/fatos-candidato');
  await page.getByRole('button', { name: 'Editar o fato TRABALHA' }).click();
  const painel = page.getByRole('dialog', { name: 'Fato do candidato' });
  await expect(painel).toBeVisible();
  await painel.getByRole('button', { name: 'Definição', exact: true }).click();
  await expect(painel.getByRole('button', { name: 'Salvar definição' })).toBeVisible();
  return painel;
}

/** Salva a definição com a API recusando como na constante acima e espera os dois avisos. */
export async function salvarADefinicaoRecusada(page: Page): Promise<Locator> {
  const { liberar } = await mockApi(page, {
    status: 422,
    corpo: RECUSA_COM_CITACAO_E_CAMPO_SEM_CONTROLE,
  });
  const painel = await abrirADefinicaoDoFato(page);
  await painel.getByRole('button', { name: 'Salvar definição' }).click();
  liberar();
  await expect(page.locator('#cfg-fato-def-citacoes')).toBeVisible();
  await expect(page.locator('#cfg-fato-def-recusa')).toBeVisible();
  return painel;
}
