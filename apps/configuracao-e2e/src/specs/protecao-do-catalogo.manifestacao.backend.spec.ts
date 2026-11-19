import { expect, test, type Page } from '@playwright/test';
import {
  REPRESENTANTE_DO_CONTROLADOR,
  aprovarCatalogoInicial,
  chamarApi,
  entrarComoPersona,
  garantirConcessao,
  prepararAcessosDaSimulacao,
} from '@uniplus/shared-e2e';

/**
 * A manifestação técnica contra a API real, com os perfis de sistema 2 e 3: o Encarregado de dados
 * se manifesta de forma desfavorável, o Representante do controlador só aprova com justificativa
 * diante dela, e quem administra os tipos de documento lê o histórico sem nenhuma ação. Cada
 * execução cria um tipo de documento novo.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const ENCARREGADO_DE_DADOS = 'isabella.figueiredo';
const PERFIL_DO_REPRESENTANTE = '019a0000-0000-7000-8000-000000000002';
const PERFIL_DO_ENCARREGADO = '019a0000-0000-7000-8000-000000000003';
const TEXTO = 'O laudo revela condição de saúde: a classificação deve ser sensível.';
const ADMIN = '/api/configuracao/admin';

interface Categoria {
  readonly codigo: string;
}

interface Ato {
  readonly ato: string;
  readonly dianteDeManifestacaoDesfavoravel: boolean;
  readonly justificativa: string | null;
}

/** Cria o tipo de documento e o envia à proteção de dados; devolve o id. */
async function tipoSolicitado(nome: string, codigo: string): Promise<string> {
  const categorias = await chamarApi<Categoria[]>(
    ENCARREGADO_DE_DADOS,
    'GET',
    '/api/configuracao/categorias-documento',
  );
  const criado = await chamarApi<string>(ENCARREGADO_DE_DADOS, 'POST', `${ADMIN}/tipos-documento`, {
    corpo: {
      codigo,
      nome,
      categoria: categorias.corpo[0]?.codigo,
      classificacaoProtecao: 'INTERNO',
      hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
      finalidadeTratamento: 'Conferência de documento complementar do atendimento especializado.',
    },
  });
  expect(criado.status, JSON.stringify(criado.corpo)).toBe(201);
  const id = String(criado.corpo).replace(/"/g, '');
  const pedido = await chamarApi(
    ENCARREGADO_DE_DADOS,
    'POST',
    `${ADMIN}/protecao-do-catalogo/solicitacoes`,
    {
      corpo: { itens: [{ cadastro: 'TIPO_DOCUMENTO', id }] },
    },
  );
  expect(pedido.status, JSON.stringify(pedido.corpo)).toBeLessThan(300);
  return id;
}

async function atosDo(id: string): Promise<Ato[]> {
  const atos = await chamarApi<Ato[]>(
    ENCARREGADO_DE_DADOS,
    'GET',
    `${ADMIN}/tipos-documento/${id}/protecao/atos`,
  );
  return atos.corpo;
}

async function abrirNaFila(pagina: Page, nome: string) {
  await pagina.getByRole('button', { name: `Ver o detalhe de ${nome}` }).click();
  return pagina.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
}

test.describe('Manifestação técnica na proteção de dados dos tipos de documento', () => {
  test.describe.configure({ mode: 'serial' });

  const sufixo = Date.now();
  const nome = `Laudo com manifestação ${sufixo}`;
  let id: string;

  test.beforeAll(async () => {
    test.setTimeout(600_000);
    await prepararAcessosDaSimulacao();
    await aprovarCatalogoInicial();
    await garantirConcessao(ENCARREGADO_DE_DADOS, PERFIL_DO_ENCARREGADO, '');
    await garantirConcessao(REPRESENTANTE_DO_CONTROLADOR, PERFIL_DO_REPRESENTANTE, '');
    id = await tipoSolicitado(nome, `LAUDO_MANIFESTACAO_${sufixo}`);
  });

  test('o Encarregado de dados registra o parecer desfavorável e não vê as ações de decidir', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      ENCARREGADO_DE_DADOS,
      '/protecao-do-catalogo',
    );
    const drawer = await abrirNaFila(pagina, nome);
    await expect(drawer.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);

    await drawer
      .locator('label.radio')
      .filter({ has: pagina.getByRole('radio', { name: 'Inadequada', exact: true }) })
      .click();
    await drawer.getByRole('textbox', { name: 'Texto' }).fill(TEXTO);
    await drawer.getByRole('button', { name: 'Registrar manifestação' }).click();

    await expect(drawer.getByRole('region', { name: 'Histórico das manifestações' })).toContainText(
      TEXTO,
    );
  });

  test('o Representante do controlador só aprova diante da manifestação com justificativa', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      REPRESENTANTE_DO_CONTROLADOR,
      '/protecao-do-catalogo',
    );
    const drawer = await abrirNaFila(pagina, nome);
    await expect(drawer.getByRole('region', { name: 'Manifestações vigentes' })).toContainText(
      'Inadequada',
    );
    await drawer.getByRole('button', { name: 'Aprovar' }).click();
    const dialogo = pagina.getByRole('dialog', { name: 'Aprovar a proteção de dados do item' });

    await dialogo.getByRole('button', { name: 'Aprovar item' }).click();
    await expect(
      dialogo.getByText(
        'Há manifestação desfavorável vigente: informe a justificativa da decisão.',
      ),
    ).toBeVisible();

    await dialogo
      .getByRole('textbox', { name: /Justificativa/ })
      .fill('A classificação interna basta para o uso previsto.');
    await dialogo.getByRole('button', { name: 'Aprovar item' }).click();

    await expect
      .poll(
        async () =>
          (await atosDo(id)).find((ato) => ato.ato === 'APROVACAO')
            ?.dianteDeManifestacaoDesfavoravel,
      )
      .toBe(true);
  });

  test('quem administra os tipos de documento lê o histórico das manifestações, sem nenhuma ação', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(browser, APP, ENCARREGADO_DE_DADOS, '/tipos-documento');
    await pagina.getByRole('searchbox', { name: 'Buscar tipo de documento' }).fill(nome);
    await pagina.getByRole('button', { name: `Ver o detalhe de ${nome}` }).click();
    const historico = pagina
      .getByRole('dialog', { name: 'Detalhe do tipo de documento' })
      .getByRole('region', { name: 'Histórico das manifestações' });

    await expect(historico).toContainText('Inadequada');
    await expect(historico).toContainText(TEXTO);
    await expect(historico.getByRole('button')).toHaveCount(0);
  });
});
