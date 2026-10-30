import {
  assertAaaVisualContract,
  assertDocumentoSemRolagemVertical,
  assertReflowContract,
  assertTextSpacingResilience,
  runAxeWcagAAAApplicable,
} from '@uniplus/shared-e2e';
import type {
  DocumentoDoEventoResponse,
  CertamePublicoResponse,
  EventoDaLinhaDoTempoResponse,
} from '@uniplus/shared-data/portal';
import type { CertameNaVitrineDto, SituacaoDoCertame } from '@uniplus/shared-data/selecao';
import { test, expect, type Locator, type Page } from '@playwright/test';

type AaaTheme = 'light' | 'dark' | 'contrast';
type AaaFontMode = 'default' | 'legible';

// A API fica em outra origem; sem expor `Link` os controles de paginação ficam sem destino.
// O CORS não aceita curinga parcial: cada header é listado pelo nome.
const API_URL = 'http://localhost:5000';
const ISSUER_URL = 'http://localhost:8080/realms/unifesspa';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const CERTAME: CertameNaVitrineDto = {
  processoSeletivoId: '01960000-0000-7000-0000-000000000099',
  identificadorLegivel: 'PS-2026-099',
  numero: '020/2026',
  nome: 'Processo Seletivo Simulado — Portão de Acessibilidade',
  tipoProcesso: { codigo: 'PSE', nome: 'Processo Seletivo Especial' },
  modalidadesOfertadas: ['AC'],
  inscricoesDe: '2026-01-01T12:00:00Z',
  inscricoesAte: '2026-12-05T23:59:00Z',
  situacao: 'inscricoesAbertas' as SituacaoDoCertame,
  totalDeVagas: 50,
};

/**
 * `PapelDoDocumento` não é importado como valor: o enum vive junto do schema OpenAPI, cujo
 * módulo carrega o cliente HTTP do Angular — e o processo do Playwright, sem `@angular/compiler`,
 * não consegue compilar os `@Injectable` desse caminho (mesmo racional do `Situacao` em
 * `shell.aaa.spec.ts`).
 */
function documento(papel: 'principal' | 'anexo', nome: string): DocumentoDoEventoResponse {
  return {
    papel: papel as DocumentoDoEventoResponse['papel'],
    nome,
    tipoDeMidia: 'application/pdf',
    tamanhoBytes: 245_000,
    url: `https://acervo.unifesspa.edu.br/editais/${nome}`,
  };
}

/** Edital de abertura com documento principal e um anexo — o ato que "certame completo" exige. */
const EVENTO_COM_DOCUMENTOS: EventoDaLinhaDoTempoResponse = {
  id: '01970000-0000-7000-0000-000000000001',
  data: '2026-01-01',
  titulo: 'Edital de abertura',
  numero: CERTAME.numero,
  ano: 2026,
  tipo: { codigo: 'EDITAL_ABERTURA', nome: 'Edital de abertura' },
  descricao: null,
  documentoUrl: null,
  documentos: [
    documento('principal', 'edital-020-2026.pdf'),
    documento('anexo', 'anexo-i-cronograma.pdf'),
  ],
};

const CERTAME_COMPLETO: CertamePublicoResponse = {
  identificador: CERTAME.identificadorLegivel,
  nome: CERTAME.nome,
  numeroEdital: CERTAME.numero,
  documentoEditalUrl: 'https://acervo.unifesspa.edu.br/editais/edital-020-2026.pdf',
  dataPublicacao: '2026-01-01',
  linhaDoTempo: [EVENTO_COM_DOCUMENTOS],
  aviso: null,
};

/** Estado degradado: nenhum ato registrado ainda — o mais fácil de esquecer no portão. */
const CERTAME_SEM_ATOS: CertamePublicoResponse = {
  identificador: CERTAME.identificadorLegivel,
  nome: CERTAME.nome,
  numeroEdital: CERTAME.numero,
  documentoEditalUrl: null,
  dataPublicacao: null,
  linhaDoTempo: [],
  aviso: null,
};

