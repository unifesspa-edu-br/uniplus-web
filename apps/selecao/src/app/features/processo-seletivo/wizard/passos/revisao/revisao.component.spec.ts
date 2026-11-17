import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoPassoComponent } from './revisao.component';
import {
  PROCESSO_DTO_MINIMO,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  montarOCenario,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent', () => {
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

  it('em consulta, não orienta a anexar o edital nem a concluir a identificação', async () => {
    store.remoteSnapshot.set(PROCESSO_DTO_MINIMO as never);
    store.passoAtual.set(store.totalDePassos - 1);
    await flushMicrotasks();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(store.emConsulta()).toBe(true);
    expect(texto).not.toContain('Anexe e confirme o edital');
    expect(texto).not.toContain('Conclua a identificação');
  });

  it('sem a permissão de publicar, não orienta a anexar o edital que a pessoa não vê', async () => {
    cenario.negadas.set(['selecao:processos:publicar']);
    await flushMicrotasks();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Anexe e confirme o edital');
  });

  it('com a permissão de publicar, orienta a anexar o edital', async () => {
    await flushMicrotasks();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Anexe e confirme o edital');
  });

  describe('rotuloDeAvanco()', () => {
    it('diz "Publicar processo"', () => {
      expect(componente.rotuloDeAvanco()).toBe('Publicar processo');
    });
  });

  describe('confirmacaoDeGravacao()', () => {
    it('null enquanto inválido', () => {
      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('resume os dados do ato quando válido', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao).not.toBeNull();
      expect(confirmacao?.itens.some((item) => item.valor.includes('Portaria'))).toBe(true);
    });
  });

  it('nomeia as seções da conferência como regiões pelo título de cada uma', async () => {
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    for (const [id, titulo] of [
      ['revisao-estrutural-titulo', 'Checklist estrutural'],
      ['revisao-legal-titulo', 'Conformidade legal'],
      ['revisao-documento-titulo', 'Documento e ato de publicação'],
    ]) {
      const regiao = raiz.querySelector(`[role="region"][aria-labelledby="${id}"]`);
      expect(regiao, id).not.toBeNull();
      expect(regiao?.querySelector(`#${id}`)?.textContent?.trim()).toBe(titulo);
    }
  });
});
