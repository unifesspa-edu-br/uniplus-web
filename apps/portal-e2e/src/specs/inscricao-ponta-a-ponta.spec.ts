import { expect, type Locator, type Page, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';

import { keycloakLogin } from '../support/keycloak-login';

/**
 * A inscrição do candidato de ponta a ponta, contra a stack local com o processo de teste que o
 * roteiro da API publica (`scripts/roteiro-processo-teste-inscricao.sh`, que imprime o
 * `PROCESSO_ID`). O processo é novo a cada execução do roteiro, e a persona só se inscreve uma vez
 * nele: rode o roteiro antes de cada execução deste teste.
 */
const PROCESSO_ID = process.env['E2E_PROCESSO_ID'] ?? '';

/** Fernanda Drumond, persona fictícia do portal de documentação, que usa o nome social Ariel. */
const PERSONA = {
  usuario: 'fernanda.drumond',
  senha: process.env['E2E_SENHA_PERSONAS'] ?? 'Uni+Teste26',
  nome: 'Fernanda Laura Nicole Drumond',
  nomeSocial: 'Ariel Drumond',
  cpfMascarado: '***.598.363-**',
  nascimento: '1970-02-02',
  rg: '12.868.927-4',
  mae: 'Maria Marli',
  pai: 'Joaquim Eduardo Drumond',
  email: 'fernanda_laura_drumond@lhp.com.br',
  celular: '(67) 99490-8277',
  fixo: '(67) 3931-4637',
  cep: '79096730',
  numero: '743',
  uf: 'Mato Grosso do Sul',
  cidade: 'Campo Grande',
} as const;

const campo = (page: Page, rotulo: string): Locator =>
  page.getByRole('textbox', { name: new RegExp(`^${rotulo}`) });

const lista = (page: Page, rotulo: string): Locator =>
  page.getByRole('combobox', { name: new RegExp(`^${rotulo}`) });

/** O rádio tem um marcador visual sobre o input: escolhe-se pelo rótulo, como o candidato. */
async function escolher(page: Page, pergunta: string, opcao: string): Promise<void> {
  await page
    .getByRole('group', { name: new RegExp(`^${pergunta}`) })
    .getByText(opcao, { exact: true })
    .click();
}

async function irParaSecao(page: Page, secao: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Seções do formulário' })
    .getByRole('button', { name: secao })
    .click();
  await expect(
    page.getByRole('heading', { level: 3, name: new RegExp(`^${secao}`) }),
  ).toBeVisible();
}

async function municipio(page: Page, rotulo: string, nome: string): Promise<void> {
  await lista(page, rotulo).fill(nome);
  await page
    .getByRole('option', { name: new RegExp(`^${nome}`) })
    .first()
    .click();
}

async function preencherDadosDoCandidato(page: Page): Promise<void> {
  await irParaSecao(page, 'Dados do candidato');
  await campo(page, 'Nome completo').fill(PERSONA.nome);
  await escolher(page, 'Deseja usar nome social', 'Sim');
  await campo(page, 'Nome social').fill(PERSONA.nomeSocial);
  await escolher(page, 'Nacionalidade', 'Brasileiro nato');
  await expect(campo(page, 'CPF')).toHaveValue(PERSONA.cpfMascarado);
  await campo(page, 'Número do RG').fill(PERSONA.rg);
  await campo(page, 'Órgão emissor do RG').fill('SSP');
  await lista(page, 'UF de emissão do RG').selectOption({ label: PERSONA.uf });
  await campo(page, 'Data de emissão do RG').fill('1990-05-10');
  await campo(page, 'Data de nascimento').fill(PERSONA.nascimento);
  await lista(page, 'UF de nascimento').selectOption({ label: PERSONA.uf });
  await municipio(page, 'Município de nascimento', PERSONA.cidade);
  await campo(page, 'Nome da mãe').fill(PERSONA.mae);
  await campo(page, 'Nome do pai').fill(PERSONA.pai);
  await escolher(page, 'Estado civil', 'Solteiro(a)');
  await escolher(page, 'Sexo', 'Feminino');
  await escolher(page, 'Cor ou raça', 'Branca');
  await campo(page, 'E-mail').fill(PERSONA.email);
  await campo(page, 'Telefone').fill(PERSONA.celular);
  await lista(page, 'Tipo de localidade').selectOption({ label: 'Zona urbana' });

  const endereco = page.getByRole('group', { name: /^Endereço residencial/ });
  await endereco.getByRole('textbox', { name: 'CEP' }).fill(PERSONA.cep);
  await endereco.getByRole('button', { name: 'Buscar CEP' }).click();
  await expect(endereco.getByRole('textbox', { name: 'Cidade' })).toHaveValue(PERSONA.cidade);
  await endereco.getByRole('textbox', { name: /^Número/ }).fill(PERSONA.numero);
}

async function preencherRestante(page: Page): Promise<void> {
  await irParaSecao(page, 'Ensino médio');
  await escolher(page, 'Como você concluiu o ensino médio', 'Ensino médio regular');
  await lista(page, 'Onde você cursou o ensino médio').selectOption({ label: 'Escola privada' });

  await irParaSecao(page, 'Reserva de vagas');
  for (const pergunta of [
    'Você é pessoa com deficiência',
    'Deseja concorrer às vagas para pretos, pardos e indígenas',
    'Você se autodeclara indígena',
    'Você se autodeclara quilombola',
    'A renda da sua família é de até um salário mínimo por pessoa',
  ]) {
    await escolher(page, pergunta, 'Não');
  }

  await irParaSecao(page, 'Bônus regional');
  await escolher(page, 'Deseja solicitar o bônus regional', 'Não');

  await irParaSecao(page, 'Revisão e aceite');
  for (const termo of await page.getByRole('article').all()) {
    await termo.getByText('Li e aceito (obrigatório)').click();
  }
}

/** O envio pelo teclado: foco no botão e Enter, como quem não usa o mouse. */
async function enviarPeloTeclado(page: Page): Promise<void> {
  const enviar = page.getByRole('button', { name: 'Enviar inscrição' });
  await enviar.focus();
  await expect(enviar).toBeFocused();
  await page.keyboard.press('Enter');
}

async function abrirComprovanteNaLista(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Ver minhas inscrições' }).click();
  const item = page
    .getByRole('listitem')
    .filter({ hasText: PERSONA.nomeSocial })
    .or(page.getByRole('article').filter({ hasText: PERSONA.nomeSocial }));
  await expect(item.first()).toBeVisible();
  await item.first().getByRole('button', { name: 'Ver comprovante' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /comprovante/i })).toBeVisible();
}

