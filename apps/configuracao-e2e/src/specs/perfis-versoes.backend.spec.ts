import { expect, test, type Page } from '@playwright/test';
import {
  GESTOR_DE_ACESSOS,
  PDF_MINIMO,
  PROTECAO_DE_DADOS,
  SEGUNDO_GESTOR_DE_ACESSOS,
  acharNaListagem,
  aguardarDocumentoVerificado,
  codigosEmVigor,
  diferencaDeComposicao,
  garantirPerfil,
  entrarComoPersona,
  lerPerfil,
  prepararAcessosDaSimulacao,
} from '@uniplus/shared-e2e';

/**
 * Perfil como versão aprovada, contra a API real: quem tem a gestão de acessos cria o perfil pela
 * tela com o documento instituidor, e outras duas pessoas aprovam, uma em cada etapa. A versão só
 * entra em vigor depois da última aprovação.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const PERMISSAO_SENSIVEL = 'selecao:dados-pessoais:consultar';
const PERMISSAO_COMUM = 'selecao:inscricoes:consultar';

interface PerfilListado {
  readonly id: string;
  readonly nome: string;
}

async function aprovarNaFila(pagina: Page, rota: string, nome: string): Promise<void> {
  await pagina.goto(rota);
  const versao = pagina.locator('section.panel', { hasText: nome });
  await expect(versao).toBeVisible();
  await versao.getByRole('button', { name: 'Aprovar' }).click();
  await expect(pagina.getByText('Versão aprovada', { exact: true })).toBeVisible();
  await expect(versao).toHaveCount(0);
}

test.describe('Perfil como versão aprovada', () => {
  test.beforeAll(async () => {
    test.setTimeout(600_000);
    await prepararAcessosDaSimulacao();
  });

  test('cria a versão pela tela e a aprova na gestão de acessos e na proteção de dados', async ({ browser }) => {
    test.setTimeout(300_000);
    const nome = `E2E versões — perfil da tela ${Date.now()}`;
    const autor = await entrarComoPersona(browser, APP, SEGUNDO_GESTOR_DE_ACESSOS, '/acessos/perfis');

    await autor.getByRole('button', { name: 'Novo perfil' }).click();
    await autor.getByLabel('Nome', { exact: true }).fill(nome);
    await autor.getByLabel('Descrição').fill('Perfil criado pela simulação ponta a ponta das versões.');
    for (const codigo of [PERMISSAO_COMUM, PERMISSAO_SENSIVEL]) {
      await autor.locator('label.checkbox', { has: autor.getByText(codigo, { exact: true }) }).click();
    }
    await autor.getByLabel('Protocolo do documento').fill(`E2E-${Date.now()}`);
    await autor.locator('input[type="file"]').setInputFiles({ name: 'portaria.pdf', mimeType: 'application/pdf', buffer: PDF_MINIMO });
    await autor.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(autor.getByText('Perfil criado', { exact: true })).toBeVisible();

    const criado = await acharNaListagem<PerfilListado>(SEGUNDO_GESTOR_DE_ACESSOS, '/api/autorizacao/perfis?limit=100', (p) => p.nome === nome);
    expect(criado, 'o perfil criado aparece na lista').toBeDefined();
    const { id: perfilId } = criado as PerfilListado;
    expect((await lerPerfil(perfilId)).composicaoEmVigor).toBeNull();

    await aguardarDocumentoVerificado(perfilId);

    await autor.getByRole('link', { name: 'Versões na gestão de acessos' }).click();
    const propria = autor.locator('section.panel', { hasText: nome });
    await propria.getByRole('button', { name: 'Aprovar' }).click();
    await expect(propria.getByText('Quem criou a versão não pode aprová-la nem recusá-la.')).toBeVisible();

    const gestao = await entrarComoPersona(browser, APP, GESTOR_DE_ACESSOS, '/acessos/versoes-de-perfil/gestao-de-acessos');
    await aprovarNaFila(gestao, '/acessos/versoes-de-perfil/gestao-de-acessos', nome);
    expect((await lerPerfil(perfilId)).composicaoEmVigor, 'ainda falta a proteção de dados').toBeNull();

    const protecao = await entrarComoPersona(browser, APP, PROTECAO_DE_DADOS, '/acessos/versoes-de-perfil/protecao-de-dados');
    await aprovarNaFila(protecao, '/acessos/versoes-de-perfil/protecao-de-dados', nome);

    const emVigor = (await lerPerfil(perfilId)).composicaoEmVigor;
    expect(emVigor?.permissoes.map((p) => p.codigo).sort()).toEqual([PERMISSAO_SENSIVEL, PERMISSAO_COMUM].sort());
  });

  test('garantirPerfil reexecuta sobre composição divergente: acrescenta, retira e só retira', async () => {
    test.setTimeout(300_000);
    const nome = `E2E versões — recomposição ${Date.now()}`;
    const codigos = codigosEmVigor;

    const id = await garantirPerfil(nome, 'Recomposição da simulação.', [PERMISSAO_COMUM]);
    expect(await codigos(id)).toEqual([PERMISSAO_COMUM]);

    const acrescentando = await garantirPerfil(nome, 'Recomposição da simulação.', [PERMISSAO_COMUM, PERMISSAO_SENSIVEL]);
    expect(acrescentando).toBe(id);
    expect((await codigos(id)).sort()).toEqual([PERMISSAO_COMUM, PERMISSAO_SENSIVEL].sort());

    await garantirPerfil(nome, 'Recomposição da simulação.', [PERMISSAO_SENSIVEL]);
    expect(await codigos(id)).toEqual([PERMISSAO_SENSIVEL]);

    await garantirPerfil(nome, 'Recomposição da simulação.', [PERMISSAO_COMUM]);
    expect(await codigos(id)).toEqual([PERMISSAO_COMUM]);
    expect(diferencaDeComposicao([PERMISSAO_COMUM], [PERMISSAO_COMUM])).toEqual({ acrescimo: [], remocao: [] });
  });
});
