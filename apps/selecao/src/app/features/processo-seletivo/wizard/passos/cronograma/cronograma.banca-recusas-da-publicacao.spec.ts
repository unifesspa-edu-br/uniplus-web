import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';

import {
  umaBancaDeclarada,
  umaBancaRequeridaDaFase,
} from '../../shared/bancas/banca-declarada.testing';
import { NOTA_DA_BANCA_AUSENTE } from '../../shared/bancas/recusas-das-bancas';
import { COLEGIADA } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDaPublicacaoRecusada,
  daBancaDaEtapa,
  daBancaDaFase,
  daEtapa,
  daFase,
} from './cronograma-recusas-da-publicacao.testing';
import { ID_AVALIACAO, ID_BANCA_HETERO } from './cronograma.testing';

const ETAPA = '01960000-0000-7000-0000-0000000000e1';
const CODIGO = 'uniplus.selecao.banca.regra_de_deliberacao_obrigatoria';
const BANCAS = [
  { id: ID_BANCA_HETERO, nome: 'Heteroidentificação', codigo: { rotulo: 'Heteroidentificação' } },
] as TipoBancaDto[];

const daTela = (n: number, id: string) =>
  umaBancaDeclarada({
    id,
    identificadorLocal: `banca-${n}`,
    tipoBancaId: ID_BANCA_HETERO,
    regraDeDeliberacao: COLEGIADA,
  });

