import {
  assertAaaVisualContract,
  assertDocumentoSemRolagemVertical,
  assertReflowContract,
  assertTextSpacingResilience,
  runAxeWcagAAAApplicable,
} from '@uniplus/shared-e2e';
import type { CertamePublicoResponse } from '@uniplus/shared-data/portal';
import type { CertameNaVitrineDto, SituacaoDoCertame } from '@uniplus/shared-data/selecao';
import { test, expect, type Page } from '@playwright/test';

type AaaTheme = 'light' | 'dark' | 'contrast';
type AaaFontMode = 'default' | 'legible';
// O enum é só tipo aqui: importá-lo como valor carrega o Angular no processo do Playwright.
type Situacao = `${SituacaoDoCertame}`;
type Cenario = 'sucesso' | 'erro';

// A API fica em outra origem; sem expor `Link` e os `X-Certames-*` os chips ficam sem contagem.
// O CORS não aceita curinga parcial: cada header é listado pelo nome.
const API_URL = 'http://localhost:5000';
const ISSUER_URL = 'http://localhost:8080/realms/unifesspa';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
  'access-control-expose-headers': [
    'Link',
    'X-Certames-Em-Breve',
    'X-Certames-Inscricoes-Abertas',
    'X-Certames-Ultimos-Dias',
    'X-Certames-Encerrados',
  ].join(', '),
};

/** Uma de cada situação, para exercitar o contraste de todas as variantes de tag. */
const CERTAMES_POPULADOS = [
  certame(
    1,
    'ultimosDias',
    'Processo Seletivo Especial — Ingresso 2026.2',
    '012/2026',
    '2026-10-20T23:59:00Z',
    120,
  ),
  certame(
    2,
    'inscricoesAbertas',
    'Processo Seletivo de Pós-Graduação em Educação',
    '015/2026',
    '2026-12-05T23:59:00Z',
    40,
  ),
  certame(
    3,
    'emBreve',
    'Processo Seletivo de Mobilidade Acadêmica',
    null,
    '2027-01-15T23:59:00Z',
    18,
  ),
  certame(
    4,
    'encerradas',
    'Processo Seletivo de Transferência Externa 2026.1',
    '004/2026',
    '2026-03-10T23:59:00Z',
    1250,
  ),
];

// O portão não pode depender de servidor real: a vitrine é simulada na rede, em
// três cenários — populado, vazio e indisponível — e cada um roda nas dezoito combinações de
// largura, tema e modo de fonte (um projeto Playwright cada).
test.describe('Portal do Candidato — gate AAA aplicável @aaa', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await installA11yPreference(page, theme, fontMode);
  });

  test('vitrine populada passa AAA aplicável', async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockVitrine(page, CERTAMES_POPULADOS);

    await abrirVitrine(page, theme, fontMode, 'sucesso');

    await expect(page.locator('.portal-hero')).toBeVisible();
    for (const { nome } of CERTAMES_POPULADOS) {
      await expect(page.getByRole('heading', { name: nome, level: 3 })).toBeVisible();
    }
    // O link do edital só aparece depois que a consulta de publicações responde;
    // medir antes dele deixaria uma variante de link fora do portão.
    await expect(page.getByRole('link', { name: /Ver edital/ })).toHaveCount(
      CERTAMES_POPULADOS.length,
    );
    // Um certame em cada situação: cada chip mostra a contagem vinda dos headers.
    await expect(page.locator('.filter-chip__count')).toHaveText(['1', '1', '1', '1']);
    await expect(page.getByText('Nenhum certame publicado no momento')).toHaveCount(0);

    await assertAcessibilidade(page, fontMode);
  });

  test('estado vazio passa AAA aplicável', async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockVitrine(page, []);

    await abrirVitrine(page, theme, fontMode, 'sucesso');

    await expect(
      page.getByRole('heading', { name: 'Nenhum certame publicado no momento' }),
    ).toBeVisible();
    await expect(page.locator('.portal-hero')).toHaveCount(0);

    await assertAcessibilidade(page, fontMode);
  });

  test('estado de erro passa AAA aplicável', async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockVitrine(page, 'indisponivel');

    await abrirVitrine(page, theme, fontMode, 'erro');

    await expect(page.getByRole('alert')).toContainText('Serviço temporariamente indisponível');
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(page.locator('.portal-hero')).toHaveCount(0);

    await assertAcessibilidade(page, fontMode);
  });
});

