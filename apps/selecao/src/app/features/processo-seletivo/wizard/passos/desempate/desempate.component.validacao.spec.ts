import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { DesempatePassoComponent } from './desempate.component';
import { criterio, montarPassoDeDesempate, ROTA_DESEMPATE } from './desempate.component.testing';

describe('DesempatePassoComponent — validação e gravação', () => {
  let componente: DesempatePassoComponent;
  let fixture: ComponentFixture<DesempatePassoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    ({ fixture, store, controller } = await montarPassoDeDesempate());
    componente = fixture.componentInstance;
  });

  afterEach(() => controller.verify());

  describe('DESEMPATE-MAIOR-NOTA-ETAPA — exige etapaRef existente', () => {
    it('recusa sem etapaRef', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA', regraVersao: '1.0' }),
      ]);

      expect(componente.validar().valid).toBe(false);
    });

    it('recusa quando a etapa referenciada não existe mais', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-removida',
        }),
      ]);

      expect(componente.validar().valid).toBe(false);
    });

    it('aceita com etapaRef existente', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-1',
        }),
      ]);

      expect(componente.validar().valid).toBe(true);
    });
  });

  describe('DESEMPATE-IDOSO — exige idadeMinima maior que zero', () => {
    it('recusa idade mínima ausente', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0' }),
      ]);

      expect(componente.validar().valid).toBe(false);
    });

    it('aceita com idade mínima informada', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
      ]);

      expect(componente.validar().valid).toBe(true);
    });
  });

  describe('DESEMPATE-PREDICADO-FATO — exige fato, operador e valor', () => {
    it('recusa incompleto', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-PREDICADO-FATO', regraVersao: '1.0', fato: 'RENDA' }),
      ]);

      expect(componente.validar().valid).toBe(false);
    });

    it('aceita completo', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'RENDA_PER_CAPITA',
          operador: 'MENOR_IGUAL',
          valor: '1',
        }),
      ]);

      expect(componente.validar().valid).toBe(true);
    });

    /**
     * Antes a conferência olhava só se os três campos estavam preenchidos. `lte` parece um
     * operador e não é: o vocabulário do domínio tem `MENOR_IGUAL`, e o servidor recusava sem
     * dizer qual dos três campos estava errado.
     */
    it('recusa a comparação que não pertence ao vocabulário', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'RENDA_PER_CAPITA',
          operador: 'lte',
          valor: '1',
        }),
      ]);

      const resultado = componente.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toContain('não admite a comparação escolhida');
    });

    /** Valor fora do domínio declarado também é acusado antes da gravação. */
    it('recusa o valor que não pertence ao domínio do fato', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'COR_RACA',
          operador: 'IGUAL',
          valor: '"AZUL"',
        }),
      ]);

      const resultado = componente.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toContain('fora do domínio declarado');
    });

    /**
     * Voltar o seletor para "escolha o fato" tem de limpar o critério. Enquanto a escolha em
     * branco era ignorada, a tela mostrava o campo vazio e o rascunho continuava com o fato
     * anterior — gravava-se um desempate por cor/raça que o operador acreditava ter apagado.
     */
    it('voltar o seletor ao branco limpa o fato no rascunho, não só na tela', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'COR_RACA',
          operador: 'IGUAL',
          valor: '"PRETA"',
        }),
      ]);

      fixture.detectChanges();
      const fato = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
        '#desemp-0-fato',
      );
      if (fato === null) throw new Error('seletor do fato ausente');
      fato.value = '';
      fato.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const criterioAtual = store.draft().desempate[0];
      expect(criterioAtual.fato).toBe('');
      expect(criterioAtual.operador).toBe('');
      expect(criterioAtual.valor).toBe('');
      expect(componente.validar().valid).toBe(false);
    });

    /**
     * O valor categórico chega do servidor como texto JSON — o mesmo formato do gatilho da
     * exigência documental. Antes de as duas leituras convergirem, o select ficava em branco
     * sobre um critério íntegro, e a gravação era recusada por "está sem valor".
     */
    it('lê de volta o valor categórico no formato em que o servidor o devolve', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'COR_RACA',
          operador: 'IGUAL',
          valor: '"PRETA"',
        }),
      ]);

      fixture.detectChanges();
      const valor = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
        '#desemp-0-valor',
      );
      expect(valor?.value).toBe('PRETA');
      expect(componente.validar().valid).toBe(true);
    });

    /** Fato que não está no catálogo é acusado pelo código, não silenciosamente aceito. */
    it('recusa o fato que não está no catálogo', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'RELIGIAO',
          operador: 'IGUAL',
          valor: '"X"',
        }),
      ]);

      expect(componente.validar().valid).toBe(false);
    });
  });

  describe('DESEMPATE-MAIOR-IDADE — sem argumento', () => {
    it('aceita sem nenhum campo adicional', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-MAIOR-IDADE', regraVersao: '1.0' }),
      ]);

      expect(componente.validar().valid).toBe(true);
    });
  });

  describe('persistir()', () => {
    it('grava a coleção vazia quando não há critério (CA-05)', async () => {
      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_DESEMPATE);
      expect(requisicao.request.method).toBe('PUT');
      expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicao.request.body).toEqual([]);

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('grava a coleção inteira, com ordem pela posição em tela', async () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-1',
        }),
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
      ]);

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_DESEMPATE);
      expect(requisicao.request.body).toEqual([
        {
          ordem: 1,
          regra: { codigo: 'DESEMPATE-MAIOR-NOTA-ETAPA', versao: '1.0' },
          parametros: {
            etapaRef: 'etapa-1',
            idadeMinima: null,
            fato: null,
            operador: null,
            valor: null,
            areas: null,
          },
        },
        {
          ordem: 2,
          regra: { codigo: 'DESEMPATE-IDOSO', versao: '1.0' },
          parametros: {
            etapaRef: null,
            idadeMinima: 60,
            fato: null,
            operador: null,
            valor: null,
            areas: null,
          },
        },
      ]);

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
    });

    it('não chama a API quando a validação recusa', async () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0' }),
      ]);

      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      controller.verify();
    });
  });
});
