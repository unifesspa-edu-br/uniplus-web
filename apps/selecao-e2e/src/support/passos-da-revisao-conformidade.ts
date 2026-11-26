import { expect, type Page } from '@playwright/test';
import { FASE_DE_COLETA } from '../fixtures/processo-da-revisao';
import { mockarProcesso } from './api-da-revisao';

const PENDENCIAS = {
  cronogramaFases: [FASE_DE_COLETA],
  conformidadeItens: [
    {
      codigo: 'taxa_inscricao_nao_declarada',
      dimensao: 'taxa_inscricao',
      mensagem: 'Declare se o processo cobra taxa de inscrição.',
      ok: false,
    },
    {
      codigo: 'classificacao_ausente',
      dimensao: 'classificacao',
      mensagem: 'Declare a classificação do processo.',
      ok: false,
    },
  ],
  conformidadeLegalRegras: [
    {
      regraId: '01960000-0000-7000-0000-000000000907',
      regraCodigo: 'OBRIG-COTAS-LEI-12711',
      categoria: 'OBRIGATORIA',
      tipoProcessoCodigoAvaliado: 'REGULAR_UNIFICADO',
      predicado: 'SEMPRE',
      aprovada: false,
      motivo: 'O processo não declarou distribuição de vagas por cotas.',
      baseLegal: 'Lei 12.711/2012',
      atoNormativoUrl: null,
      portariaInterna: null,
      descricaoHumana: 'Reserva de vagas da Lei de Cotas',
      vigenciaInicio: '2012-08-30',
      vigenciaFim: null,
    },
  ],
};

const AVISO = {
  cronogramaFases: [FASE_DE_COLETA],
  conformidadeAvisos: [
    {
      codigo: 'cronograma_tipo_definitivo_em_mais_de_um_lugar',
      dimensao: 'cronograma',
      mensagem:
        'O mesmo tipo de ato definitivo foi declarado em mais de uma fase. Confirme que o edital quer isso.',
    },
  ],
};

export async function mockarPendencias(page: Page): Promise<void> {
  await mockarProcesso(page, PENDENCIAS);
}

export async function mockarAviso(page: Page): Promise<void> {
  await mockarProcesso(page, AVISO);
}

export async function conferirChecklistConforme(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Checklist estrutural' })).toBeVisible();
  await expect(page.getByText('Nenhuma pendência estrutural.')).toBeVisible();
  await expect(page.getByText('Nenhuma obrigatoriedade legal reprovada.')).toBeVisible();
  // Com fase de coleta, o período não é pedido nesta tela.
  await expect(page.getByLabel('Início do período de inscrição', { exact: true })).toBeHidden();
}

async function preencherPeriodo(page: Page): Promise<void> {
  await expect(page.getByLabel('Início do período de inscrição', { exact: true })).toBeVisible();
  await page.getByLabel('Início do período de inscrição', { exact: true }).fill('2027-05-01T08:00');
  await page.getByLabel('Fim do período de inscrição', { exact: true }).fill('2027-05-10T18:00');
  await page.getByLabel('Número do ato (opcional)', { exact: true }).fill('001/2027');
}

export async function preencherAtoEPeriodo(page: Page): Promise<void> {
  await preencherPeriodo(page);
  await page.getByLabel('Tipo de ato', { exact: true }).selectOption('PORTARIA');
  await page.getByLabel('Órgão', { exact: true }).fill('Reitoria');
  await page.getByLabel('Série', { exact: true }).fill('1');
  await page.getByLabel('Ano', { exact: true }).fill('2027');
  await page.getByLabel('Data do ato', { exact: true }).fill('2027-01-15');
  await page.getByLabel('Assinante', { exact: true }).fill('Reitor');
}

export async function conferirPendencias(page: Page): Promise<void> {
  await expect(
    page.locator('.revisao-list').getByText('Declare se o processo cobra taxa de inscrição.'),
  ).toBeVisible();
  await expect(page.getByText('Reserva de vagas da Lei de Cotas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Ir para Taxa de inscrição/ })).toBeVisible();
}
