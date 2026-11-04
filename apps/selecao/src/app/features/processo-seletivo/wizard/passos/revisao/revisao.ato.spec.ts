import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiOk } from '@uniplus/shared-core/http';
import { StatusProcesso } from '@uniplus/shared-data/selecao';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoPassoComponent } from './revisao.component';
import {
  ATO_PUBLICADO,
  atoCompleto,
  PROCESSO_DTO_MINIMO,
  ROTA_ATOS,
  ROTA_SNAPSHOT,
  SNAPSHOT_DTO,
  CONFORMIDADE_LEGAL_VERDE,
  CONFORMIDADE_VERDE,
  ROTA_CONFORMIDADE,
  ROTA_CONFORMIDADE_LEGAL,
  clicarEm,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  montarOCenario,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent — ato e período', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    cenario = await montarOCenario();
    ({ fixture, componente, store, controller } = cenario);
  });

  afterEach(() => controller.verify());

  describe('texto do número do ato sem valor', () => {
    /** O valor que a consulta mostra ao lado do rótulo, linha a linha. */
    function valorDaLinha(rotulo: string): string | undefined {
      const rotulos = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('dt'));
      return rotulos
        .find((dt) => dt.textContent?.trim() === rotulo)
        ?.nextElementSibling?.textContent?.trim();
    }

    it('na consulta do rascunho, diz "Não informado" no número e o tipo com o código', async () => {
      store.patchObjectSection('publicacao', { numero: '', ato: atoCompleto() });
      store.remoteSnapshot.set({
        ...PROCESSO_DTO_MINIMO,
        status: StatusProcesso.cancelado,
      } as never);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
      fixture.detectChanges();

      expect(valorDaLinha('Número do ato')).toBe('Não informado');
      expect(valorDaLinha('Tipo de ato')).toBe('Portaria (PORTARIA)');
    });

    it('no resumo do ato publicado, diz "não informado" e o tipo pelo nome', async () => {
      cenario.respostaDoAto = of(apiOk({ ...ATO_PUBLICADO, numero: null }, 200, new HttpHeaders()));
      store.remoteSnapshot.set(PROCESSO_DTO_MINIMO as never);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();
      controller.expectOne(ROTA_ATOS).flush([]);

      const lista = (fixture.nativeElement as HTMLElement).querySelector(
        'dl[aria-label="Ato publicado"]',
      );
      expect(lista?.textContent).toContain('Número do atonão informado');
      expect(lista?.textContent).toContain('Tipo de atoPortaria');
      expect(lista?.textContent).not.toContain('Portaria (PORTARIA)');
    });
  });

  describe('select de tipo de ato — sobrevive a destruir e recriar a seção', () => {
    /** O `<input type="number"` gravaria número num controle de texto; por isso o teste digita no campo. */
    it('valida sem estourar quando o ano é digitado no campo, e não posto no controle', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
      fixture.detectChanges();

      const ano = fixture.nativeElement.querySelector('#rev-ano') as HTMLInputElement;
      ano.value = '2027';
      ano.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(() => componente.validar()).not.toThrow();
      expect(store.draft().publicacao.ato.ano).toBe('2027');
    });

    /**
     * O formulário só existe dentro do `@else` de `prontidao.erro()`: uma recarga que falha
     * destrói o `<select>`, e a seguinte o recria. A seleção sobrevive porque o rascunho é a fonte
     * e o `formControlName` reaplica o valor a cada `<option>` que se registra.
     */
    it('mantém o tipo de ato escolhido visível depois de uma recarga que falha e outra que dá certo', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

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
      await flushProntidaoVerde(cenario);
      fixture.detectChanges();

      const aviso = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(aviso).toContain('Inscrição');
      expect(aviso).toContain('10/12/2026 às 00:00 até 10/01/2027 às 23:59');
      expect(aviso).not.toContain('INSCRICAO');
      expect(aviso).not.toContain('2026-12-10T');
    });
  });
});
