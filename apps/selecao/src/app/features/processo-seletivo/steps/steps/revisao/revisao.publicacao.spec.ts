import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatusProcesso } from '@uniplus/shared-data/selecao';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoStepComponent } from './revisao.component';
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
  montarOCenario,
  prepararCamposLocais,
  publicacaoDe,
  textoDaTela,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoStepComponent — publicação', () => {
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

  describe('persistir()', () => {
    it('recusa sem processo criado', async () => {
      const resultado = await componente.persistir();
      expect(resultado.valid).toBe(false);
    });

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
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);

      const resultado = await gravacao;
      expect(resultado).toEqual({ valid: true });
      expect(store.remoteSnapshot()?.status).toBe(StatusProcesso.publicado);
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
      expect(store.remoteSnapshot()?.status).toBe(StatusProcesso.publicado);
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
      controller
        .expectOne(ROTA_DETALHE)
        .flush({ ...PROCESSO_DTO_MINIMO, status: StatusProcesso.rascunho });
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
      expect(componente.validate()).toEqual({ valid: true });

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
