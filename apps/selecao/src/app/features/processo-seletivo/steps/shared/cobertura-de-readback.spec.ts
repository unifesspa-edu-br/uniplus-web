import { describe, expect, it } from 'vitest';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { SECOES_DO_RASCUNHO, WizardDraft } from '../processo-seletivo.models';
import { hidratarDraft } from './hidratacao';

/**
 * O inventário que fecha o diagnóstico do bloco do ato que se perdia.
 *
 * O defeito não foi uma linha errada: foi uma seção do rascunho que ninguém relia do servidor,
 * num wizard onde todas as outras reliam. Passou despercebida porque não havia onde comparar o
 * que o wizard grava com o que ele recupera — e um passo novo sem readback passaria exatamente
 * igual.
 *
 * A prova é por identidade de referência: `hidratarDraft` espalha o rascunho e substitui as
 * seções que projeta, então a seção que sai com a MESMA referência que entrou é a que ele não
 * tocou. Nada aqui depende de o DTO estar completo — as seções não projetadas seriam intocadas
 * de qualquer jeito.
 */
describe('cobertura de readback do rascunho', () => {
  /**
   * A única seção sem readback pelo detalhe, e por uma razão de domínio: publicar não é uma
   * dimensão que o processo devolva editável. Ela sobrevive a um recarregamento por outra via —
   * a rota própria de rascunho da publicação —, não por `hidratarDraft`.
   */
  const SEM_READBACK_PELO_DETALHE = ['publicacao'] as const;

  const marcador = (): WizardDraft =>
    Object.fromEntries(
      SECOES_DO_RASCUNHO.map((secao) => [secao, { marcador: secao }]),
    ) as unknown as WizardDraft;

  const dtoVazio = (): ProcessoSeletivoDto =>
    ({
      id: '00000000-0000-0000-0000-000000000001',
      nome: 'Certame',
      tipoProcesso: { origemId: 'tp-1', nome: 'SiSU' },
      unidadeAdministradora: { origemId: 'un-1' },
      localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      origemCandidatos: 'INSCRICAO_PROPRIA',
    }) as unknown as ProcessoSeletivoDto;

  const secoesIntocadas = (): readonly string[] => {
    const antes = marcador();
    const depois = hidratarDraft(antes, dtoVazio());
    return SECOES_DO_RASCUNHO.filter((secao) => depois[secao] === antes[secao]);
  };

  it('relê do detalhe todas as seções, menos a publicação', () => {
    expect(secoesIntocadas()).toEqual([...SEM_READBACK_PELO_DETALHE]);
  });

  it('a exceção é uma só — uma seção nova sem readback quebra aqui', () => {
    // Escrito separado do teste acima de propósito: este é o que falha com a mensagem certa
    // quando alguém acrescenta um passo e esquece de relê-lo, em vez de um diff de listas.
    const inesperadas = secoesIntocadas().filter(
      (secao) => !SEM_READBACK_PELO_DETALHE.includes(secao as 'publicacao'),
    );

    expect(
      inesperadas,
      `estas seções do rascunho não são repostas por hidratarDraft e sumiriam num recarregamento: ${inesperadas.join(', ')}`,
    ).toEqual([]);
  });
});
