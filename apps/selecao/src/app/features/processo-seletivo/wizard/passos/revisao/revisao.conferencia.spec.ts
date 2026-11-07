import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoPassoComponent } from './revisao.component';
import {
  CONFORMIDADE_LEGAL_VERDE,
  CONFORMIDADE_VERDE,
  PROCESSO_ID,
  ROTA_CONFORMIDADE,
  ROTA_CONFORMIDADE_LEGAL,
  atoCompleto,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  montarOCenario,
  prepararCamposLocais,
  CenarioDaRevisao,
  clicarEm,
  textoDaTela,
  ROTA_PUBLICACAO,
} from './revisao.testing';

describe('RevisaoPassoComponent — conferência', () => {
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

  describe('validar()', () => {
    it('recusa sem processo criado', () => {
      expect(componente.validar().valid).toBe(false);
    });

    it('recusa enquanto a prontidão ainda carrega', async () => {
      await criarProcesso(cenario);
      expect(componente.validar().valid).toBe(false);

      controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
    });

    it('a varredura de gravação relê o checklist mesmo com uma leitura em voo e valida com a leitura nova', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      store.patchObjectSection('publicacao', { ato: atoCompleto() });

      let terminou = false;
      const varredura = componente.recarregarChecklist().then(() => (terminou = true));
      await flushMicrotasks();
      expect(terminou).toBe(false);
      controller.match(ROTA_CONFORMIDADE).forEach((r) => r.flush(CONFORMIDADE_VERDE));
      controller
        .match((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .forEach((r) => r.flush(CONFORMIDADE_LEGAL_VERDE));
      await varredura;
      await flushMicrotasks();

      const mensagens = componente.validar().messages ?? [];
      expect(mensagens.some((m) => m.includes('Aguarde o carregamento'))).toBe(false);
    });

    it('o duplo clique em "Atualizar checklist" pede uma só leitura', async () => {
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
      fixture.detectChanges();

      clicarEm(cenario, 'Atualizar checklist');
      fixture.detectChanges();
      clicarEm(cenario, 'Atualizando…');

      expect(controller.match(ROTA_CONFORMIDADE)).toHaveLength(1);
      controller.match((req) => req.url === ROTA_CONFORMIDADE_LEGAL);
    });

    it('recusa com checklist estrutural pendente', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);

      controller.expectOne(ROTA_CONFORMIDADE).flush({
        processoSeletivoId: PROCESSO_ID,
        avisos: [],
        itens: [{ codigo: 'x', dimensao: 'taxa_inscricao', mensagem: 'falta declarar', ok: false }],
      });
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(CONFORMIDADE_LEGAL_VERDE);
      await flushMicrotasks();

      const resultado = componente.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.some((m) => m.includes('estruturais'))).toBe(true);
    });

    it('recusa sem documento confirmado escolhido', async () => {
      await criarProcesso(cenario);
      store.patchObjectSection('publicacao', { ato: atoCompleto() });
      await flushProntidaoVerde(cenario);

      const resultado = componente.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.some((m) => m.includes('documento'))).toBe(true);
    });

    it('válido com prontidão verde, documento confirmado e ato completo', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      expect(componente.validar()).toEqual({ valid: true });
    });

    /**
     * O checklist legal foi avaliado para a data de referência de QUANDO ele
     * carregou — se o operador muda o período depois, sem recarregar,
     * `validar()` não pode aprovar um checklist que já não corresponde ao
     * que vai ser publicado.
     */
    it('recusa quando a data de referência mudou depois do último carregamento do checklist legal', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
      expect(componente.validar()).toEqual({ valid: true });

      // Sem fase de coleta nestes testes — a data de referência vem do campo.
      // Mudar o início do período invalida o checklist legal já carregado.
      store.patchObjectSection('publicacao', { periodoInscricaoInicio: '2027-06-15T09:00' });

      const resultado = componente.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.some((m) => m.includes('Atualizar checklist'))).toBe(true);
    });
  });

  describe('#742 — conformidade legal não avaliável', () => {
    const PROBLEM_SEM_FASE_DE_COLETA = {
      type: 'about:blank',
      title: 'Período de inscrição obrigatório',
      status: 422,
      detail:
        'O processo não tem fase do cronograma que colete inscrição, então o período de inscrição precisa ser informado na publicação.',
      code: 'uniplus.selecao.processo_seletivo.periodo_inscricao_obrigatorio_sem_fase_de_coleta',
      traceId: 't',
    };

    async function flushProntidaoComPendenciaLegal(): Promise<void> {
      controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
      controller
        .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
        .flush(PROBLEM_SEM_FASE_DE_COLETA, {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        });
      await flushMicrotasks();
    }

    /**
     * O defeito coberto: o 422 acendia o alerta de erro, e a seção
     * "Documento e ato de publicação" — que mora dentro do `@else` desse erro —
     * não renderizava. O campo onde o período seria informado ficava escondido
     * atrás da recusa que só o período resolveria, e o certame de origem
     * importada não tinha como ser publicado.
     */
    it('mantém em tela o campo de período, que é o que destrava a avaliação', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoComPendenciaLegal();
      fixture.detectChanges();

      const html: HTMLElement = fixture.nativeElement;
      expect(html.querySelector('#rev-periodo-inicio')).not.toBeNull();
      expect(html.querySelector('#rev-periodo-fim')).not.toBeNull();
      expect(html.querySelector('#rev-tipo-ato')).not.toBeNull();
      expect(html.querySelector('.alert--danger')).toBeNull();
    });

    it('anuncia o motivo do servidor, sem oferecer "Tentar novamente"', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoComPendenciaLegal();
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('período de inscrição precisa ser informado');
      expect(texto).not.toContain('Tentar novamente');
    });

    it('recusa a publicação com o motivo, e não com "obrigatoriedades reprovadas"', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoComPendenciaLegal();

      const resultado = componente.validar();
      expect(resultado.valid).toBe(false);
      expect(
        resultado.messages?.some((m) => m.includes('período de inscrição precisa ser informado')),
      ).toBe(true);
      expect(
        resultado.messages?.some((m) => m.includes('obrigatoriedades legais reprovadas')),
      ).toBe(false);
    });
  });

  it('esquece a recusa da publicação quando o editor passa a outro processo', async () => {
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).flush(
      {
        type: 'about:blank',
        title: 'O processo tem pendências estruturais',
        status: 422,
        code: 'uniplus.selecao.processo_seletivo.conformidade_insuficiente',
        traceId: 't1',
        pendencias: [{ codigo: 'x', dimensao: 'taxa_inscricao', mensagem: 'falta declarar' }],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await gravacao;
    fixture.detectChanges();
    expect(textoDaTela(cenario)).toContain('falta declarar');

    store.geracao.update((geracao) => geracao + 1);
    await flushMicrotasks();
    fixture.detectChanges();

    expect(textoDaTela(cenario)).not.toContain('falta declarar');
  });
});