async function abrirVitrine(
  page: Page,
  theme: AaaTheme,
  fontMode: AaaFontMode,
  cenario: Cenario,
): Promise<void> {
  await page.goto('/processos');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expectFontMode(page, fontMode);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  // O título da página não depende do que a vitrine carregou.
  await expect(page.getByRole('heading', { name: 'Processos seletivos', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Editais', level: 2 })).toBeVisible();
  await expect(page.locator('.institutional-bar')).toBeVisible();
  await expect(page.locator('.gov-bar')).toHaveCount(0);
  // Só mede depois que a consulta simulada respondeu.
  await expect(page.locator('.certames-loading')).toHaveCount(0);
  if (cenario === 'sucesso') {
    // Simulação que não casa cai no estado de erro; o alerta dá o diagnóstico direto.
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
}

async function assertAcessibilidade(page: Page, fontMode: AaaFontMode): Promise<void> {
  const results = await runAxeWcagAAAApplicable(page);
  expect(results.violations).toEqual([]);
  await assertAaaVisualContract(page, { fontMode });
  await assertReflowContract(page);
  await assertDocumentoSemRolagemVertical(page);
  await assertTextSpacingResilience(page);
}

function certame(
  indice: number,
  situacao: Situacao,
  nome: string,
  numero: string | null,
  inscricoesAte: string,
  totalDeVagas: number,
): CertameNaVitrineDto {
  return {
    processoSeletivoId: `01960000-0000-7000-0000-${String(indice).padStart(12, '0')}`,
    identificadorLegivel: `PS-2026-${String(indice).padStart(3, '0')}`,
    numero,
    nome,
    tipoProcesso: { codigo: 'PSE', nome: 'Processo Seletivo Especial' },
    modalidadesOfertadas: ['AC', 'PCD'],
    inscricoesDe: '2026-01-01T12:00:00Z',
    inscricoesAte,
    situacao: situacao as SituacaoDoCertame,
    totalDeVagas,
  };
}

/**
 * Simula o `runtime-config.json`, `GET /api/selecao/certames` (com os
 * contadores por situação) e a página pública de cada certame na Portal API,
 * que a vitrine consulta ao carregar para exibir o link do edital. O detalhe
 * (`/api/selecao/certames/{id}`) não é simulado de propósito: só é consultado
 * quando o accordion de documentos abre.
 */
async function mockVitrine(
  page: Page,
  certames: readonly CertameNaVitrineDto[] | 'indisponivel',
): Promise<void> {
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

  // O `check-sso` do início da app consulta o provedor OIDC: sem resposta, a app
  // exibe o aviso de autenticação indisponível e o portão passaria a medir esse
  // aviso, e não a vitrine. O provedor simulado aceita a checagem de cookies de
  // terceiros e responde que não há sessão.
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

  const lista = certames === 'indisponivel' ? [] : certames;
  const contar = (situacao: Situacao): string =>
    String(lista.filter((item) => item.situacao === situacao).length);

  await page.route(/\/api\/selecao\/certames(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    if (certames === 'indisponivel') {
      return route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        headers: CORS_HEADERS,
        body: JSON.stringify({
          type: 'https://uniplus.unifesspa.edu.br/problems/indisponivel',
          title: 'Serviço temporariamente indisponível',
          status: 503,
          code: 'uniplus.indisponivel',
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.uniplus.certame.v1+json',
      headers: {
        ...CORS_HEADERS,
        'X-Certames-Em-Breve': contar('emBreve'),
        'X-Certames-Inscricoes-Abertas': contar('inscricoesAbertas'),
        'X-Certames-Ultimos-Dias': contar('ultimosDias'),
        'X-Certames-Encerrados': contar('encerradas'),
      },
      body: JSON.stringify(lista),
    });
  });

  await page.route(/\/api\/portal\/certames\/[^/?]+(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    const identificador = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').pop() ?? '',
    );
    const publicacoes: CertamePublicoResponse = {
      identificador,
      nome: identificador,
      numeroEdital: null,
      documentoEditalUrl: `https://acervo.unifesspa.edu.br/editais/${identificador}.pdf`,
      dataPublicacao: '2026-01-01',
      linhaDoTempo: [],
      aviso: null,
    };
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