describe('CronogramaPassoComponent: recusas da publicação às bancas', () => {
  let tela: ContextoDoCronograma;
  let ajudantes: AjudantesDaPublicacaoRecusada;

  usarCronograma((montada) => {
    tela = montada;
    ajudantes = new AjudantesDaPublicacaoRecusada(montada);
  });

  function comBancasNaEtapa(...ids: string[]): void {
    tela.raiz.injector.get(CatalogoDeBancas).bancas.set(BANCAS);
    tela.comFases(ID_AVALIACAO);
    tela.comEtapasEmFases(['AVALIACAO']);
    const etapa = tela.cronograma.etapas.at(0);
    etapa.controls.id.setValue(ETAPA);
    etapa.controls.bancas.setValue(ids.map((id, i) => daTela(i + 1, id)));
    tela.expansao.abrirFases([0]);
    tela.expansao.abrirEtapas([0]);
    tela.detectar();
  }
  function comBancasNaFase(...ids: string[]): void {
    tela.raiz.injector.get(CatalogoDeBancas).bancas.set(BANCAS);
    tela.comFases(ID_AVALIACAO);
    tela.comUmaEtapa();
    const [fase] = tela.store.draft().cronograma.fases;
    const bancasRequeridas = ids.map((id, i) => ({
      ...umaBancaRequeridaDaFase(daTela(i + 1, id)),
    }));
    tela.store.patchObjectSection('cronograma', { fases: [{ ...fase, bancasRequeridas }] });
    tela.expansao.abrirFases([0]);
    tela.detectar();
  }
  const daBancaDaEtapaNaTela = (n: number) =>
    ajudantes.bloco(`cr-etapa-bancas-0-banca-${n}-recusas`);
  const doModoDaEtapaNaTela = (n: number) =>
    ajudantes.bloco(`etapa-0-banca-banca-${n}-modo-recusas`);
  const doModoDaFaseNaTela = (n: number) =>
    ajudantes.bloco(`fase-AVALIACAO-regra-banca-${n}-modo-recusas`);
  const daBancaDaFaseNaTela = (n: number) =>
    ajudantes.bloco(`fase-AVALIACAO-bancas-banca-${n}-recusas`);

  it('acha a banca da etapa pelo identificador, e não pela posição que a API deu', () => {
    comBancasNaEtapa('id-1', 'id-2');

    ajudantes.recusar({
      field: 'etapas[0].bancas[0].regraDeDeliberacao',
      code: CODIGO,
      message: 'Declare a regra.',
      identificadores: [daEtapa(ETAPA), daBancaDaEtapa('id-2')],
    });

    expect(doModoDaEtapaNaTela(2)).toContain('Declare a regra.');
    expect(doModoDaEtapaNaTela(2)).toContain('Apontada na última tentativa de publicação.');
    expect(doModoDaEtapaNaTela(1)).toBeNull();
  });

  it('leva à seção, com a nota, a recusa da etapa sem identificador de banca', () => {
    comBancasNaEtapa('id-1', 'id-2');

    ajudantes.recusar({
      field: 'etapas[0].bancas[1]',
      code: CODIGO,
      message: 'Banca sem identificador.',
      identificadores: [daEtapa(ETAPA)],
    });

    expect(ajudantes.bloco('cr-etapa-bancas-erro-0')).toContain(NOTA_DA_BANCA_AUSENTE);
    expect(daBancaDaEtapaNaTela(1)).toBeNull();
    expect(daBancaDaEtapaNaTela(2)).toBeNull();
  });

  it('leva à seção, com a nota, a recusa de banca da etapa que não está mais na tela', () => {
    comBancasNaEtapa('id-1');

    ajudantes.recusar({
      field: 'etapas[0].bancas[1]',
      code: CODIGO,
      message: 'Banca que saiu.',
      identificadores: [daEtapa(ETAPA), daBancaDaEtapa('id-2')],
    });

    expect(ajudantes.bloco('cr-etapa-bancas-erro-0')).toContain('Banca que saiu.');
    expect(ajudantes.bloco('cr-etapa-bancas-erro-0')).toContain(NOTA_DA_BANCA_AUSENTE);
  });

  it('"Ir ao campo" leva o foco ao controle da banca da etapa recusada', async () => {
    comBancasNaEtapa('id-1', 'id-2');
    ajudantes.recusar({
      field: 'etapas[0].bancas[0].regraDeDeliberacao.quorum',
      code: CODIGO,
      message: 'Quórum fora do intervalo.',
      identificadores: [daEtapa(ETAPA), daBancaDaEtapa('id-2')],
    });

    await ajudantes.irAoCampo(0);

    expect(document.activeElement?.id).toBe('etapa-0-banca-banca-2-quorum');
  });

  it('acha a banca da fase pelo identificador, e não pela posição que a API deu', () => {
    comBancasNaFase('id-1', 'id-2');

    ajudantes.recusar({
      field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao',
      code: CODIGO,
      message: 'Declare a regra.',
      identificadores: [daFase('AVALIACAO'), daBancaDaFase('id-2')],
    });

    expect(doModoDaFaseNaTela(2)).toContain('Declare a regra.');
    expect(doModoDaFaseNaTela(1)).toBeNull();
  });

  it('leva à seção da fase, com a nota, a recusa sem identificador de banca', () => {
    comBancasNaFase('id-1');

    ajudantes.recusar({
      field: 'fases[0].bancasRequeridas[0]',
      code: CODIGO,
      message: 'Banca sem identificador.',
      identificadores: [daFase('AVALIACAO')],
    });

    expect(ajudantes.bloco('fase-AVALIACAO-bancas-erro')).toContain(NOTA_DA_BANCA_AUSENTE);
    expect(daBancaDaFaseNaTela(1)).toBeNull();
  });

  it('"Ir ao campo" leva o foco ao grupo da banca da fase recusada, quando não há controle', async () => {
    comBancasNaFase('id-1', 'id-2');
    ajudantes.recusar({
      field: 'fases[0].bancasRequeridas[0]',
      code: CODIGO,
      message: 'Banca recusada.',
      identificadores: [daFase('AVALIACAO'), daBancaDaFase('id-1')],
    });

    await ajudantes.irAoCampo(0);

    expect(document.activeElement?.id).toBe('fase-AVALIACAO-bancas-banca-1');
  });
});
