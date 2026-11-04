import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoStepComponent } from './revisao.component';
import {
  CONFORMIDADE_LEGAL_VERDE,
  CONFORMIDADE_VERDE,
  ROTA_CONFORMIDADE,
  ROTA_CONFORMIDADE_LEGAL,
  clicarEm,
  criarProcesso,
  flushMicrotasks,
  flushPreflightVerde,
  montarOCenario,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoStepComponent — ato e período', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoStepComponent>;
  let componente: RevisaoStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    cenario = await montarOCenario();
    ({ fixture, componente, store, controller } = cenario);
  });

  afterEach(() => controller.verify());

  describe('select de tipo de ato — sobrevive a destruir e recriar a seção', () => {
    /**
     * O bloco do formulário só existe dentro do `@else` de
     * `preflight.erro()`: uma recarga que falhe destrói o `<select>`
     * inteiro, e uma recarga seguinte que dê certo o recria do zero, com as
     * `<option>` do `@for` de novo. O binding é `formControlName`, não
     * `[value]` cru — `NgSelectOption` reaplica `writeValue()` do controle a
     * cada `<option>` que se registra, então a seleção sobrevive mesmo
     * quando as opções são criadas depois do valor já estar no controle.
     */
    /**
     * Regressão de `#738`. Os demais testes deste arquivo preenchem o rascunho
     * pelo store, então o mapeador sempre recebia texto — e o defeito vivia
     * justamente **entre** o template e o mapeador: com `type="number"`, o
     * `NumberValueAccessor` do Angular grava número num controle declarado
     * como texto, e `validate()` estourava com `texto.trim is not a function`.
     *
     * Por isso este teste atravessa o DOM: escreve no `<input>` e dispara o
     * evento, que é o caminho que o operador percorre. Preencher o controle por
     * `setValue` não reproduz o defeito, porque aí o valor já é do tipo
     * declarado.
     */
    it('valida sem estourar quando o ano é digitado no campo, e não posto no controle', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushPreflightVerde(cenario);
      fixture.detectChanges();

      const ano = fixture.nativeElement.querySelector('#rev-ano') as HTMLInputElement;
      ano.value = '2027';
      ano.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(() => componente.validate()).not.toThrow();
      expect(store.draft().publicacao.ato.ano).toBe('2027');
    });

    it('mantém o tipo de ato escolhido visível depois de uma recarga que falha e outra que dá certo', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushPreflightVerde(cenario);

      fixture.detectChanges();
      let select = fixture.nativeElement.querySelector('#rev-tipo-ato') as HTMLSelectElement;
      select.value = 'PORTARIA';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(select.value).toBe('PORTARIA');

      // Recarga que falha — o `@else` inteiro sai da árvore, o `<select>` é destruído.
      clicarEm(cenario, 'Atualizar checklist');
      controller.expectOne(ROTA_CONFORMIDADE).flush(
        { type: 'about:blank', title: 'x', status: 500, code: 'erro', traceId: 't' },
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#rev-tipo-ato')).toBeNull();

      // Recarga que dá certo — o `@else` volta, o `<select>` é recriado do zero.
      clicarEm(cenario, 'Tentar novamente');
      controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();
      fixture.detectChanges();

      select = fixture.nativeElement.querySelector('#rev-tipo-ato') as HTMLSelectElement;
      expect(select?.value).toBe('PORTARIA');
      expect(store.draft().publicacao.ato.tipoAtoCodigo).toBe('PORTARIA');
    });
  });

  describe('período de inscrição', () => {
    it('nomeia a fase e mostra a janela em data e hora locais', async () => {
      const faseDeInscricao: FaseDoCronograma = {
        faseCanonicaId: 'fase-inscricao-1',
        codigo: 'INSCRICAO',
        ordem: 1,
        inicio: '2026-12-10T03:00:00+00:00',
        fim: '2027-01-11T02:59:00+00:00',
        unidadeResponsavelId: null,
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        congelados: null,
      };
      cenario.fasePorId.set(
        new Map([
          [
            'fase-inscricao-1',
            {
              id: 'fase-inscricao-1',
              codigo: 'INSCRICAO',
              nome: 'Inscrição',
              coletaInscricao: true,
            } as FaseCanonicaDto,
          ],
        ]),
      );
      store.patchObjectSection('cronograma', { fases: [faseDeInscricao] });
      await criarProcesso(cenario);
      await flushPreflightVerde(cenario);
      fixture.detectChanges();

      const aviso = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(aviso).toContain('Inscrição');
      expect(aviso).toContain('10/12/2026 às 00:00 até 10/01/2027 às 23:59');
      expect(aviso).not.toContain('INSCRICAO');
      expect(aviso).not.toContain('2026-12-10T');
    });
  });
});
