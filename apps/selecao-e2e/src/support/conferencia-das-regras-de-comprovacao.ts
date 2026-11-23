import { expect, type Page } from '@playwright/test';
import { REGRAS_DE_IDENTIFICACAO } from '../fixtures/documentos-de-identificacao';
import type { ExigenciasGravadas } from './api-das-exigencias-do-processo';
import {
  conferirAcessibilidade,
  conferirAxe,
  tabularAte,
} from './cenario-das-regras-de-comprovacao';

const COMBINACAO_ESPERADA = {
  forma: 'QUANTIDADE_MINIMA_DE_ITENS',
  cardinalidade: { quantidadeMinima: 1 },
  indeferimento: { consequencia: 'ELIMINA', basesLegais: [{ referencia: 'Edital nº 1/2027' }] },
};

export function recusarFormatoDaSegundaExigencia(gravadas: ExigenciasGravadas): void {
  gravadas.codigoDaRecusa = 'uniplus.selecao.formatos_permitidos.formato_invalido';
  gravadas.campoDaRecusa =
    'regrasDeComprovacao[1].documento.requisitos.formatosPermitidos[0].formato';
  gravadas.mensagemDaRecusa = 'Formato não reconhecido.';
}

export async function conferirRecusaDosFormatos(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'CIN', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  const formatos = page.getByRole('group', { name: 'Formatos aceitos' });
  await expect(formatos).toContainText('Formato não reconhecido.');
  await conferirAcessibilidade(page);
  await formatos
    .locator('label', { has: page.getByRole('checkbox', { name: 'PNG', exact: true }) })
    .click();
  await expect(formatos).not.toContainText('Formato não reconhecido.');
  await conferirAcessibilidade(page);
}

export async function gravarEConferirCombinacao(
  page: Page,
  gravadas: ExigenciasGravadas,
): Promise<void> {
  await page.getByRole('button', { name: /Gravar e avançar/ }).click();
  await expect.poll(() => gravadas.corpos.length).toBeGreaterThan(0);
  const grupo = gravadas.corpos.at(-1)?.[0];
  expect(grupo).toMatchObject(COMBINACAO_ESPERADA);
  expect(grupo?.itens).toHaveLength(3);
  expect(grupo?.itens?.map((item) => item.documento?.tipoDocumento?.id)).toEqual(
    REGRAS_DE_IDENTIFICACAO.map((regra) => regra.documento?.tipoDocumento.id),
  );
}

export async function escolherFormatos(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'RG', exact: true }).click();
  await page.getByLabel('Qualquer formato').check();
  await page.getByLabel('Somente estes formatos').check();
  await page.getByLabel('PDF', { exact: true }).check();
  await page.getByLabel('PNG', { exact: true }).check();
  await page.getByLabel('Tamanho máximo da exigência (MB), opcional').fill('5');
  await page.getByLabel('Tamanho máximo para PDF (MB), opcional').fill('5');
  await page.getByLabel('Tamanho máximo para PNG (MB), opcional').fill('5');
}

export async function gravarEConferirFormatos(
  page: Page,
  gravadas: ExigenciasGravadas,
): Promise<void> {
  await page.getByRole('button', { name: /Gravar e avançar/ }).click();
  await expect.poll(() => gravadas.corpos.length).toBeGreaterThan(0);
  expect(gravadas.corpos.at(-1)?.[0].documento?.requisitos).toMatchObject({
    formatosPermitidos: [
      { formato: 'PDF', tamanhoMaximoBytesMax: 5242880 },
      { formato: 'PNG', tamanhoMaximoBytesMax: 5242880 },
    ],
    tamanhoMaximoBytes: 5242880,
  });
}

export async function cancelarRemocao(page: Page): Promise<void> {
  const remover = page.getByRole('button', { name: 'Remover Passaporte' });
  const dialogo = page.getByRole('dialog', { name: 'Remover documento' });
  await remover.click();
  await expect(dialogo).toContainText('A combinação continuará com: RG, CIN');
  await conferirAxe(page);
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.locator('sel-grupo-de-documentos li')).toHaveCount(3);
  await conferirAcessibilidade(page);
}

export async function fecharRemocaoComEscape(page: Page): Promise<void> {
  const remover = page.getByRole('button', { name: 'Remover Passaporte' });
  const dialogo = page.getByRole('dialog', { name: 'Remover documento' });
  await remover.click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(remover).toBeFocused();
}

export async function confirmarRemocao(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Remover Passaporte' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true }).click();
  await expect(page.locator('sel-grupo-de-documentos li')).toHaveCount(2);
  await expect(page.locator('sel-grupo-de-documentos li').nth(0)).toContainText('RG');
  await expect(page.locator('sel-grupo-de-documentos li').nth(1)).toContainText('CIN');
  await expect(page.getByRole('button', { name: 'Passaporte', exact: true })).toHaveCount(0);
}

export async function marcarFormatoPeloTeclado(page: Page): Promise<void> {
  const abrir = page.getByRole('button', { name: 'RG', exact: true });
  await tabularAte(page, abrir);
  await page.keyboard.press('Enter');
  await tabularAte(page, page.getByLabel('Somente estes formatos'));
  await page.keyboard.press('Space');
  await tabularAte(page, page.getByLabel('PNG', { exact: true }));
  await page.keyboard.press('Space');
  await expect(page.getByLabel('PNG', { exact: true })).toBeChecked();
}

export async function removerPeloTeclado(page: Page): Promise<void> {
  await tabularAte(page, page.getByRole('button', { name: 'Remover RG' }));
  await page.keyboard.press('Enter');
  const confirmar = page.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true });
  await tabularAte(page, confirmar);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'RG', exact: true })).toHaveCount(0);
}
