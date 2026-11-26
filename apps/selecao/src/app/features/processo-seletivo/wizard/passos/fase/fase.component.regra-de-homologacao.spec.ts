import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { umaBancaRequeridaDaFase } from '../../shared/bancas/banca-declarada.testing';
import { regraDoDto } from '../../shared/homologacao/regra-de-homologacao-contrato';
import { REGRA_DE_HOMOLOGACAO_DO_SERVIDOR } from '../../shared/homologacao/regra-de-homologacao.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';
import { fase, ID_BANCA_HETERO } from './fase.testing';

const REGRA = regraDoDto(REGRA_DE_HOMOLOGACAO_DO_SERVIDOR);
const ID_DA_BANCA = 'fase-AVALIACAO-regra-banca-teste';
const GRUPO_DOS_TIPOS = 'fase-AVALIACAO-tipos-de-decisao';

describe('FasePassoComponent: a regra de homologação atravessa as edições da fase', () => {
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];

  usarFase((tela) => {
    ({ store, detectar, nativo, comCronograma } = tela);
  });

  const regraDaFase = () => store.draft().cronograma.fases[0].regraDeHomologacao;

  it('mexer na regra de deliberação da banca não altera a regra de homologação', () => {
    const banca = umaBancaRequeridaDaFase({
      identificadorLocal: 'banca-teste',
      tipoBancaId: ID_BANCA_HETERO,
    });
    comCronograma(fase({ regraDeHomologacao: REGRA, bancasRequeridas: [banca] }));

    const modo = nativo.querySelector<HTMLSelectElement>(`#${ID_DA_BANCA}-modo`);
    if (modo === null) throw new Error('O seletor de modo da banca não está na tela.');
    modo.value = ModoDeDeliberacao.COLEGIADA_COM_VOTACAO;
    modo.dispatchEvent(new Event('change'));
    detectar();

    expect(store.draft().cronograma.fases[0].bancasRequeridas[0].regraDeDeliberacao).not.toBeNull();
    expect(regraDaFase()).toStrictEqual(REGRA);
  });

  it('marcar um tipo de decisão não altera a regra de homologação', () => {
    comCronograma(fase({ regraDeHomologacao: REGRA }));

    const caixa = nativo.querySelector<HTMLInputElement>(`#${GRUPO_DOS_TIPOS}-CLASSIFICACAO`);
    if (caixa === null) throw new Error('A caixa do tipo de decisão não está na tela.');
    caixa.checked = true;
    caixa.dispatchEvent(new Event('change'));
    detectar();

    expect(store.draft().cronograma.fases[0].tiposDeDecisao).toEqual(['CLASSIFICACAO']);
    expect(regraDaFase()).toStrictEqual(REGRA);
  });

  it('a fase sem regra continua sem regra depois de editada', () => {
    comCronograma(fase({}));

    const caixa = nativo.querySelector<HTMLInputElement>(`#${GRUPO_DOS_TIPOS}-CLASSIFICACAO`);
    if (caixa === null) throw new Error('A caixa do tipo de decisão não está na tela.');
    caixa.checked = true;
    caixa.dispatchEvent(new Event('change'));
    detectar();

    expect(regraDaFase()).toBeNull();
  });
});
