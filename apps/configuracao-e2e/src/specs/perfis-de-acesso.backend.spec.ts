import { test, expect } from '@playwright/test';
import { PDF_MINIMO, acharNaListagem, entrarComoPersona, lerPerfil, prepararAcessosDaSimulacao } from '@uniplus/shared-e2e';

/**
 * Administração de perfis contra a API real: o catálogo agrupado por módulo e resource,
 * as permissões de arquivo por classe (web#1317) e as permissões de dado e de revelação. A spec
 * monta um perfil novo pela tela, com um nome por execução, e confere o que a API gravou.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const ROTA = '/acessos/perfis';

interface PerfilGravado {
  readonly id: string;
  readonly nome: string;
}

test.describe('Administração de perfis de acesso', () => {
  test.beforeAll(async () => {
    test.setTimeout(600_000);
    await prepararAcessosDaSimulacao();
  });

  test('o catálogo agrupa as permissões por módulo e resource e traz as de dado e de arquivo', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', ROTA);
    await expect(pagina.getByRole('heading', { level: 1, name: 'Perfis de acesso' })).toBeVisible();

    await pagina.getByRole('button', { name: 'Novo perfil' }).click();

    await expect(pagina.getByText('selecao · inscricoes', { exact: true })).toBeVisible();
    await expect(pagina.getByText('selecao · dados-pessoais', { exact: true })).toBeVisible();
    await expect(pagina.getByText('selecao · documentos-identificadores', { exact: true })).toBeVisible();
    for (const codigo of [
      'selecao:documentos-publicos:consultar',
      'selecao:documentos-internos:consultar',
      'selecao:documentos-identificadores:consultar',
      'selecao:documentos-pessoais:consultar',
      'selecao:documentos-sensiveis:consultar',
      'selecao:dados-publicos:consultar',
      'selecao:dados-internos:consultar',
      'selecao:dados-pessoais:consultar',
      'selecao:dados-sensiveis:consultar',
      'selecao:dados-identificadores:revelar',
      'configuracao:protecao-do-catalogo:aprovar',
    ]) {
      await expect(pagina.getByText(codigo, { exact: true }), codigo).toBeVisible();
    }
  });

  test('a permissão antiga de revelar o CPF saiu do catálogo e o nome de negócio dos recursos de acessibilidade permanece', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', ROTA);
    await pagina.getByRole('button', { name: 'Novo perfil' }).click();

    await expect(pagina.getByText('configuracao:recursos-acessibilidade:manter', { exact: true })).toBeVisible();
    await expect(pagina.getByText('selecao:inscricoes:revelar-cpf')).toHaveCount(0);
  });

  test('monta um perfil com as permissões de arquivo e de dado e a API grava a versão pendente com o que foi marcado', async ({ browser }) => {
    const nome = `E2E projeção — perfil da tela ${Date.now()}`;
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', ROTA);
    await pagina.getByRole('button', { name: 'Novo perfil' }).click();

    await pagina.getByLabel('Nome', { exact: true }).fill(nome);
    await pagina.getByLabel('Descrição').fill('Perfil criado pela simulação ponta a ponta.');
    for (const codigo of [
      'selecao:inscricoes:consultar',
      'selecao:documentos-identificadores:consultar',
      'selecao:documentos-internos:consultar',
      'selecao:documentos-publicos:consultar',
      'selecao:dados-pessoais:consultar',
      'selecao:dados-identificadores:consultar',
      'selecao:dados-identificadores:revelar',
    ]) {
      await pagina.locator('label.checkbox', { has: pagina.getByText(codigo, { exact: true }) }).click();
    }
    await pagina.getByLabel('Protocolo do documento').fill(`E2E-${Date.now()}`);
    await pagina.locator('input[type="file"]').setInputFiles({ name: 'portaria.pdf', mimeType: 'application/pdf', buffer: PDF_MINIMO });
    await pagina.getByRole('button', { name: 'Salvar perfil' }).click();

    // A lista é paginada e o perfil novo pode cair noutra página; a confirmação da tela e a API bastam.
    await expect(pagina.getByText('Perfil criado', { exact: true })).toBeVisible();
    const gravado = await acharNaListagem<PerfilGravado>('diogo.souza', '/api/autorizacao/perfis?limit=100', (p) => p.nome === nome);
    // A versão nasce pendente: as permissões marcadas estão na proposta, ainda não em vigor.
    const pendente = (await lerPerfil(gravado?.id ?? '')).versaoPendente;
    expect(pendente?.permissoes.map((p) => p.codigo).sort()).toEqual([
      'selecao:dados-identificadores:consultar',
      'selecao:dados-identificadores:revelar',
      'selecao:dados-pessoais:consultar',
      'selecao:documentos-identificadores:consultar',
      'selecao:documentos-internos:consultar',
      'selecao:documentos-publicos:consultar',
      'selecao:inscricoes:consultar',
    ]);
  });
});
