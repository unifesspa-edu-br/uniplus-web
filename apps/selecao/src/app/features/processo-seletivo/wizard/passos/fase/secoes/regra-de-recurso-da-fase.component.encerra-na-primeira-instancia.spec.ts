import type { HttpTestingController } from '@angular/common/http/testing';
import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { PapelDaBancaCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BancaRequeridaDaFase, FaseDoCronograma } from '../../../processo-seletivo.models';
import { umaBancaRequeridaDaFase } from '../../../shared/bancas/banca-declarada.testing';
import { CatalogoDeBancas } from '../../cronograma/catalogos/catalogo-de-bancas.service';
import { montarFase } from '../fase.testing';
import { faseComRegra, PREFIXO } from './regra-de-recurso-da-fase.testing';
import { conferirSemPendenciasDosMotivos } from '../motivos/motivos-nos-passos.testing';

const AVISO = 'O recurso deste tipo se encerra na 1ª instância.';

const bancaGravada = (encerra: boolean): BancaRequeridaDaFase =>
  umaBancaRequeridaDaFase({
    id: '01960000-0000-7000-0000-0000000000b1',
    copiaDoTipo: {
      rotulo: 'Banca de entrevista',
      papel: { codigo: PapelDaBancaCodigo.AVALIA_O_MERITO, rotulo: 'Avalia o mérito' },
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: encerra,
    },
  });

describe('RegraDeRecursoDaFaseComponent: recurso que se encerra na 1ª instância', () => {
  let controller: HttpTestingController;
  let nativo: HTMLElement;
  let detectar: () => void;
  let comCronograma: (...fases: readonly FaseDoCronograma[]) => void;
  let cadastro: CatalogoDeBancas;

  beforeEach(async () => {
    let elementoDaTela;
    ({ controller, nativo, comCronograma, detectar, elementoDaTela } = await montarFase());
    cadastro = elementoDaTela.injector.get(CatalogoDeBancas);
  });

  afterEach(() => conferirSemPendenciasDosMotivos(controller));

  const comBancas = (...bancas: readonly BancaRequeridaDaFase[]) => {
    comCronograma({ ...faseComRegra(), bancasRequeridas: bancas });
    detectar();
  };
  const noCadastro = (encerra: boolean) =>
    cadastro.bancas.set([
      {
        id: 'entrevista',
        codigo: { rotulo: 'Banca de entrevista' },
        encerraRecursoNaPrimeiraInstancia: encerra,
      } as TipoBancaDto,
    ]);
  const aviso = () => nativo.querySelector(`#${PREFIXO}-superior-encerra`);
  const pergunta = () => nativo.querySelector(`#${PREFIXO}-superior-sim`)?.closest('fieldset');

  it('avisa junto da pergunta quando a cópia do tipo da banca traz a marca, sem escondê-la', () => {
    comBancas(bancaGravada(true));

    expect(aviso()?.textContent?.trim()).toBe(AVISO);
    expect(pergunta()?.getAttribute('aria-describedby')).toContain(`${PREFIXO}-superior-encerra`);
    expect(nativo.querySelector<HTMLInputElement>(`#${PREFIXO}-superior-sim`)?.disabled).toBe(
      false,
    );
  });

  it('não avisa quando nenhuma cópia traz a marca', () => {
    comBancas(bancaGravada(false));

    expect(aviso()).toBeNull();
  });

  it('não avisa sem banca na fase', () => {
    comBancas();

    expect(aviso()).toBeNull();
  });

  it('lê a cópia guardada na banca, mesmo que o cadastro diga outra coisa', () => {
    comBancas(bancaGravada(true));
    noCadastro(false);
    detectar();
    expect(aviso()).not.toBeNull();

    comBancas(bancaGravada(false));
    noCadastro(true);
    detectar();
    expect(aviso()).toBeNull();
  });
});
