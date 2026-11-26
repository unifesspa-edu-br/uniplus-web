import { type Page } from '@playwright/test';
import { PDF_MINIMO } from '@uniplus/shared-e2e';
import { expect } from '../fixtures/auth.fixture';

export async function escolherTipoDoProcesso(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: /Tipo do processo/i })).toBeVisible();

  // Passo 1 — o tipo vem do catálogo de Configuração; o rascunho guarda o UUID.
  const primeiroTipo = page.locator('.type-card').first();
  await expect(primeiroTipo).toBeVisible({ timeout: 15_000 });
  await primeiroTipo.click();
  await expect(primeiroTipo).toHaveClass(/is-selected/);
  await page.getByRole('button', { name: 'Próximo' }).click();
}

export async function preencherIdentificacaoDoProcesso(
  page: Page,
  sufixo: string,
  unidadeId: string,
): Promise<void> {
  // Mesmo conteúdo do certame de Medicina cadastrado pela coleção Newman.
  await expect(page.getByRole('heading', { level: 1, name: /Identificação/i })).toBeVisible();
  await page.locator('#f-nome').fill(`Medicina 2027 — CEPS — E2E ${sufixo}`);
  // O identificador legível é único entre processos: o sufixo da execução evita colidir com o
  // de uma rodada anterior contra o mesmo banco.
  await page.locator('#f-identificador').fill(`medicina-2027-e2e-${sufixo}`);
  await escolherUnidade(page, unidadeId);
  await escolherMunicipioDosPrazos(page);
}

async function escolherUnidade(page: Page, unidadeId: string): Promise<void> {
  // O CEPS administra o certame e tem cidade cadastrada pelo roteiro da stack: a API recusa a
  // criação sem ela (`ProcessoSeletivo.UnidadeAdministradoraSemCidade`). A opção é escolhida pelo
  // id resolvido na API, não pelo texto.
  const unidade = page.locator('#f-unidade');
  await expect(unidade.locator(`option[value="${unidadeId}"]`)).toHaveCount(1, {
    timeout: 15_000,
  });
  await unidade.selectOption(unidadeId);
  await page.locator('#f-origem').selectOption('INSCRICAO_PROPRIA');
}

async function escolherMunicipioDosPrazos(page: Page): Promise<void> {
  // O município que rege os prazos é declarado, não deduzido da unidade: o
  // servidor recusa a criação sem ele. A busca da Geo casa por trecho do
  // nome, não por prefixo — com "Mar" viriam vinte "…do Maranhão" antes de
  // Marabá aparecer, e a janela de resultados cortaria fora.
  await page.getByRole('combobox', { name: 'Município que rege os prazos' }).fill('Marabá');
  const opcaoMaraba = page.getByRole('option', { name: /^Marabá \(PA\)$/ }).first();
  await expect(opcaoMaraba).toBeVisible({ timeout: 15_000 });
  await opcaoMaraba.click();
}

export async function gravarProcesso(page: Page): Promise<void> {
  // O avanço só se chama "Próximo" depois que o processo é gravado.
  await page.getByRole('button', { name: 'Gravar e avançar' }).click();

  // Nenhum destes campos é alterável depois de gravado — o contrato não expõe atualização
  // deles —, e por isso o passo confirma antes de enviar.
  await expect(page.getByRole('heading', { name: /Confirmar o cadastro/i })).toBeVisible();
  await page.getByRole('button', { name: 'Gravar processo' }).click();

  await expect(page.getByRole('heading', { level: 1, name: /Taxa de inscrição/i })).toBeVisible({
    timeout: 15_000,
  });
}

export async function verificarCamposAposGravacao(page: Page): Promise<void> {
  // Criado o processo, os campos do comando não aceitam mais alteração.
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page.locator('#f-nome')).toBeDisabled();
  await expect(page.locator('#f-unidade')).toBeDisabled();
  await expect(page.locator('#f-origem')).toBeDisabled();
  // O identificador, ao contrário, continua editável enquanto o processo for rascunho.
  await expect(page.locator('#f-identificador')).toBeEnabled();
}

export async function anexarEdital(page: Page, sufixo: string): Promise<void> {
  // O edital é anexado na revisão e publicação, com o processo já existente.
  await page.getByRole('button', { name: /Revisão e publicação/i }).click();
  await page.locator('#f-file').setInputFiles({
    name: `edital-${sufixo}.pdf`,
    mimeType: 'application/pdf',
    buffer: PDF_MINIMO,
  });
  await verificarEnvioDoEdital(page);
}

async function verificarEnvioDoEdital(page: Page): Promise<void> {
  await expect(page.locator('.uni-uploader__item.is-success')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.uni-uploader__item .uni-uploader__item-meta')).toHaveText(
    'Envio concluído',
  );
  await expect(page.locator('.uni-uploader [role="progressbar"]')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
}

export async function verificarRecusaDeArquivoInvalido(page: Page): Promise<void> {
  const requisicoesDeDocumento: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/documentos-a-publicar')) {
      requisicoesDeDocumento.push(req.url());
    }
  });
  await avancarParaIdentificacao(page);
  await enviarArquivoInvalido(page);
  expect(requisicoesDeDocumento).toEqual([]);
}

async function avancarParaIdentificacao(page: Page): Promise<void> {
  const primeiroTipo = page.locator('.type-card').first();
  await expect(primeiroTipo).toBeVisible({ timeout: 15_000 });
  await primeiroTipo.click();
  await page.getByRole('button', { name: 'Próximo' }).click();

  // Todos os passos ficam montados no DOM, então sem esta âncora o teste
  // passaria mesmo que o avanço tivesse falhado.
  await expect(page.getByRole('heading', { level: 1, name: /Identificação/i })).toBeVisible();
}

async function enviarArquivoInvalido(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Revisão e publicação/i }).click();
  await page.locator('#f-file').setInputFiles({
    name: 'edital.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('conteudo qualquer', 'utf-8'),
  });

  await expect(page.getByRole('alert')).toContainText('Tipo de arquivo não permitido');
}
