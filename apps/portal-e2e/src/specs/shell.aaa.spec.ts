import {
  assertAaaVisualContract,
  assertDocumentoSemRolagemVertical,
  assertReflowContract,
  assertTextSpacingResilience,
  runAxeWcagAAAApplicable,
} from '@uniplus/shared-e2e';
import type { CertamePublicoResponse } from '@uniplus/shared-data/portal';
import type { CertameNaVitrineDto, SituacaoDoCertameCodigo } from '@uniplus/shared-data/selecao';
import { test, expect, type Page } from '@playwright/test';
import { conferirAvisoDeAutenticacao, conferirVitrinePopulada } from '../support/passos-da-vitrine';

type AaaTheme = 'light' | 'dark' | 'contrast';
type AaaFontMode = 'default' | 'legible';
// O enum é só tipo aqui: importá-lo como valor carrega o Angular no processo do Playwright.
type Situacao = `${SituacaoDoCertameCodigo}`;
const ROTULOS: Record<Situacao, string> = {
  EM_BREVE: 'Em breve',
  INSCRICOES_ABERTAS: 'Inscrições abertas',
  ULTIMOS_DIAS: 'Últimos dias',
  ENCERRADAS: 'Encerradas',
};
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
  certame({
    indice: 1,
    situacao: 'ULTIMOS_DIAS',
    nome: 'Processo Seletivo Especial — Ingresso 2026.2',
    numero: '012/2026',
    inscricoesAte: '2026-10-20T23:59:00Z',
    totalDeVagas: 120,
  }),
  certame({
    indice: 2,
    situacao: 'INSCRICOES_ABERTAS',
    nome: 'Processo Seletivo de Pós-Graduação em Educação',
    numero: '015/2026',
    inscricoesAte: '2026-12-05T23:59:00Z',
    totalDeVagas: 40,
  }),
  certame({
    indice: 3,
    situacao: 'EM_BREVE',
    nome: 'Processo Seletivo de Mobilidade Acadêmica',
    numero: null,
    inscricoesAte: '2027-01-15T23:59:00Z',
    totalDeVagas: 18,
  }),
  certame({
    indice: 4,
    situacao: 'ENCERRADAS',
    nome: 'Processo Seletivo de Transferência Externa 2026.1',
    numero: '004/2026',
    inscricoesAte: '2026-03-10T23:59:00Z',
    totalDeVagas: 1250,
  }),
];

// O portão não pode depender de servidor real: a vitrine é simulada na rede, em
// quatro cenários — populado, vazio, indisponível e autenticação indisponível — e cada um roda nas dezoito combinações de
// largura, tema e modo de fonte (um projeto Playwright cada).
const PRAZO_DA_AUTENTICACAO_INDISPONIVEL = 30_000;

test.describe('Portal do Candidato — gate AAA aplicável @aaa', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await installA11yPreference(page, theme, fontMode);
  });

  test('vitrine populada passa AAA aplicável', async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockVitrine(page, CERTAMES_POPULADOS);

    await abrirVitrine(page, { theme, fontMode, cenario: 'sucesso' });

    await conferirVitrinePopulada(
      page,
      CERTAMES_POPULADOS.map(({ nome }) => nome),
    );

    await assertAcessibilidade(page, fontMode);
  });

  test('estado vazio passa AAA aplicável', async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockVitrine(page, []);

    await abrirVitrine(page, { theme, fontMode, cenario: 'sucesso' });

    await expect(
      page.getByRole('heading', { name: 'Nenhum certame publicado no momento' }),
    ).toBeVisible();
    await expect(page.locator('.portal-hero')).toHaveCount(0);

    await assertAcessibilidade(page, fontMode);
  });

  test('estado de erro passa AAA aplicável', async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockVitrine(page, 'indisponivel');

    await abrirVitrine(page, { theme, fontMode, cenario: 'erro' });

    await expect(page.getByRole('alert')).toContainText('Serviço temporariamente indisponível');
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(page.locator('.portal-hero')).toHaveCount(0);

    await assertAcessibilidade(page, fontMode);
  });

  test('autenticação indisponível passa AAA aplicável', async ({ page }, testInfo) => {
    const { theme, fontMode } = settingsFromProjectName(testInfo.project.name);
    await mockVitrine(page, CERTAMES_POPULADOS, 'indisponivel');
    test.setTimeout(PRAZO_DA_AUTENTICACAO_INDISPONIVEL * 2);
    await abrirVitrine(page, {
      theme,
      fontMode,
      cenario: 'erro',
      prazoDaInicializacao: PRAZO_DA_AUTENTICACAO_INDISPONIVEL,
    });
    await conferirAvisoDeAutenticacao(page);
    await assertAcessibilidade(page, fontMode);
  });
});

