import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoPassoComponent } from './revisao.component';
import { usarRevisao } from './revisao-publicacao.testing';
import {
  PROCESSO_DTO_MINIMO,
  ROTA_DETALHE,
  ROTA_PUBLICACAO,
  ROTA_SNAPSHOT,
  SNAPSHOT_DTO,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  prepararCamposLocais,
  textoDaTela,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent — publicação recusada pelo servidor', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  usarRevisao((montado) => {
    cenario = montado;
    ({ fixture, componente, store, controller } = montado);
  });

  describe('persistir()', () => {
    it('recusa sem processo criado', async () => {
      const resultado = await componente.persistir();
      expect(resultado.valid).toBe(false);
    });

    it('em 422 estrutural, guarda as pendências da extension e não marca como publicado', async () => {
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

      const resultado = await gravacao;
      fixture.detectChanges();
      expect(resultado.valid).toBe(false);
      expect(textoDaTela(cenario)).toContain('falta declarar');
      expect(textoDaTela(cenario)).not.toContain('Nenhuma pendência estrutural.');
      // A conformidade legal não foi avaliada nesta tentativa: vale a leitura anterior, e não "sem reprovação".
      expect(textoDaTela(cenario)).toContain('Nenhuma obrigatoriedade legal reprovada.');
      expect(store.remoteSnapshot()).toBeNull();
    });

    it('em 422 com a escala da nota final pendente, avisa o campo do passo Fórmula', async () => {
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
          pendencias: [
            {
              codigo: 'classificacao_escala_nota_final_nao_declarada',
              dimensao: 'classificacao',
              mensagem: 'A escala da nota final não foi declarada.',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
      await gravacao;
      TestBed.tick();

      expect(store.classificacao.escalaDaNotaFinalPendente()).toBe(true);

      // Fora da Revisão a conferência não vale mais: o campo da Fórmula não pode seguir marcado.
      fixture.destroy();
      expect(store.classificacao.escalaDaNotaFinalPendente()).toBe(false);
    });

    it('em 422 de conformidade legal, guarda as obrigatoriedades reprovadas', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Conformidade legal insuficiente',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.conformidade_legal_insuficiente',
          traceId: 't2',
          obrigatoriedadesReprovadas: [
            { regraCodigo: 'R1', descricaoHumana: 'x', baseLegal: 'Lei x', motivo: 'y' },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );

      const resultado = await gravacao;
      fixture.detectChanges();
      expect(resultado.valid).toBe(false);
      expect(textoDaTela(cenario)).toContain('Lei x');
      expect(textoDaTela(cenario)).not.toContain('Nenhuma obrigatoriedade legal reprovada.');
    });

    it('na recusa por fase sem unidade, lista só as fases sem unidade e leva ao Cronograma na fase escolhida', async () => {
      const fase = (codigo: string, unidadeResponsavelId: string | null): FaseDoCronograma => ({
        faseCanonicaId: `id-${codigo}`,
        codigo,
        ordem: 1,
        inicio: null,
        fim: null,
        unidadeResponsavelId,
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        congelados: null,
      });
      store.patchObjectSection('cronograma', {
        fases: [fase('INSCRICAO', 'unidade-ceps'), fase('MATRICULA', null)],
      });
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'A fase MATRICULA não tem unidade responsável.',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.fase_sem_unidade_responsavel',
          traceId: 't4',
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
      await gravacao;
      fixture.detectChanges();

      const fasesCitadas = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          '#revisao-fase-sem-unidade ~ ul li',
        ),
      );
      expect(fasesCitadas).toHaveLength(1);
      const botao = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '#revisao-fase-sem-unidade ~ ul button',
      );
      expect(botao?.textContent).toContain('Ir para a fase Fase MATRICULA');
      expect(botao?.getAttribute('aria-describedby')).toBe('revisao-fase-sem-unidade');

      botao?.click();

      expect(store.faseEmFoco()).toBe('MATRICULA');
      expect(store.cronogramaVisivel()).toBe(true);

      store.patchObjectSection('cronograma', {
        fases: [fase('INSCRICAO', 'unidade-ceps'), fase('MATRICULA', 'unidade-ceps')],
      });

      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#revisao-fase-sem-unidade')).toBeNull();
    });

    it('em erro nomeado de documento/ato, marca o bloco próprio sem tocar nos dois checklists', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Somente um documento confirmado pode ser referenciado na publicação.',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.documento_nao_confirmado',
          traceId: 't3',
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );

      const resultado = await gravacao;
      fixture.detectChanges();
      expect(resultado.valid).toBe(false);
      expect(textoDaTela(cenario)).toContain('documento confirmado');
      // Nenhum dos dois checklists é tocado: o estrutural segue verde e o legal mantém a leitura anterior.
      expect(textoDaTela(cenario)).toContain('Nenhuma pendência estrutural.');
      expect(textoDaTela(cenario)).toContain('Nenhuma obrigatoriedade legal reprovada.');
    });

    it('a segunda tentativa depois de um 422 usa uma Idempotency-Key diferente (CA-07)', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const primeira = componente.persistir();
      const requisicao1 = controller.expectOne(ROTA_PUBLICACAO);
      const chave1 = requisicao1.request.headers.get('Idempotency-Key');
      requisicao1.flush(
        {
          type: 'about:blank',
          title: 'x',
          status: 422,
          code: 'uniplus.selecao.processo_seletivo.documento_nao_confirmado',
          traceId: 't',
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
      await primeira;

      const segunda = componente.persistir();
      const requisicao2 = controller.expectOne(ROTA_PUBLICACAO);
      const chave2 = requisicao2.request.headers.get('Idempotency-Key');
      requisicao2.flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await segunda;

      expect(chave1).toBeTruthy();
      expect(chave2).toBeTruthy();
      expect(chave2).not.toBe(chave1);
    });
  });
});
