import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoPassoComponent } from './revisao.component';
import { usarRevisao } from './revisao-publicacao.testing';
import {
  DOCUMENTO_ID,
  PROCESSO_DTO_MINIMO,
  ROTA_DETALHE,
  ROTA_PUBLICACAO,
  ROTA_SNAPSHOT,
  SNAPSHOT_DTO,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  prepararCamposLocais,
  publicacaoDe,
  textoDaTela,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent — publicação aceita pelo servidor', () => {
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
    it('publica, relê /{id} e /snapshot-vigente, e hidrata o store como publicado', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();

      const requisicaoPublicacao = controller.expectOne(ROTA_PUBLICACAO);
      expect(requisicaoPublicacao.request.method).toBe('POST');
      expect(requisicaoPublicacao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicaoPublicacao.request.body).toMatchObject({
        numero: '001/2027',
        documentoEditalId: DOCUMENTO_ID,
        ato: { orgao: 'Reitoria', tipoAtoCodigo: 'PORTARIA' },
      });
      requisicaoPublicacao.flush(null, { status: 204, statusText: 'No Content' });

      await flushMicrotasks();
      const detalhePublicado = {
        ...PROCESSO_DTO_MINIMO,
        situacao: { ...PROCESSO_DTO_MINIMO.situacao, rotulo: 'Rótulo da API' },
      };
      controller.expectOne(ROTA_DETALHE).flush(detalhePublicado);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);

      const resultado = await gravacao;
      expect(resultado).toEqual({ valid: true });
      expect(store.remoteSnapshot()?.situacao).toEqual(detalhePublicado.situacao);
      fixture.detectChanges();
      expect(textoDaTela(cenario)).toContain('status confirmado em Rótulo da API');
      expect(publicacaoDe(cenario).snapshotConfirmado()?.snapshotPublicacaoId).toBe(
        SNAPSHOT_DTO.snapshotPublicacaoId,
      );
      expect(store.salvando()).toBe(false);
    });

    /**
     * O `POST` já publicou de verdade quando esta releitura roda — se o
     * snapshot falhar por um blip transitório, o processo continua
     * publicado no servidor, e o rascunho não pode seguir parecendo editável.
     */
    it('hidrata o detalhe publicado mesmo quando a releitura do snapshot falha', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });

      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller
        .expectOne(ROTA_SNAPSHOT)
        .flush(
          { type: 'about:blank', title: 'x', status: 503, code: 'erro', traceId: 't' },
          { status: 503, statusText: 'Service Unavailable' },
        );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      // O snapshot não confirmou, mas o detalhe publicado já está no store.
      expect(store.remoteSnapshot()?.situacao).toEqual(PROCESSO_DTO_MINIMO.situacao);
      expect(store.edicaoPermitida()).toBe(false);
      expect(publicacaoDe(cenario).snapshotConfirmado()).toBeNull();
    });

    /**
     * O `POST` já devolveu `204` quando esta releitura roda — mas ela ainda
     * mostra `rascunho`, um status que só é consistente ANTES da publicação.
     * Atraso de propagação (réplica desatualizada) ou falha real de aplicar:
     * as duas exigem manter a tela travada, não tratar o status desatualizado
     * como se fosse a verdade definitiva.
     */
    it('mantém a tela travada quando a releitura pós-204 ainda mostra rascunho', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });

      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush({
        ...PROCESSO_DTO_MINIMO,
        situacao: {
          ...PROCESSO_DTO_MINIMO.situacao,
          codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
        },
      });
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(store.publicacaoNaoConfirmada()).toBe(true);
      expect(store.edicaoPermitida()).toBe(false);
      expect(publicacaoDe(cenario).snapshotConfirmado()).toBeNull();
    });

    /**
     * A fase acrescentada nesta sessão (`acrescentarFase()` do passo
     * Cronograma) nasce com `congelados: null` — só uma releitura do
     * servidor preenche esse campo, e `persistir()` do Cronograma reconcilia
     * só as etapas. Sem o fallback pelo catálogo, o comando mandaria o
     * período preenchido onde o servidor exige `null`, e a publicação mais
     * comum (processo com inscrição própria) recusaria com 422
     * `PeriodoInscricaoNaoInformavel`.
     */
    it('reconhece fase de coleta sem congelados ainda, pelo catálogo (fase recém-acrescentada nesta sessão)', async () => {
      const faseSemCongelados: FaseDoCronograma = {
        faseCanonicaId: 'fase-inscricao-1',
        codigo: 'INSCRICAO',
        ordem: 1,
        inicio: null,
        fim: null,
        unidadeResponsavelId: null,
        produtos: [],
        noMesmoMomentoDaAnterior: false,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
        regraDeHomologacao: null,
        congelados: null,
      };
      cenario.fasePorId.set(
        new Map([
          [
            'fase-inscricao-1',
            {
              id: 'fase-inscricao-1',
              codigo: 'INSCRICAO',
              coletaInscricao: true,
            } as FaseCanonicaDto,
          ],
        ]),
      );

      store.patchObjectSection('cronograma', { fases: [faseSemCongelados] });
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      // A tela não pode cobrar o período: a fase de coleta existe, só ainda
      // não foi relida do servidor.
      expect(componente.validar()).toEqual({ valid: true });

      const gravacao = componente.persistir();
      const requisicao = controller.expectOne(ROTA_PUBLICACAO);
      expect(requisicao.request.body).toMatchObject({
        periodoInscricaoInicio: null,
        periodoInscricaoFim: null,
      });
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await gravacao;
    });

    it('marca salvando() true durante o comando em curso, e false ao concluir', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      expect(store.salvando()).toBe(true);

      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await gravacao;

      expect(store.salvando()).toBe(false);
    });
  });

  it('esquece a publicação confirmada quando o editor passa a outro processo', async () => {
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });
    await flushMicrotasks();
    controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
    controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
    await gravacao;
    fixture.detectChanges();
    expect(textoDaTela(cenario)).toContain('Snapshot da publicação');

    store.geracao.update((geracao) => geracao + 1);
    await flushMicrotasks();
    fixture.detectChanges();

    expect(textoDaTela(cenario)).not.toContain('Snapshot da publicação');
  });
});
