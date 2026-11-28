import type { Page } from '@playwright/test';

import {
  coletarNosComEstilo,
  coletarNosComTexto,
  montarArvore,
  type Retangulo,
} from './coleta-da-pagina';
import {
  descreverBlocosColados,
  espacosDosBlocosDoPasso,
  espacosEntre,
  type EspacoEntreBlocos,
} from './regras-do-ritmo-vertical';

export type { EspacoEntreBlocos };

const PASSO_ABERTO = '.step-pane:not([hidden]) > *';

/**
 * Pares de blocos visíveis do passo mais próximos que o ritmo vertical pede:
 * - título de seção a menos de 20 px do bloco anterior;
 * - alerta ou dica a menos de 16 px do bloco seguinte.
 *
 * Quando a dica encerra o contêiner (campo, cabeçalho, linha de ações), a medida vai do
 * contêiner até o irmão dele, desde que esse irmão seja um bloco de largura inteira: um
 * item de grade ao lado fica na mesma linha e não tem distância vertical a conferir.
 *
 * A dica que antecede o próprio controle, outra dica ou a base legal da regra escolhida
 * no campo (`.regra-explicada`, que detalha o campo de cima) fica de fora: ali a
 * proximidade é intencional.
 */
export async function blocosColados(page: Page): Promise<string[]> {
  const nos = await coletarNosComTexto(page, '.wiz-content');
  return nos.length === 0 ? ['.wiz-content ausente'] : descreverBlocosColados(montarArvore(nos));
}

// Roda dentro da página: usa só o DOM e o que recebe como argumento.
function medirComBlocosNovos(seletor: string): Retangulo[] {
  const subtitulo = document.querySelector(seletor)?.firstElementChild;
  if (!subtitulo) return [];
  const bloco = document.createElement('div');
  bloco.textContent = 'Bloco novo';
  const componente = document.createElement('sel-bloco-novo');
  componente.innerHTML = '<p>Componente novo</p>';
  subtitulo.after(bloco, componente);
  const medidas = [subtitulo, bloco, componente].map((e) => e.getBoundingClientRect().toJSON());
  bloco.remove();
  componente.remove();
  return medidas;
}

/**
 * Espaços, em px, em volta de dois blocos novos acrescentados logo depois do subtítulo do passo
 * aberto, sem classe nem margem própria: um `div` e um elemento customizado, que é inline por
 * padrão como o host de um componente. O ritmo do passo é que tem de espaçá-los.
 */
export async function espacosDeBlocosNovos(page: Page): Promise<number[]> {
  return espacosEntre(await page.evaluate(medirComBlocosNovos, PASSO_ABERTO));
}

/** O valor de `--space-5` em px, o ritmo entre os blocos do corpo de um passo. */
export async function ritmoDoPasso(page: Page): Promise<number> {
  return page.evaluate(() => {
    const sonda = document.createElement('div');
    sonda.style.height = 'var(--space-5)';
    document.body.append(sonda);
    const altura = Math.round(sonda.getBoundingClientRect().height);
    sonda.remove();
    return altura;
  });
}

/**
 * Espaços, em px, entre os blocos visíveis do corpo do passo aberto, na ordem do documento.
 *
 * A medida vai da borda visual de um bloco à do seguinte, e não da caixa: um bloco sem borda,
 * padding nem fundo naquele lado não desenha nada ali, e a margem de um filho que ficou presa
 * dentro dele (numa lista flex, por exemplo) é espaço que o usuário vê. Nesse caso a medida
 * desce até o filho em fluxo mais próximo da borda.
 */
export async function espacosEntreBlocos(page: Page): Promise<EspacoEntreBlocos[]> {
  const nos = await coletarNosComEstilo(page, PASSO_ABERTO);
  return espacosDosBlocosDoPasso(montarArvore(nos));
}