interface OpcoesDaVitrine {
  theme: AaaTheme;
  fontMode: AaaFontMode;
  cenario: Cenario;
  prazoDaInicializacao?: number;
}

async function abrirVitrine(
  page: Page,
  { theme, fontMode, cenario, prazoDaInicializacao }: OpcoesDaVitrine,
): Promise<void> {
  await page.goto('/processos');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme, {
    timeout: prazoDaInicializacao,
  });
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

interface CertameDaVitrine {
  indice: number;
  situacao: Situacao;
  nome: string;
  numero: string | null;
  inscricoesAte: string;
  totalDeVagas: number;
}

function certame({
  indice,
  situacao,
  nome,
  numero,
  inscricoesAte,
  totalDeVagas,
}: CertameDaVitrine): CertameNaVitrineDto {
  return {
    processoSeletivoId: `01960000-0000-7000-0000-${String(indice).padStart(12, '0')}`,
    identificadorLegivel: `PS-2026-${String(indice).padStart(3, '0')}`,
    numero,
    nome,
    tipoProcesso: { codigo: 'EDUCACAO_DO_CAMPO', nome: 'Processo Seletivo Especial do Campo' },
    modalidadesOfertadas: ['AC', 'PCD'],
    inscricoesDe: '2026-01-01T12:00:00Z',
    inscricoesAte,
    situacao: { codigo: situacao as SituacaoDoCertameCodigo, rotulo: ROTULOS[situacao] },
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
  oidc: 'disponivel' | 'indisponivel' = 'disponivel',
): Promise<void> {
  await page.route(/\/assets\/runtime-config\.json(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiUrl: API_URL,
        oidc: {
          issuerUrl: ISSUER_URL,
          clientId: 'portal-web',
          antecedenciaDaRenovacaoEmSegundos: 60,
        },
      }),
    }),
  );

  // O `check-sso` do início da app consulta o provedor OIDC: sem resposta, a app
  // exibe o aviso de autenticação indisponível e o portão passaria a medir esse
  // aviso, e não a vitrine. Por padrão, o provedor simulado aceita a checagem de
  // cookies de terceiros e responde que não há sessão; no cenário `indisponivel`,
  // ele recusa a conexão para o portão medir justamente o aviso.
  if (oidc === 'indisponivel') {
    await page.route(`${ISSUER_URL}/**`, (route) => route.abort('connectionrefused'));
  } else {
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
  }

  const lista = certames === 'indisponivel' ? [] : certames;
  const contar = (situacao: Situacao): string =>
    String(lista.filter((item) => item.situacao.codigo === situacao).length);

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
          code: 'uniplus.internal.unexpected',
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.uniplus.certame.v1+json',
      headers: {
        ...CORS_HEADERS,
        'X-Certames-Em-Breve': contar('EM_BREVE'),
        'X-Certames-Inscricoes-Abertas': contar('INSCRICOES_ABERTAS'),
        'X-Certames-Ultimos-Dias': contar('ULTIMOS_DIAS'),
        'X-Certames-Encerrados': contar('ENCERRADAS'),
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
      situacao: 'inscricoesAbertas' as CertamePublicoResponse['situacao'],
      documentoEditalUrl: `https://acervo.unifesspa.edu.br/editais/${identificador}.pdf`,
      dataDoAto: '2026-01-01',
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
