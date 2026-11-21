import { afterEach, describe, expect, it } from 'vitest';
import { ID_AVALIACAO, ID_INSCRICAO, ID_RESULTADO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('Cronograma: foco ao mover fase', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
    document.body.appendChild(tela.nativo);
  });
  afterEach(() => tela.nativo.remove());

  async function mover(acao: 'subir' | 'descer', indice: number): Promise<void> {
    const botao = tela.nativo.querySelector<HTMLButtonElement>(`#cr-fase-${acao}-${indice}`);
    expect(botao).not.toBeNull();
    botao?.focus();
    botao?.click();
    tela.detectar();
    await tela.proximoPasso();
    tela.detectar();
  }

  it('ao subir a segunda fase, foca Descer da mesma fase', async () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO, ID_RESULTADO);
    await mover('subir', 1);
    expect(tela.cronograma.fases.at(0).controls.codigo.value).toBe('AVALIACAO');
    expect(document.activeElement?.id).toBe('cr-fase-descer-0');
  });

  it('ao descer a penúltima fase, foca Subir da mesma fase', async () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO, ID_RESULTADO);
    await mover('descer', 1);
    expect(tela.cronograma.fases.at(2).controls.codigo.value).toBe('AVALIACAO');
    expect(document.activeElement?.id).toBe('cr-fase-subir-2');
  });

  it('mantém o foco no botão acionado ao mover para uma posição intermediária', async () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO, ID_RESULTADO);
    const botao = tela.nativo.querySelector<HTMLButtonElement>('#cr-fase-descer-0');
    await mover('descer', 0);
    expect(document.activeElement).toBe(botao);
    expect(document.activeElement?.id).toBe('cr-fase-descer-1');
  });

  it('com duas fases, subir a segunda foca o botão Descer dela na primeira posição', async () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO);
    await mover('subir', 1);
    expect(tela.cronograma.fases.at(0).controls.codigo.value).toBe('AVALIACAO');
    expect(document.activeElement?.id).toBe('cr-fase-descer-0');
  });
});
