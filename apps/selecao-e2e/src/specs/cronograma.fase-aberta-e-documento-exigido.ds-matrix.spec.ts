import { expect, test, type Page } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { NOME_DOCUMENTO } from '../fixtures/catalogos-do-cronograma';
import { conferirAlinhamentoDaObservacao } from '../support/alinhamento-da-observacao';
import { elementosForaDoCartao } from '../support/limites-do-cartao';
import { identificadoresDe } from '../support/medicoes-do-passo';
import {
  abrirCronogramaEmRascunho,
  acrescentarFase,
  exigirDocumento,
  problemasDeIds,
} from '../support/passos-do-cronograma';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/**
 * Matriz do Uni+ DS para a fase aberta do Cronograma: a ação de acrescentar fase, o trecho das
 * etapas e o card do documento exigido, onde a tela estreita espremia o nome ao lado da ação.
 */
test.describe('Cronograma — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirCronogramaEmRascunho(page, testInfo);
  });

  /**
   * O rótulo da ação é longo para a tela estreita: ele quebra em vez de passar da borda do
   * cartão, que o `.page` corta sem rolagem. Lado a lado com o campo, os dois têm a mesma
   * altura e a mesma base.
   */
  test('mantém a ação de acrescentar fase dentro do cartão, na base do campo', async ({ page }) => {
    const medida = await medirAcaoDeAcrescentarFase(page);

    expect(medida.direitaDaAcao).toBeLessThanOrEqual(medida.direitaDoCartao + 1);
    expect(Math.abs(medida.alturaDaAcao - medida.alturaDoCampo)).toBeLessThanOrEqual(1);
    expect(
      !medida.ladoALado || medida.desalinhamentoDaBase <= 1,
      `base da ação e do campo (${medida.desalinhamentoDaBase} px)`,
    ).toBe(true);
  });

  /** A fase aberta é o trecho com mais ações, e as de rótulo longo passavam da borda. */
  test('mantém as ações da fase aberta dentro do cartão', async ({ page }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await expect(page.getByRole('heading', { name: 'Etapas desta fase' })).toBeVisible();

    expect(await elementosForaDoCartao(page)).toEqual([]);
  });

  /**
   * Título de seção, alerta e dica têm margem do ritmo vertical do passo: nenhum encosta
   * no bloco vizinho. A fase aberta é o trecho que mais empilha esses três.
   */
  test('separa título, alerta e dica do bloco vizinho', async ({ page }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await expect(page.getByRole('heading', { name: 'Etapas desta fase' })).toBeVisible();

    expect(await blocosColados(page)).toEqual([]);
  });

  /**
   * O card do documento exigido numa tela estreita: o nome não pode ficar embaixo da ação
   * de remover, nada passa da borda do card, e o aviso de norma ausente só aparece sem norma.
   */
  test('mostra o documento exigido inteiro no card', async ({ page }, testInfo) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);

    const card = page.locator('.doc-item--exigido').first();
    await expect(card.getByText(NOME_DOCUMENTO)).toBeVisible();

    const medida = await card.evaluate((elemento) => {
      const caixa = (seletor: string) => elemento.querySelector(seletor)?.getBoundingClientRect();
      const nome = caixa('.doc-item__name');
      const linha = caixa('.doc-item__row');
      const remover = caixa('.doc-item__row > .btn');
      const limite = elemento.getBoundingClientRect().right;
      const transbordam = Array.from(elemento.querySelectorAll<HTMLElement>('*'))
        .filter((filho) => filho.offsetParent !== null)
        .filter((filho) => filho.getBoundingClientRect().right > limite + 1)
        .map((filho) => filho.className || filho.tagName);
      const sobrepoe =
        nome !== undefined &&
        remover !== undefined &&
        nome.left < remover.right &&
        remover.left < nome.right &&
        nome.top < remover.bottom &&
        remover.top < nome.bottom;
      return {
        sobrepoe,
        transbordam,
        larguraDoNome: nome?.width ?? 0,
        larguraDaLinha: linha?.width ?? 0,
      };
    });

    expect(medida.sobrepoe, 'o nome não fica sob a ação de remover').toBe(false);
    expect(medida.transbordam, 'nada passa da borda do card').toEqual([]);
    expect(medida.larguraDoNome, 'o nome não é espremido ao lado da ação').toBeGreaterThanOrEqual(
      medida.larguraDaLinha / 2,
    );

    const acrescentar = await page
      .getByRole('button', { name: 'Acrescentar documento' })
      .evaluate((botao) => {
        const secao = botao.closest('.escolher-e-acrescentar') as HTMLElement;
        return botao.getBoundingClientRect().right - secao.getBoundingClientRect().right;
      });
    expect(acrescentar, '"Acrescentar documento" não passa da borda').toBeLessThanOrEqual(1);
    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);

    const tamanhos = await card.evaluate((elemento) => {
      const tamanho = (seletor: string) =>
        parseFloat(getComputedStyle(elemento.querySelector(seletor) as Element).fontSize);
      return { nome: tamanho('.doc-item__name'), rotulo: tamanho('.label') };
    });
    expect(tamanhos.nome, 'o nome do documento encabeça os rótulos dos campos').toBeGreaterThan(
      tamanhos.rotulo,
    );

    /*
     * Na grade dos eixos, a observação divide a linha com a norma, o alcance e a identificação
     * quando há colunas para os quatro: um rótulo que quebra em duas linhas desce o input em
     * relação aos vizinhos. Em 1440 px são três colunas estreitas e a observação fica sozinha na
     * linha de baixo, então o alinhamento só se verifica numa largura em que ela tenha vizinhos.
     * O viewport desktop da matriz (1366 px) tem menos colunas ainda, onde o rótulo cabe em
     * qualquer caso.
     */
    await conferirAlinhamentoDaObservacao(page, card, testInfo);

    // O aviso segue a regra da publicação: alguma norma declarada E resolvida.
    const aviso = card.getByText('Sem uma norma declarada e identificada como "Resolvida"');
    const normas = card.getByLabel('Norma que exige o documento');
    const identificacoes = card.getByLabel('Identificação da norma');
    await expect(aviso).toBeVisible();
    await normas.first().fill('Lei 12.711/2012, art. 3º');
    await expect(aviso).toHaveCount(0);

    await identificacoes.first().selectOption({ label: 'Pendente' });
    await expect(aviso, 'a norma pendente não sustenta a exigência').toBeVisible();
    expect(await blocosColados(page)).toEqual([]);

    await card.getByRole('button', { name: 'Acrescentar outra norma' }).click();
    await identificacoes.first().selectOption({ label: 'Resolvida' });
    await expect(normas).toHaveCount(2);
    await expect(aviso, 'a outra norma, resolvida, já sustenta a exigência').toHaveCount(0);

    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * Os campos do documento abrem e recolhem pelo nome dele, que diz o estado; recolhidos, o
   * resumo continua dizendo o que decide a exigência.
   */
  test('abre e recolhe os campos do documento pelo nome', async ({ page }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);

    const alternar = page.getByRole('button', { name: NOME_DOCUMENTO, exact: true });
    await expect(alternar).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Entrega')).toBeVisible();

    await alternar.click();
    await expect(alternar).toHaveAttribute('aria-expanded', 'false');
    await expect(alternar).toBeFocused();
    await expect(page.getByLabel('Entrega')).toHaveCount(0);
    await expect(
      page.getByRole('row', { name: new RegExp(NOME_DOCUMENTO) }).getByText('Obrigatória'),
    ).toBeVisible();

    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * Com o filtro "todo candidato" ativo, passar o documento aberto para "de quem satisfaz" o
   * tira do público filtrado; ele continua na tela, com o campo em foco.
   */
  test('mantém o documento em edição e o foco quando ele sai do público filtrado', async ({
    page,
  }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);
    await page.getByLabel('Conferir os documentos de').selectOption({
      label: 'Exigidos de todo candidato',
    });

    const exigidoDe = page.getByLabel('Exigido de', { exact: true });
    await exigidoDe.focus();
    await exigidoDe.selectOption({ label: 'Só de quem satisfaz as condições declaradas' });

    await expect(exigidoDe).toBeFocused();
    await expect(page.getByRole('button', { name: NOME_DOCUMENTO, exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    // Recolhido, o documento sai da lista: o foco vai ao seletor do público, visível, e a
    // contagem ligada a ele diz o que saiu.
    await page.getByRole('button', { name: NOME_DOCUMENTO, exact: true }).click();
    const filtro = page.getByLabel('Conferir os documentos de');
    await expect(filtro).toBeFocused();
    await expect(filtro).toBeInViewport();
    const aviso = `${NOME_DOCUMENTO} saiu da lista, porque não é mais do público filtrado.`;
    await expect(filtro).toHaveAccessibleDescription(new RegExp(aviso));
    await expect(page.locator('.doc-conferencia__filtro [role="status"]')).toContainText(aviso);
    await expect(page.locator('.doc-conferencia__linha')).toHaveCount(0);
  });

  /**
   * Cada fase aberta embute um passo da fase (web#923): com duas abertas, nenhum id se repete e
   * todo `for`, `aria-describedby` e `aria-controls` aponta para um elemento da própria fase.
   */
  test('não repete id nem aponta para a fase vizinha com duas fases abertas', async ({ page }) => {
    await acrescentarFase(page, 'Inscrição');
    await acrescentarFase(page, 'Avaliação');
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);
    await page.getByRole('button', { name: '2. Avaliação' }).click();
    const fases = page.locator('sel-step-fase');
    await expect(fases).toHaveCount(2);
    await exigirDocumento(page, fases.nth(1));

    const problemas = await problemasDeIds(page);

    expect(problemas.repetidos, 'ids duplicados na página').toEqual([]);
    expect(problemas.orfas, 'referências que saem da própria fase').toEqual([]);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  /**
   * O botão "Remover" sai junto com a linha do documento: o foco não pode cair no corpo da
   * página (WCAG 2.4.3), e a remoção é anunciada.
   */
  test('leva o foco a um ponto estável ao remover o documento exigido', async ({ page }) => {
    await acrescentarFase(page);
    await page.getByRole('button', { name: '1. Inscrição' }).click();
    await exigirDocumento(page);

    await page.getByRole('button', { name: `Remover ${NOME_DOCUMENTO}` }).click();

    await expect(page.locator('.doc-item--exigido')).toHaveCount(0);
    const seletor = page.getByLabel('Documento a exigir');
    await expect(seletor).toBeFocused();
    await expect(seletor).toBeInViewport();
    await expect(
      page.locator('[role="status"]', { hasText: 'removido dos documentos' }),
    ).toHaveText(`${NOME_DOCUMENTO} removido dos documentos exigidos nesta fase.`);
  });
});

/** Ação de acrescentar fase, o campo ao lado dela e a borda do conteúdo do cartão. */
async function medirAcaoDeAcrescentarFase(page: Page): Promise<{
  direitaDaAcao: number;
  direitaDoCartao: number;
  alturaDaAcao: number;
  alturaDoCampo: number;
  ladoALado: boolean;
  desalinhamentoDaBase: number;
}> {
  return page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).evaluate((acao) => {
    const cartao = acao.closest('.step-card');
    const campo = document.getElementById('cr-nova-fase');
    if (!cartao || !campo) {
      throw new Error('Cartão ou campo de acrescentar fase ausente.');
    }
    const caixaDaAcao = acao.getBoundingClientRect();
    const caixaDoCampo = campo.getBoundingClientRect();
    return {
      direitaDaAcao: caixaDaAcao.right,
      direitaDoCartao:
        cartao.getBoundingClientRect().right - parseFloat(getComputedStyle(cartao).paddingRight),
      alturaDaAcao: caixaDaAcao.height,
      alturaDoCampo: caixaDoCampo.height,
      ladoALado: caixaDaAcao.top < caixaDoCampo.bottom,
      desalinhamentoDaBase: Math.abs(caixaDaAcao.bottom - caixaDoCampo.bottom),
    };
  });
}
