import axe from 'axe-core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { apresentacaoDoCampo } from '@uniplus/shared-inscricao/formulario';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { item } from '../formulario/formulario-de-inscricao.testing';
import { PASSO_FORMULARIO } from '../../processo-seletivo.data';
import { BonusPassoComponent } from './bonus.component';
import { montarPasso } from './bonus.component.testing';

const AVISO = '#f-bonus-elegibilidade-vazia';
const BOTAO = '#f-bonus-ir-formularios';

describe('BonusPassoComponent — quem recebe o acréscimo sem formulário montado', () => {
  let componente: BonusPassoComponent;
  let controller: HttpTestingController;
  let fixture: ComponentFixture<BonusPassoComponent>;
  let store: ProcessoSeletivoStore;

  beforeEach(() => {
    ({ componente, controller, fixture, store } = montarPasso());
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    });
  });

  afterEach(() => controller.verify());

  const tela = (): HTMLElement => fixture.nativeElement;
  const trecho = (seletor: string) => tela().querySelector<HTMLElement>(seletor);

  function digitar(seletor: string, valor: string): void {
    const campo = trecho(seletor) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function aplicarOAcrescimo(): void {
    componente.escolherAplicacao(true);
    fixture.detectChanges();
  }

  it('avisa por que a lista está vazia e oferece ir ao passo Formulários', () => {
    aplicarOAcrescimo();

    expect(trecho('#f-bonus-elegibilidade')?.querySelectorAll('option')).toHaveLength(1);
    expect(trecho(AVISO)?.textContent).toContain('formulário de inscrição ainda não foi montado');
    expect(trecho(BOTAO)?.textContent?.trim()).toBe('Ir para o passo Formulários');
  });

  it('anuncia o aviso como estado e deixa a ação como botão alcançável pelo teclado', () => {
    aplicarOAcrescimo();

    expect(trecho(AVISO)?.getAttribute('role')).toBe('status');
    const botao = trecho(BOTAO) as HTMLButtonElement;
    expect(botao.type).toBe('button');
    expect(botao.disabled).toBe(false);
    expect(botao.tabIndex).toBeGreaterThanOrEqual(0);
    botao.focus();
    expect(document.activeElement).toBe(botao);
  });

  it('leva ao passo Formulários e, ao remontar o passo FADA na volta, mantém o que foi preenchido', () => {
    aplicarOAcrescimo();
    digitar('#f-bonus-fator', '12.5');
    digitar('#f-bonus-teto', '40');

    trecho(BOTAO)?.click();
    expect(store.passoAtual()).toBe(PASSO_FORMULARIO);

    fixture.destroy();
    const aoVoltar = TestBed.createComponent(BonusPassoComponent);
    aoVoltar.detectChanges();
    controller.match(() => true).forEach((requisicao) => requisicao.flush([]));
    aoVoltar.detectChanges();
    const campo = (id: string) =>
      (aoVoltar.nativeElement as HTMLElement).querySelector<HTMLInputElement>(id);

    expect(campo('#f-bonus-fator')?.value).toBe('12.5');
    expect(campo('#f-bonus-teto')?.value).toBe('40');
  });

  it('não tem violação de acessibilidade com o aviso na tela', async () => {
    aplicarOAcrescimo();

    const resultado = await axe.run(tela(), { rules: { region: { enabled: false } } });

    expect(resultado.violations).toEqual([]);
  });

  it('deixa gravar o passo com tudo preenchido, menos a escolha de quem recebe o acréscimo', () => {
    aplicarOAcrescimo();
    store.patchObjectSection('bonus', {
      regraCodigo: 'REGRA_DE_TESTE',
      fator: '10',
      baseLegalBonusRegionalId: 'ba5e0000-0000-7000-8000-000000000001',
      fatoElegibilidadeCodigo: '',
    });

    expect(componente.validar()).toEqual({ valid: true });
  });

  it('com formulário montado sem campo de sim ou não, diz isso e mantém o botão', () => {
    store.patchObjectSection('formulario', {
      conteudo: {
        ...store.draft().formulario.conteudo,
        itens: [
          item('NOME_DO_CANDIDATO', 1, 'DADOS_BASICOS', {
            apresentacao: apresentacaoDoCampo('Nome', 'TEXTO'),
          }),
        ],
      },
    });
    aplicarOAcrescimo();

    expect(trecho(AVISO)?.textContent).toContain('não tem um campo de sim ou não');
    expect(trecho(AVISO)?.textContent).not.toContain('ainda não foi montado');
    expect(trecho(BOTAO)).not.toBeNull();
  });

  it('não mostra o aviso quando o formulário já oferece um campo de sim ou não', () => {
    store.patchObjectSection('formulario', {
      conteudo: {
        ...store.draft().formulario.conteudo,
        itens: [
          item('PEDE_O_ACRESCIMO', 1, 'DADOS_BASICOS', {
            apresentacao: apresentacaoDoCampo('Deseja solicitar o acréscimo?', 'SIM_OU_NAO'),
          }),
        ],
      },
    });
    aplicarOAcrescimo();

    expect(trecho(AVISO)).toBeNull();
  });

  it('não mostra o aviso nem a escolha quando o processo recebe o resultado importado', () => {
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatosCodigo.IMPORTACAO_EXTERNA,
    });
    aplicarOAcrescimo();

    expect(trecho('#f-bonus-elegibilidade')).toBeNull();
    expect(trecho(AVISO)).toBeNull();
  });

  it('não mostra o aviso em consulta, quando o processo não se edita mais', () => {
    aplicarOAcrescimo();
    store.publicacaoNaoConfirmada.set(true);
    fixture.detectChanges();

    expect(trecho(AVISO)).toBeNull();
  });
});