const comprovante = (page: Page): Locator => page.getByRole('article');

test.describe('Inscrição do candidato de ponta a ponta', () => {
  test.skip(!PROCESSO_ID, 'Defina E2E_PROCESSO_ID com o processo que o roteiro da API publicou.');
  test.setTimeout(180_000);

  test('entra, se inscreve, corrige e confere os comprovantes e as inscrições', async ({
    page,
  }) => {
    await test.step('entra pela vitrine e volta à inscrição escolhida', async () => {
      await page.goto('/processos');
      await page.locator(`a[href="/inscricao/${PROCESSO_ID}"]`).first().click();
      await keycloakLogin(page, PERSONA.usuario, PERSONA.senha, {
        expectRedirectTo: new RegExp(`/inscricao/${PROCESSO_ID}`),
      });
      await expect(page.getByRole('heading', { level: 1, name: 'Inscrição' })).toBeVisible();
    });

    await test.step('o campo obrigatório recusado é anunciado e ligado à mensagem', async () => {
      await enviarPeloTeclado(page);
      await expect(page.locator('[aria-live="polite"]').first()).toContainText(/recusad/);
      await irParaSecao(page, 'Dados do candidato');
      const nome = campo(page, 'Nome completo');
      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(nome).toHaveAccessibleDescription(/Responda este campo\./);
    });

    await test.step('o formulário não tem violação de WCAG 2.1 AA', async () => {
      const resultado = await runAxeWcagAA(page, { exclude: ['vlibras-widget, [vw]'] });
      expect(resultado.violations).toEqual([]);
    });

    await test.step('preenche e envia', async () => {
      await preencherDadosDoCandidato(page);
      await preencherRestante(page);
      await enviarPeloTeclado(page);
      await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
    });

    await test.step('o comprovante mostra o nome social e só o CPF mascarado', async () => {
      await abrirComprovanteNaLista(page);
      await expect(comprovante(page)).toContainText(PERSONA.nomeSocial);
      await expect(comprovante(page)).toContainText(PERSONA.cpfMascarado);
      await expect(comprovante(page)).toContainText(PERSONA.celular);
      await expect(comprovante(page)).not.toContainText(PERSONA.rg);
    });

    await test.step('corrige o telefone e envia de novo', async () => {
      await page.goto(`/inscricao/${PROCESSO_ID}`);
      await irParaSecao(page, 'Dados do candidato');
      await expect(campo(page, 'Telefone')).toHaveValue(PERSONA.celular);
      await campo(page, 'Telefone').fill(PERSONA.fixo);
      await enviarPeloTeclado(page);
      await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
    });

    await test.step('o comprovante novo traz a correção e o anterior continua igual', async () => {
      await abrirComprovanteNaLista(page);
      await expect(comprovante(page)).toContainText(PERSONA.fixo);
      await page.getByRole('link', { name: 'Comprovante anterior' }).click();
      await expect(page).toHaveURL(new RegExp(`/inscricao/${PROCESSO_ID}/comprovantes/1$`));
      await expect(comprovante(page)).toContainText(PERSONA.celular);
      await expect(comprovante(page)).not.toContainText(PERSONA.fixo);
    });

    await test.step('minhas inscrições mostra a inscrição com o nome social', async () => {
      await page.getByRole('link', { name: 'Voltar às minhas inscrições' }).first().click();
      await expect(page.getByText(PERSONA.nomeSocial).first()).toBeVisible();
      await expect(page.getByText(PERSONA.nome)).toHaveCount(0);
    });
  });
});