test.describe('Painel de publicações do certame — gate AAA aplicável @aaa', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await installA11yPreference(page, theme, fontMode);
  });

  test('certame completo (atos e edital disponíveis) passa AAA aplicável', async ({
    page,
  }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockCertame(page, CERTAME_COMPLETO);

    const painel = await abrirPainelDePublicacoes(page, theme, fontMode);

    await expect(painel.getByRole('heading', { level: 4, name: 'Edital de abertura' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Documento principal' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Anexos (1)' })).toBeVisible();
    await expect(
      painel.getByRole('link', { name: /^edital-020-2026\.pdf/ }),
    ).toHaveAttribute('href', EVENTO_COM_DOCUMENTOS.documentos[0].url);
    await expect(painel.getByText('Nenhuma publicação ainda')).toHaveCount(0);

    await assertAcessibilidade(page, fontMode);
  });

  test('certame sem os atos registrados (estado degradado) passa AAA aplicável', async ({
    page,
  }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockCertame(page, CERTAME_SEM_ATOS);

    const painel = await abrirPainelDePublicacoes(page, theme, fontMode);

    await expect(
      painel.getByRole('heading', { name: 'Nenhuma publicação ainda' }),
    ).toBeVisible();
    await expect(painel.getByRole('listitem')).toHaveCount(0);

    await assertAcessibilidade(page, fontMode);
  });
});

async function abrirPainelDePublicacoes(
  page: Page,
  theme: AaaTheme,
  fontMode: AaaFontMode,
): Promise<Locator> {
  await page.goto('/processos');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expectFontMode(page, fontMode);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Processos seletivos', level: 1 })).toBeVisible();
  await expect(page.locator('.certames-loading')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: CERTAME.nome, level: 3 })).toBeVisible();

  const botao = page.getByRole('button', { name: `Ver publicações — ${CERTAME.nome}` }).first();
  await botao.click();
  await expect(botao).toHaveAttribute('aria-expanded', 'true');

  const painel = page.getByRole('region', { name: `Ver publicações — ${CERTAME.nome}` }).first();
  await expect(painel.locator('.publicacoes-loading')).toHaveCount(0);
  return painel;
}

async function assertAcessibilidade(page: Page, fontMode: AaaFontMode): Promise<void> {
  const results = await runAxeWcagAAAApplicable(page);
  expect(results.violations).toEqual([]);
  await assertAaaVisualContract(page, { fontMode });
  await assertReflowContract(page);
  await assertDocumentoSemRolagemVertical(page);
  await assertTextSpacingResilience(page);
}

/**
 * Simula o `runtime-config.json`, `GET /api/selecao/certames` com um único certame aberto, e a
 * página pública dele na Portal API — o contrato que a `ptl-certame-publicacoes` lê ao abrir o
 * painel.
 */
async function mockCertame(page: Page, publicacoes: CertamePublicoResponse): Promise<void> {
  await page.route(/\/assets\/runtime-config\.json(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiUrl: API_URL,
        oidc: { issuerUrl: ISSUER_URL, clientId: 'portal-web' },
      }),
    }),
  );

  // O `check-sso` do início da app consulta o provedor OIDC em silêncio; sem resposta a app
  // oscila entre aviso de autenticação indisponível e a vitrine, e o portão mediria o aviso.
  await page.route(`${ISSUER_URL}/protocol/openid-connect/3p-cookies/step1.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<script>parent.postMessage("supported", "*");</script>',
    }),
  );
  await page.route(`${ISSUER_URL}/protocol/openid-connect/auth?*`, (route) => {
    const url = new URL(route.request().url());
    const retorno = url.searchParams.get('redirect_uri') ?? '';
    const estado = url.searchParams.get('state') ?? '';
    return route.fulfill({
      status: 302,
      headers: { location: `${retorno}#error=login_required&state=${estado}` },
    });
  });

  await page.route(/\/api\/selecao\/certames(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.uniplus.certame.v1+json',
      headers: CORS_HEADERS,
      body: JSON.stringify([CERTAME]),
    });
  });

  await page.route(/\/api\/portal\/certames\/[^/?]+(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.uniplus.certame-publico.v1+json',
      headers: CORS_HEADERS,
      body: JSON.stringify(publicacoes),
    });
  });
}

async function installA11yPreference(
  page: Page,
  theme: AaaTheme,
  fontMode: AaaFontMode,
): Promise<void> {
  await page.addInitScript(
    ({ theme: dsTheme, fontMode: dsFontMode }) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: dsFontMode,
        }),
      );
    },
    { theme, fontMode },
  );
}

async function expectFontMode(page: Page, fontMode: AaaFontMode): Promise<void> {
  if (fontMode === 'legible') {
    await expect(page.locator('html')).toHaveAttribute('data-font-mode', 'legible');
    return;
  }

  await expect(page.locator('html')).not.toHaveAttribute('data-font-mode', 'legible');
}

function settingsFromProjectName(projectName: string): {
  theme: AaaTheme;
  fontMode: AaaFontMode;
} {
  const parts = projectName.split('-');
  return {
    theme: parts[2] === 'dark' || parts[2] === 'contrast' ? parts[2] : 'light',
    fontMode: parts[3] === 'legible' ? 'legible' : 'default',
  };
}
