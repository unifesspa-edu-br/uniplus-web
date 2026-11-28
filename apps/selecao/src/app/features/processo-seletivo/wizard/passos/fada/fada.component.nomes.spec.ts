import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FatoCandidatoComOperadores } from '@uniplus/shared-data/configuracao';
import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { FadaPassoComponent } from './fada.component';
import { montarPasso } from './fada.component.testing';

const nomeado = (codigo: string, nome: string): FatoCandidatoComOperadores =>
  ({ codigo, nome }) as unknown as FatoCandidatoComOperadores;

const derivacao = (codigoFato: string) => ({
  codigoFato,
  regras: [{ contribui: null, ordem: 1, quando: [] }],
});

describe('FadaPassoComponent: nome do dado do candidato', () => {
  let componente: FadaPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let fixture: ComponentFixture<FadaPassoComponent>;
  let catalogo: CatalogoDeFatos;

  beforeEach(() => {
    ({ componente, store, controller, fixture } = montarPasso());
    catalogo = TestBed.inject(CatalogoDeFatos);
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    });
    store.patchObjectSection('formulario', {
      derivacao: [derivacao('EGRESSO_ESCOLA_PUBLICA'), derivacao('SEM_NOME')],
    });
    componente.escolherAplicacao(true);
  });

  afterEach(() => controller.verify());

  const opcoes = (): string[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>(
        '#f-fada-elegibilidade option',
      ),
    ).map((opcao) => opcao.textContent?.trim() ?? '');

  it('mostra o dado calculado pelo processo como "Nome (CÓDIGO)", e só o código sem nome', () => {
    catalogo.fatos.set([nomeado('EGRESSO_ESCOLA_PUBLICA', 'Egresso de escola pública')]);
    fixture.detectChanges();

    expect(opcoes()).toContain('Egresso de escola pública (EGRESSO_ESCOLA_PUBLICA)');
    expect(opcoes()).toContain('SEM_NOME');
  });

  it('mostra só o código enquanto a leitura do cadastro falha e o nome quando ela chega', () => {
    catalogo.recarregar();
    controller
      .expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato'))
      .flush('erro', { status: 500, statusText: 'Erro' });
    fixture.detectChanges();
    expect(opcoes()).toContain('EGRESSO_ESCOLA_PUBLICA');

    catalogo.fatos.set([nomeado('EGRESSO_ESCOLA_PUBLICA', 'Egresso de escola pública')]);
    fixture.detectChanges();
    expect(opcoes()).toContain('Egresso de escola pública (EGRESSO_ESCOLA_PUBLICA)');
  });

  it('mantém o dado que saiu do formulário com nome e código, na opção e no erro', () => {
    catalogo.fatos.set([nomeado('FATO_QUE_SAIU', 'Fato que saiu')]);
    componente.escolherFatoDeElegibilidade('FATO_QUE_SAIU');
    fixture.detectChanges();

    expect(opcoes()).toContain('Fato que saiu (FATO_QUE_SAIU)');
    const erro = fixture.nativeElement.querySelector('#f-fada-elegibilidade-erro');
    expect(erro?.textContent).toContain('O fato Fato que saiu (FATO_QUE_SAIU) não está mais');
  });

  const EGRESSO = nomeado('EGRESSO_ESCOLA_PUBLICA', 'Egresso de escola pública');
  const REGRA = {
    codigo: 'REGRA-X',
    versao: '1.0',
    baseLegal: 'Portaria',
    rotulo: 'Regra de teste',
  };

  function prepararConfirmacao(fato: string): void {
    componente.escolherFatoDeElegibilidade(fato);
    componente.escolherRegra('REGRA-X|1.0');
    componente.alterarFator('1.2');
    componente.escolherBaseLegal('base-1');
  }

  const valorDaConfirmacao = (rotulo: string): string | undefined =>
    componente.confirmacaoDeGravacao()?.itens.find((item) => item.rotulo === rotulo)?.valor;

  const textoDaConsulta = (rotulo: string): string =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('ui-valor-em-consulta'),
    ).find((elemento) => elemento.textContent?.includes(rotulo))?.textContent ?? '';

  it('mostra na consulta o dado escolhido com nome e código', () => {
    catalogo.fatos.set([EGRESSO]);
    componente.escolherFatoDeElegibilidade('EGRESSO_ESCOLA_PUBLICA');
    store.publicacaoNaoConfirmada.set(true);
    fixture.detectChanges();

    expect(textoDaConsulta('Quem recebe')).toContain(
      'Egresso de escola pública (EGRESSO_ESCOLA_PUBLICA)',
    );
  });

  it('mostra só o código do dado escolhido que o cadastro não nomeia', () => {
    componente.escolherFatoDeElegibilidade('SEM_NOME');

    expect(componente.leitura().fatoElegibilidade).toBe('SEM_NOME');
  });

  it('mostra na confirmação o dado escolhido com nome e código', () => {
    catalogo.fatos.set([EGRESSO]);
    prepararConfirmacao('EGRESSO_ESCOLA_PUBLICA');

    expect(valorDaConfirmacao('Quem recebe o Fator de Atenuação')).toBe(
      'Egresso de escola pública (EGRESSO_ESCOLA_PUBLICA)',
    );
  });

  it('mostra na consulta o nome da regra da lista e, fora dela, o código', () => {
    componente.catalogos.regrasFada.set([REGRA] as never);
    componente.escolherRegra('REGRA-X|1.0');
    store.publicacaoNaoConfirmada.set(true);
    fixture.detectChanges();
    expect(textoDaConsulta('Regra do Fator')).toContain('Regra de teste');

    componente.catalogos.regrasFada.set([]);
    fixture.detectChanges();
    expect(textoDaConsulta('Regra do Fator')).toContain('REGRA-X');
    expect(textoDaConsulta('Regra do Fator')).not.toContain('Regra de teste');
  });

  it('mostra na confirmação o nome da regra da lista do passo', () => {
    componente.catalogos.regrasFada.set([REGRA] as never);
    prepararConfirmacao('SEM_NOME');

    expect(valorDaConfirmacao('Regra')).toBe('Regra de teste');
  });

  it('mostra na confirmação o código da regra que a lista não traz', () => {
    prepararConfirmacao('SEM_NOME');

    expect(valorDaConfirmacao('Regra')).toBe('REGRA-X');
  });
});
