import { expect, test, type Page } from '@playwright/test';
import {
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
  UNIDADE_RESPONSAVEL_DA_FASE,
} from '../fixtures/processo-publicado-completo';
import { mockarApi, novoCapturado } from '../support/api-da-unidade-da-fase';
import { capturarAsExigencias } from '../support/api-das-exigencias-do-processo';

/**
 * Os documentos exigidos de uma fase, lidos do detalhe do processo na forma do contrato — tipo,
 * momento, aplicabilidade, indeferimento e requisitos agrupados — e devolvidos ao gravar o
 * Cronograma, e a recusa do servidor sobre o tipo de documento.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos por rota,
 * e o `PUT /documentos-exigidos` é capturado para conferir o comando que a tela monta.
 */
const [FASE_DO_PROCESSO] = PROCESSO_PUBLICADO_COMPLETO.cronogramaFases;
const EXIGENCIA_LIDA = PROCESSO_PUBLICADO_COMPLETO.raizesExigencia[0].documento;

async function abrirOCronograma(page: Page): Promise<void> {
  await page.goto(`/processo-seletivo/${ID_DO_PROCESSO_COMPLETO}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Cronograma' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /^Passo 5:/ })).toBeVisible();
}

async function prepararApi(page: Page) {
  await mockarApi(page, novoCapturado(UNIDADE_RESPONSAVEL_DA_FASE));
  return capturarAsExigencias(page);
}

test.describe('Cronograma — documentos exigidos na forma do contrato', () => {
  test('a exigência lida volta ao servidor com o documento agrupado, sem campos soltos', async ({
    page,
  }) => {
    const gravadas = await prepararApi(page);
    await abrirOCronograma(page);

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect.poll(() => gravadas.corpos.length).toBeGreaterThan(0);
    const [raiz] = gravadas.corpos[gravadas.corpos.length - 1];
    expect(raiz).toMatchObject({
      tipo: 'FOLHA',
      documento: {
        tipoDocumento: { id: EXIGENCIA_LIDA?.tipoDocumento.id },
        momento: { faseId: FASE_DO_PROCESSO.id },
        aplicabilidade: { tipo: 'GERAL' },
        indeferimento: { obrigatorio: true, consequencia: 'ELIMINA' },
        requisitos: { formatosPermitidos: ['pdf'] },
      },
    });
    expect(raiz.documento).not.toHaveProperty('tipoDocumentoId');
    expect(raiz.documento).not.toHaveProperty('obrigatorio');
    expect(raiz.documento).not.toHaveProperty('consequenciaIndeferimento');
  });

  test('a recusa do tipo de documento pendente chega ao operador com a orientação', async ({
    page,
  }) => {
    const gravadas = await prepararApi(page);
    gravadas.codigoDaRecusa =
      'uniplus.selecao.documento_exigido.tipo_documento_com_protecao_pendente';
    await abrirOCronograma(page);

    await page.getByRole('button', { name: /Gravar e avançar/ }).click();

    await expect(page.getByText(/aguarda a aprovação da proteção de dados/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /^Passo 5:/ })).toBeVisible();
  });
});
