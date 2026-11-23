import { test, expect } from '@playwright/test';
import {
  entrarComoPersona,
  garantirConcessao,
  assertReflowContract,
  garantirPerfil,
  runAxeWcagAA,
  runAxeWcagAAAApplicable,
  unidadeDoCertame,
} from '@uniplus/shared-e2e';
import { listarProcessos } from '../fixtures/processos-da-api';
import { rascunhoDoAcompanhamento } from '../fixtures/rascunho-do-acompanhamento';

/**
 * Página de acompanhamento de um processo (web#1286) contra a API real: identificação do processo,
 * trilha, atalhos conforme a permissão de configurar, recusas e o percurso painel → processo → painel.
 *
 * Cada papel tem uma pessoa reservada a esta spec; nenhuma outra spec nem o suporte a usa.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';

const QUEM_CONFIGURA = 'thiago.silva';
const QUEM_SO_ACOMPANHA = 'vera.pereira';
const QUEM_NAO_TEM_PERMISSAO = 'sergio.dias';
const INEXISTENTE = '99999999-9999-4999-8999-999999999999';
const AVISO = 'Não há informações de acompanhamento disponíveis no momento';

const PERFIS = [
  { persona: QUEM_CONFIGURA, permissoes: ['selecao:processos:configurar'] },
  { persona: QUEM_SO_ACOMPANHA, permissoes: ['selecao:processos:acompanhar'] },
] as const;

test.describe('Acompanhamento do processo seletivo', () => {
  let cenario: { readonly processoId: string; readonly nomeDoProcesso: string };
  let url: string;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    const publicado = (await listarProcessos()).find((processo) => processo.status === 'publicado');
    if (publicado === undefined) throw new Error('A base não tem processo publicado.');
    cenario = { processoId: publicado.id, nomeDoProcesso: publicado.nome };
    url = `/acompanhamento/processos/${cenario.processoId}`;
    for (const { persona, permissoes } of PERFIS) {
      const perfil = await garantirPerfil(
        `E2E acompanhamento — ${persona}`,
        `Acesso ao acompanhamento para ${persona}.`,
        permissoes,
      );
      await garantirConcessao(persona, perfil, await unidadeDoCertame());
    }
  });

  test('acesso direto e recarregamento identificam o processo, só com a seção Acompanhamento', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_SO_ACOMPANHA, url);

    for (let vez = 0; vez < 2; vez++) {
      await expect(
        pagina.getByRole('heading', { level: 1, name: cenario.nomeDoProcesso }),
      ).toBeVisible();
      await expect(pagina.getByRole('heading', { level: 2, name: 'Acompanhamento' })).toBeVisible();
      await expect(pagina.getByText(AVISO)).toBeVisible();
      await expect(pagina.getByRole('tab')).toHaveCount(0);
      const trilha = pagina.getByRole('navigation', { name: 'Breadcrumb' });
      await expect(trilha).toContainText('Painel de processos');
      await expect(trilha).toContainText(cenario.nomeDoProcesso);
      await pagina.reload();
    }
  });

  test('quem só acompanha não recebe os atalhos de editar nem de publicações', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_SO_ACOMPANHA, url);

    await expect(pagina.getByText(AVISO)).toBeVisible();
    await expect(pagina.getByRole('link', { name: 'Editar processo' })).toHaveCount(0);
    await expect(pagina.getByRole('link', { name: 'Publicações' })).toHaveCount(0);
  });

  test('quem configura recebe os atalhos, que levam ao editor e às publicações', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_CONFIGURA, url);

    await expect(pagina.getByText(AVISO)).toBeVisible();
    await expect(pagina.getByRole('link', { name: 'Editar processo' })).toHaveAttribute(
      'href',
      `/processo-seletivo/${cenario.processoId}`,
    );
    await expect(pagina.getByRole('link', { name: 'Publicações' })).toHaveAttribute(
      'href',
      `/processo-seletivo/${cenario.processoId}/publicacoes`,
    );
    await pagina.getByRole('link', { name: 'Publicações' }).click();
    await expect(pagina).toHaveURL(
      new RegExp(`/processo-seletivo/${cenario.processoId}/publicacoes`),
    );
  });

  test('a identificação do processo publicado abre sem nenhuma permissão administrativa', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_NAO_TEM_PERMISSAO, url);

    await expect(
      pagina.getByRole('heading', { level: 1, name: cenario.nomeDoProcesso }),
    ).toBeVisible();
    await expect(pagina.getByRole('link', { name: 'Editar processo' })).toHaveCount(0);
  });

  test('processo inexistente e identificador malformado mostram não encontrado, com retorno ao painel', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_SO_ACOMPANHA,
      `/acompanhamento/processos/${INEXISTENTE}`,
    );

    await expect(pagina.getByText('Processo seletivo não encontrado')).toBeVisible();
    await expect(pagina.getByText(AVISO)).toHaveCount(0);

    await pagina.goto('/acompanhamento/processos/nao-e-um-uuid');
    await expect(pagina.getByText('Processo seletivo não encontrado')).toBeVisible();
    await pagina.getByRole('link', { name: 'Voltar ao painel' }).click();
    await expect(pagina).toHaveURL(/\/dashboard$/);
  });

  test('percurso painel → processo → painel', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_SO_ACOMPANHA, '/dashboard');

    await pagina
      .getByRole('button', { name: `Abrir acompanhamento de ${cenario.nomeDoProcesso}` })
      .click();
    await expect(pagina).toHaveURL(new RegExp(`/acompanhamento/processos/${cenario.processoId}$`));
    await expect(
      pagina.getByRole('heading', { level: 1, name: cenario.nomeDoProcesso }),
    ).toBeVisible();

    await pagina.getByRole('link', { name: 'Voltar ao painel' }).click();
    await expect(pagina).toHaveURL(/\/dashboard$/);
    await pagina.goBack();
    await pagina
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Painel de processos' })
      .click();
    await expect(pagina).toHaveURL(/\/dashboard$/);
  });

  test('sem violações WCAG A/AA e sem transbordo a 320 px, com o foco visível na ação', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_CONFIGURA, url);
    await expect(pagina.getByText(AVISO)).toBeVisible();

    expect((await runAxeWcagAA(pagina)).violations).toEqual([]);

    await pagina.setViewportSize({ width: 320, height: 720 });
    await assertReflowContract(pagina);
    await pagina.getByRole('link', { name: 'Voltar ao painel' }).focus();
    await expect(pagina.getByRole('link', { name: 'Voltar ao painel' })).toBeFocused();
  });

  test('rascunho: quem não configura vê não encontrado; quem configura vê só o atalho de editar', async ({
    browser,
  }) => {
    const rascunho = await rascunhoDoAcompanhamento(QUEM_CONFIGURA);
    const alvo = `/acompanhamento/processos/${rascunho.id}`;

    const semPermissao = await entrarComoPersona(browser, APP, QUEM_SO_ACOMPANHA, alvo);
    await expect(semPermissao.getByText('Processo seletivo não encontrado')).toBeVisible();
    await expect(semPermissao.getByText(rascunho.nome)).toHaveCount(0);

    const quemConfigura = await entrarComoPersona(browser, APP, QUEM_CONFIGURA, alvo);
    await expect(
      quemConfigura.getByRole('heading', { level: 1, name: rascunho.nome }),
    ).toBeVisible();
    await expect(quemConfigura.getByRole('link', { name: 'Editar processo' })).toBeVisible();
    await expect(quemConfigura.getByRole('link', { name: 'Publicações' })).toHaveCount(0);
  });

  test('tema contraste: sem violações WCAG AA/AAA aplicáveis e sem transbordo a 320 px', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_CONFIGURA, url);
    await expect(pagina.getByText(AVISO)).toBeVisible();

    await pagina.evaluate(() =>
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({ theme: 'auto', contrast: true, fontMode: 'default' }),
      ),
    );
    await pagina.reload();
    await expect(pagina.getByText(AVISO)).toBeVisible();
    await expect(pagina.locator('html')).toHaveAttribute('data-theme', 'contrast');

    expect((await runAxeWcagAAAApplicable(pagina)).violations).toEqual([]);
    await pagina.setViewportSize({ width: 320, height: 720 });
    await assertReflowContract(pagina);
  });
});
