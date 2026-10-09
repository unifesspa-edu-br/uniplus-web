import { expect, test, type Page, type Route } from '@playwright/test';
import {
  PROCESSO_PUBLICADO_DA_MEDICINA,
  TIPOS_DE_PROCESSO,
} from '../fixtures/consulta-da-medicina';
import { responder, responderCom } from '../support/responder';

/**
 * web#1008 — o passo Formulários manda declarar o tipo de deficiência em "Atend. especial", e
 * a seção que o recebe sumia quando o cadastro de condições não tinha a condição PCD. O
 * operador seguia a orientação e chegava a uma tela sem saída.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos por
 * rota. O catálogo de condições é trocado entre as cargas para reproduzir o operador que
 * cadastra a PCD em Configuração e volta ao passo.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const PCD = {
  id: '01a0d640-0000-7000-8000-000000000001',
  codigo: 'PCD',
  nome: 'Pessoa com deficiência',
  descricao: null,
  criadoEm: '2026-09-01T00:00:00Z',
};
const SURDEZ = {
  id: '01a0d640-0000-7000-8000-000000000003',
  codigo: 'SURDEZ',
  nome: 'Surdez',
  descricao: null,
  criadoEm: '2026-09-01T00:00:00Z',
};
const TIPO_VISUAL = {
  id: '01a0d640-0000-7000-8000-000000000021',
  codigo: 'VISUAL',
  nome: 'Deficiência visual',
  descricao: null,
  permanente: true,
  criadoEm: '2026-09-01T00:00:00Z',
};

/** O formulário de inscrição pergunta o tipo de deficiência; a oferta ainda não declara nada. */
const PROCESSO_COM_FORMULARIO_QUE_PERGUNTA_O_TIPO = {
  ...PROCESSO_PUBLICADO_DA_MEDICINA,
  status: 'rascunho',
  ofertaAtendimento: { condicoes: [], recursos: [], tiposDeficiencia: [] },
  formularios: [
    {
      ...PROCESSO_PUBLICADO_DA_MEDICINA.formularios[0],
      fatosColetados: [
        {
          ...PROCESSO_PUBLICADO_DA_MEDICINA.formularios[0].fatosColetados[0],
          fatoCodigo: 'TIPO_DEFICIENCIA',
          rotulo: 'Tipo de deficiência',
          tipoRenderizacao: 'SELECAO_MULTIPLA',
        },
      ],
    },
  ],
};

test.describe('Atendimento sem a condição PCD no cadastro (web#1008)', () => {
  test('a seção orienta a cadastrar a PCD e, depois do cadastro, a marcá-la', async ({ page }) => {
    const catalogo = { condicoes: [SURDEZ] as readonly object[] };
    await mockarApi(page, catalogo);

    await page.goto(`/processo-seletivo/${PROCESSO_COM_FORMULARIO_QUE_PERGUNTA_O_TIPO.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.locator('.wiz-nav').getByRole('button', { name: 'Atend. especial' }).click();

    // CA-01: a seção existe e diz o que falta e onde cadastrar.
    const secao = page.locator('.wiz-content').getByRole('heading', {
      name: 'Tipos de deficiência reconhecidos',
    });
    await expect(secao).toBeVisible();
    const aviso = page.locator('#atend-aviso-sem-pcd');
    await expect(aviso).toContainText('Pessoa com deficiência');
    await expect(aviso).toContainText('código PCD');
    await expect(aviso).toContainText('Configuração → Condições de atendimento');

    // CA-03: o "Gravar e avançar" também recusa com a orientação, e não só com "declare um".
    await page.getByRole('button', { name: 'Gravar e avançar' }).click();
    await expect(page.locator('.step-error')).toContainText('código PCD');

    // O operador cadastra a PCD em Configuração (outro app) e volta: o passo recarrega.
    catalogo.condicoes = [PCD, SURDEZ];
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.locator('.wiz-nav').getByRole('button', { name: 'Atend. especial' }).click();

    // CA-02: com a PCD cadastrada e desmarcada, a seção manda marcá-la.
    await expect(page.locator('#atend-aviso-sem-pcd')).toHaveCount(0);
    await expect(page.locator('#atend-aviso-pcd-desmarcada')).toContainText(
      'Marque a condição "Pessoa com deficiência"',
    );
    await expect(page.getByRole('checkbox', { name: 'Deficiência visual' })).toHaveCount(0);

    // CA-03: marcar a PCD abre os tipos, e a correção é possível.
    await page.getByRole('checkbox', { name: 'Pessoa com deficiência' }).check();
    await expect(page.locator('#atend-aviso-pcd-desmarcada')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Deficiência visual' }).check();
    await expect(page.getByRole('checkbox', { name: 'Deficiência visual' })).toBeChecked();
  });
});

async function mockarApi(page: Page, catalogo: { condicoes: readonly object[] }): Promise<void> {
  // A rota genérica é registrada primeiro: o Playwright consulta da mais recente à mais antiga.
  await responder(page, /\/api\//, () => [], CORS);
  await responder(
    page,
    /\/api\/configuracao\/tipos-processo(\?.*)?$/,
    () => TIPOS_DE_PROCESSO,
    CORS,
  );
  await responder(
    page,
    /\/api\/configuracao\/condicoes-atendimento(\?.*)?$/,
    () => catalogo.condicoes,
    CORS,
  );
  await responder(
    page,
    /\/api\/configuracao\/tipos-deficiencia(\?.*)?$/,
    () => [TIPO_VISUAL],
    CORS,
  );

  const id = PROCESSO_COM_FORMULARIO_QUE_PERGUNTA_O_TIPO.id;
  await page.route(new RegExp(`/api/selecao/processos-seletivos/${id}`), async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const caminho = new URL(route.request().url()).pathname;
    if (caminho.endsWith(id)) {
      await responderCom(route, PROCESSO_COM_FORMULARIO_QUE_PERGUNTA_O_TIPO, CORS);
    } else if (caminho.endsWith('/documentos-edital')) {
      await responderCom(route, [], CORS);
    } else {
      await route.fulfill({ status: 404, headers: CORS });
    }
  });
}
