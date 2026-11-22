import {
  acrescentarBancaNaEtapa,
  retirarBancaDaEtapa,
  declararRegraNaBanca,
} from './bancas-da-etapa.testing';
import type { FormGroup } from '@angular/forms';
import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { COLEGIADA, comRegra } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import type { EtapaForm } from './cronograma-form';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { ID_AVALIACAO, ID_BANCA_HETERO } from './cronograma.testing';

const BANCAS = [
  { id: ID_BANCA_HETERO, nome: 'Heteroidentificação', codigo: { rotulo: 'Heteroidentificação' } },
  { id: 'outra-banca', nome: 'Redação', codigo: { rotulo: 'Redação' } },
] as TipoBancaDto[];

describe('CronogramaPassoComponent: regra de deliberação da banca da etapa', () => {
  let raiz: ContextoDoCronograma['raiz'];
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];

  usarCronograma((tela) => {
    ({ raiz, expansao, edicao, cronograma, store, detectar, nativo, comFases, comEtapasEmFases } =
      tela);
  });

  function etapaAberta(): FormGroup<EtapaForm> {
    raiz.injector.get(CatalogoDeBancas).bancas.set(BANCAS);
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    expansao.alternarFase(0);
    expansao.alternarEtapa(0);
    detectar();
    return cronograma.etapas.at(0);
  }

  const campo = <T extends HTMLElement>(sufixo: string) =>
    nativo.querySelector<T>(`#etapa-0-banca-banca-1-${sufixo}`);
  const escolher = (sufixo: string, valor: string) => {
    const select = campo<HTMLSelectElement>(sufixo);
    if (select === null) throw new Error(`Seletor ${sufixo} não está na tela.`);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    detectar();
  };
  const digitar = (sufixo: string, valor: string) => {
    const input = campo<HTMLInputElement>(sufixo);
    if (input === null) throw new Error(`Campo ${sufixo} não está na tela.`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    detectar();
  };
  const regraDa = (etapa: FormGroup<EtapaForm>, posicao = 0) =>
    edicao.bancasDaEtapa(etapa)[posicao]?.regraDeDeliberacao;

  it('mostra o editor da regra só para a banca que a etapa declara', () => {
    const etapa = etapaAberta();
    expect(campo('modo')).toBeNull();

    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    detectar();

    expect(campo<HTMLSelectElement>('modo')?.value).toBe('');
    expect(campo('integrantes')).toBeNull();

    retirarBancaDaEtapa(edicao, etapa, 'banca-1');
    detectar();

    expect(campo('modo')).toBeNull();
  });

  it('declara a regra da banca da etapa campo a campo', () => {
    const etapa = etapaAberta();
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    detectar();

    escolher('modo', ModoDeDeliberacao.colegiadaComVotacao);
    digitar('integrantes', '5');
    digitar('suplentes', '2');
    escolher('encerramento', 'presidenciaNoQuorum');
    digitar('quorum', '3');
    escolher('criterio', 'maioriaSimples');
    escolher('desempate', 'votoDaPresidencia');

    expect(regraDa(etapa)).toEqual(COLEGIADA);
    expect(etapa.controls.bancas.dirty).toBe(true);
  });

  it('acrescenta duas bancas do mesmo tipo pela tela e edita apenas a segunda', () => {
    const etapa = etapaAberta();
    const seletor = nativo.querySelector<HTMLSelectElement>('#cr-etapa-bancas-0-tipo');
    if (!seletor) throw new Error('Seletor de banca ausente.');
    seletor.value = ID_BANCA_HETERO;
    seletor.dispatchEvent(new Event('change'));
    const acrescentar = Array.from(nativo.querySelectorAll('button')).find(
      (botao) => botao.textContent?.trim() === 'Acrescentar banca',
    );
    if (!acrescentar) throw new Error('Botão de acrescentar banca ausente.');
    acrescentar.click();
    detectar();
    acrescentar.click();
    detectar();
    const modo = nativo.querySelector<HTMLSelectElement>('#etapa-0-banca-banca-2-modo');
    if (!modo) throw new Error('Modo da segunda banca ausente.');
    modo.value = ModoDeDeliberacao.atoIndividual;
    modo.dispatchEvent(new Event('change'));
    detectar();
    expect(edicao.bancasDaEtapa(etapa)).toHaveLength(2);
    expect(regraDa(etapa, 0)).toBeNull();
    expect(regraDa(etapa, 1)?.modo).toBe(ModoDeDeliberacao.atoIndividual);
  });

  it('cobra sob o campo o que a regra declarada ainda não tem', () => {
    const etapa = etapaAberta();
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    declararRegraNaBanca(edicao, etapa, 'banca-1', comRegra({ criterio: '' }));
    detectar();

    expect(campo('criterio-erro')?.textContent).toContain('Escolha o critério');
    expect(campo('criterio')?.getAttribute('aria-invalid')).toBe('true');
    expect(campo('quorum-erro')).toBeNull();
  });

  it('mostra a regra inválida já declarada mesmo com o cadastro de bancas vazio', () => {
    const etapa = etapaAberta();
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    declararRegraNaBanca(edicao, etapa, 'banca-1', comRegra({ criterio: '' }));
    raiz.injector.get(CatalogoDeBancas).bancas.set([]);
    detectar();

    expect(nativo.textContent).toContain('Nenhum tipo de banca no cadastro.');
    expect(campo('criterio-erro')?.textContent).toContain('Escolha o critério');
    expect(campo('criterio')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('explica a falha de carga do cadastro de bancas em vez de esconder a regra declarada', () => {
    const etapa = etapaAberta();
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    declararRegraNaBanca(edicao, etapa, 'banca-1', comRegra({ criterio: '' }));
    raiz.injector.get(CatalogoDeBancas).erro.set('Não foi possível carregar as bancas.');
    detectar();

    expect(nativo.querySelector('ui-alert .alert__title')?.textContent).toBe(
      'Não foi possível carregar os catálogos',
    );
    expect(nativo.textContent).toContain('bancas');
  });

  it('mantém a regra da banca quando outra é marcada ou desmarcada', () => {
    const etapa = etapaAberta();
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    declararRegraNaBanca(edicao, etapa, 'banca-1', COLEGIADA);

    acrescentarBancaNaEtapa(edicao, etapa, 'outra-banca');
    retirarBancaDaEtapa(edicao, etapa, 'banca-2');

    expect(edicao.bancasDaEtapa(etapa)).toEqual([
      {
        id: null,
        identificadorLocal: 'banca-1',
        copiaDoTipo: null,
        tipoBancaId: ID_BANCA_HETERO,
        regraDeDeliberacao: COLEGIADA,
      },
    ]);
  });

  it('declara a regra só da banca escolhida entre duas do mesmo tipo', () => {
    const etapa = etapaAberta();
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);

    declararRegraNaBanca(edicao, etapa, 'banca-2', COLEGIADA);

    expect(regraDa(etapa, 0)).toBeNull();
    expect(regraDa(etapa, 1)).toEqual(COLEGIADA);
  });

  it('não aceita edição da regra com a edição suspensa', () => {
    const etapa = etapaAberta();
    acrescentarBancaNaEtapa(edicao, etapa, ID_BANCA_HETERO);
    declararRegraNaBanca(edicao, etapa, 'banca-1', COLEGIADA);
    store.salvando.set(true);
    detectar();

    expect(campo<HTMLSelectElement>('modo')?.disabled).toBe(true);
    expect(campo<HTMLInputElement>('integrantes')?.disabled).toBe(true);
  });
});
