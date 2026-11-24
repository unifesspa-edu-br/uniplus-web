import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { apresentacaoDoCampo } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { item } from '../formulario/formulario-de-inscricao.testing';
import { BasesLegaisDeBonus } from './bases-legais-de-bonus.service';
import { BonusPassoComponent } from './bonus.component';
import {
  BASE_LEGAL_ID,
  ROTA_BONUS,
  ROTA_DAS_BASES,
  TIPO_DA_BASE,
  montarPasso,
} from './bonus.component.testing';

describe('BonusPassoComponent', () => {
  let componente: BonusPassoComponent;
  let basesLegais: BasesLegaisDeBonus;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let fixture: ComponentFixture<BonusPassoComponent>;

  beforeEach(() => {
    ({ componente, basesLegais, store, controller, fixture } = montarPasso());
  });

  afterEach(() => controller.verify());

  it('o controle da pergunta acompanha o rascunho hidratado e grava nele ao mudar', () => {
    store.patchObjectSection('bonus', { aplica: false });
    fixture.detectChanges();
    expect(componente.aplica.value).toBe(false);

    componente.aplica.setValue(true);
    expect(store.draft().bonus.aplica).toBe(true);
  });

  it('recusa enquanto a declaração de aplicar ou não o FADA não foi respondida', () => {
    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado).toMatchObject({
      messages: ['Informe se o processo aplica o FADA.'],
    });
  });

  it('é válido declarando que não aplica, sem nenhum campo preenchido', () => {
    componente.escolherAplicacao(false);

    expect(componente.validar().valid).toBe(true);
  });

  it('recusa ativo sem regra escolhida', () => {
    componente.escolherAplicacao(true);
    expect(componente.validar().valid).toBe(false);
  });

  it('recusa fator zero ou negativo', () => {
    componente.escolherAplicacao(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.escolherBaseLegal(BASE_LEGAL_ID);
    componente.alterarFator('0');

    expect(componente.validar().valid).toBe(false);
  });

  it('recusa ativo sem base legal escolhida', () => {
    componente.escolherAplicacao(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');

    expect(componente.validar().valid).toBe(false);
  });

  it('aceita ativo com regra, fator e base legal válidos, sem teto', () => {
    componente.escolherAplicacao(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');
    componente.escolherBaseLegal(BASE_LEGAL_ID);

    expect(componente.validar().valid).toBe(true);
  });

  it('recusa teto informado igual ou menor que zero', () => {
    componente.escolherAplicacao(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');
    componente.escolherBaseLegal(BASE_LEGAL_ID);
    componente.alterarTeto('0');

    expect(componente.validar().valid).toBe(false);
  });

  /**
   * O registro guarda fator e teto com dois dígitos inteiros e quatro decimais. Num certame
   * cuja nota é em base 100, "teto de 100 pontos" é o primeiro valor que quem monta o edital
   * escreve — e voltava recusado pelo servidor sem que o campo dissesse nada sobre faixa.
   */
  it('recusa o teto acima da precisão com que ele é guardado', () => {
    componente.escolherAplicacao(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');
    componente.escolherBaseLegal(BASE_LEGAL_ID);
    componente.alterarTeto('100');

    const resultado = componente.validar();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('99,9999');
  });

  it('recusa o fator com mais casas decimais do que o registro guarda', () => {
    componente.escolherAplicacao(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.23456');
    componente.escolherBaseLegal(BASE_LEGAL_ID);

    const resultado = componente.validar();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('4 casas decimais');
  });

  it('aceita o valor no limite da precisão', () => {
    componente.escolherAplicacao(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('99.9999');
    componente.escolherBaseLegal(BASE_LEGAL_ID);

    expect(componente.validar().valid).toBe(true);
  });

  describe('persistir()', () => {
    it('grava a declaração de que não aplica, com os campos null', async () => {
      componente.escolherAplicacao(false);
      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_BONUS);
      expect(requisicao.request.method).toBe('PUT');
      expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicao.request.body).toEqual({
        aplica: false,
        regra: null,
        fator: null,
        teto: null,
        baseLegal: null,
        fatoElegibilidadeCodigo: null,
      });

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('grava os campos preenchidos quando ativo', async () => {
      componente.escolherAplicacao(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');
      componente.escolherBaseLegal(BASE_LEGAL_ID);

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_BONUS);
      expect(requisicao.request.body).toEqual({
        aplica: true,
        regra: { codigo: 'BONUS-MULTIPLICATIVO', versao: '1.0' },
        fator: 1.2,
        teto: null,
        baseLegal: { id: BASE_LEGAL_ID },
        fatoElegibilidadeCodigo: null,
      });

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
    });

    it('não chama a API quando a validação recusa', async () => {
      componente.escolherAplicacao(true);
      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      controller.verify();
    });

    it('preserva o rascunho quando a API recusa', async () => {
      componente.escolherAplicacao(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');
      componente.escolherBaseLegal(BASE_LEGAL_ID);

      const gravacao = componente.persistir();

      controller.expectOne(ROTA_BONUS).flush(
        {
          type: 'about:blank',
          title: 'O fator do FADA deve ser maior que zero.',
          status: 422,
          code: 'ConfiguracaoBonusRegional.FatorInvalido',
          traceId: 'trace-1',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(store.draft().bonus.aplica).toBe(true);
      expect(store.salvando()).toBe(false);
    });
  });

  describe('confirmacaoDeGravacao()', () => {
    it('confirma que o processo não aplica o FADA', () => {
      componente.escolherAplicacao(false);
      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao?.itens).toEqual([
        { rotulo: 'FADA', valor: 'Não aplicado neste processo' },
      ]);
    });

    it('devolve null quando ativo mas inválido', () => {
      componente.escolherAplicacao(true);
      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('resume os campos quando ativo e válido', () => {
      componente.escolherAplicacao(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');
      componente.escolherBaseLegal(BASE_LEGAL_ID);

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao?.itens.map((item) => item.rotulo)).toEqual([
        'Regra',
        'Fator',
        'Teto',
        'Base legal',
      ]);
    });

    it('mostra a identificação da base legal do catálogo', () => {
      // A carga inicial do beforeEach já foi flushada com [] — refaz a busca para
      // interceptar esta com dados reais, sem alterar o setup compartilhado.
      basesLegais.carregar();
      const requisicaoBaseLegal = controller.expectOne((r) => r.url === ROTA_DAS_BASES);
      requisicaoBaseLegal.flush([
        {
          id: BASE_LEGAL_ID,
          tipoInstrumento: TIPO_DA_BASE,
          identificacao: 'Portaria Unifesspa nº 2514/2023',
          descricao: 'Institui inclusão regional.',
          municipios: [],
          criadoEm: '2026-01-01T00:00:00Z',
        },
      ]);

      componente.escolherAplicacao(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');
      componente.escolherBaseLegal(BASE_LEGAL_ID);

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao?.itens).toContainEqual({
        rotulo: 'Base legal',
        valor: 'Portaria Unifesspa nº 2514/2023',
      });
    });
  });

  describe('quem recebe o acréscimo', () => {
    function comInscricaoPropriaEFormulario(): void {
      store.patchObjectSection('identificacao', {
        origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
      });
      store.patchObjectSection('formulario', {
        conteudo: {
          ...store.draft().formulario.conteudo,
          itens: [
            item('PEDE_O_ACRESCIMO', 1, 'DADOS_BASICOS', {
              apresentacao: apresentacaoDoCampo('Deseja solicitar o acréscimo?', 'BOOLEANO'),
            }),
          ],
        },
      });
    }

    const seletor = (): HTMLSelectElement | null =>
      fixture.nativeElement.querySelector('#f-bonus-elegibilidade');

    it('pede o fato só quando o processo aplica o acréscimo e tem inscrição própria', () => {
      comInscricaoPropriaEFormulario();
      componente.escolherAplicacao(false);
      fixture.detectChanges();
      expect(seletor()).toBeNull();

      componente.escolherAplicacao(true);
      fixture.detectChanges();
      const opcoes = Array.from(seletor()?.options ?? []).map((opcao) => opcao.textContent?.trim());
      expect(opcoes).toContain('Deseja solicitar o acréscimo? (PEDE_O_ACRESCIMO)');
    });

    it('avisa quando o fato escolhido saiu do formulário de inscrição', () => {
      comInscricaoPropriaEFormulario();
      componente.escolherAplicacao(true);
      componente.escolherFatoDeElegibilidade('FATO_QUE_SAIU');
      fixture.detectChanges();

      expect(seletor()?.getAttribute('aria-invalid')).toBe('true');
      const aviso = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
      expect(aviso?.textContent).toContain('O fato FATO_QUE_SAIU não está mais no formulário');
    });

    it('liga ao campo o motivo do erro, além da ajuda, só quando o fato saiu do formulário', () => {
      comInscricaoPropriaEFormulario();
      componente.escolherAplicacao(true);
      componente.escolherFatoDeElegibilidade('PEDE_O_ACRESCIMO');
      fixture.detectChanges();
      expect(seletor()?.getAttribute('aria-describedby')).toBe('f-bonus-elegibilidade-ajuda');

      componente.escolherFatoDeElegibilidade('FATO_QUE_SAIU');
      fixture.detectChanges();
      expect(seletor()?.getAttribute('aria-describedby')).toBe(
        'f-bonus-elegibilidade-ajuda f-bonus-elegibilidade-erro',
      );
      expect(
        fixture.nativeElement.querySelector('#f-bonus-elegibilidade-erro')?.textContent,
      ).toContain('O fato FATO_QUE_SAIU não está mais no formulário');
    });

    it('mostra na consulta quem recebe o acréscimo, pelo rótulo do campo', () => {
      comInscricaoPropriaEFormulario();
      componente.escolherAplicacao(true);
      componente.escolherFatoDeElegibilidade('PEDE_O_ACRESCIMO');
      store.publicacaoNaoConfirmada.set(true);
      fixture.detectChanges();

      expect(seletor()).toBeNull();
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('Quem recebe o acréscimo');
      expect(texto).toContain('Deseja solicitar o acréscimo? (PEDE_O_ACRESCIMO)');
    });
  });
});
