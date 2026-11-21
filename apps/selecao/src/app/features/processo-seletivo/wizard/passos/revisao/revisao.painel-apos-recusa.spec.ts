import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import { RevisaoPassoComponent } from './revisao.component';
import { usarRevisao } from './revisao-publicacao.testing';
import {
  CONFORMIDADE_LEGAL_VERDE,
  PROCESSO_ID,
  ROTA_CONFORMIDADE,
  ROTA_PUBLICACAO,
  criarProcesso,
  flushMicrotasks,
  flushProntidao,
  flushProntidaoVerde,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

const PAGINAS = 'https://erros.exemplo.unifesspa.edu.br/erros/';
const SEM_FIM = 'uniplus.selecao.processo_seletivo.fase_sem_definitivo_sem_data_final';
const DOCUMENTO_NAO_CONFIRMADO = 'uniplus.selecao.processo_seletivo.documento_nao_confirmado';

const CAUSA_DO_FIM = {
  field: '/cronograma/fases/0/fim',
  code: SEM_FIM,
  message: 'A fase Classificação não publica resultado definitivo e não declara a data final.',
};

/** O mesmo problema, no vocabulário do checklist: o código do item não é o código da causa. */
const ITEM_DO_FIM = {
  codigo: 'cronograma_fase_sem_definitivo_sem_data_final',
  dimensao: 'cronograma',
  mensagem: 'Há fase sem resultado definitivo e sem data final.',
  ok: false,
};

const COM_O_ITEM_DO_FIM = {
  processoSeletivoId: PROCESSO_ID,
  avisos: [],
  itens: [ITEM_DO_FIM],
};

const RECUSA_422 = {
  status: 422,
  statusText: 'Unprocessable Entity',
  headers: { 'Content-Type': 'application/problem+json' },
};

describe('RevisaoPassoComponent: checklist depois da publicação recusada', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  usarRevisao((montado) => {
    cenario = montado;
    ({ fixture, componente, store, controller } = montado);
  });

  const regiao = (seletor: string): string =>
    (fixture.nativeElement as HTMLElement)
      .querySelector(seletor)
      ?.textContent?.replace(/\s+/g, ' ') ?? '';

  async function prepararRevisao(): Promise<void> {
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
  }

  function recusarComCausas(code: string, errors: readonly object[]): Promise<unknown> {
    const gravacao = componente.persistir();
    const problema = {
      type: `${PAGINAS}${code}`,
      title: 'Recusada',
      status: 422,
      code,
      traceId: 't1',
      errors,
    };
    controller.expectOne(ROTA_PUBLICACAO).flush(problema, RECUSA_422);
    return gravacao;
  }

  it('relê o checklist depois da recusa e mostra o que o servidor devolve, mantendo "Onde corrigir"', async () => {
    await prepararRevisao();

    await recusarComCausas('uniplus.validacao', [CAUSA_DO_FIM]);
    await flushProntidao(cenario, COM_O_ITEM_DO_FIM, CONFORMIDADE_LEGAL_VERDE);
    fixture.detectChanges();

    expect(regiao('sel-conformidade-estrutural')).toContain(ITEM_DO_FIM.mensagem);
    expect(regiao('sel-recusas-da-publicacao')).toContain(CAUSA_DO_FIM.message);
    expect(TestBed.inject(RecusasDaPublicacao).recusas()).toHaveLength(1);
  });

  it('não liga o item do checklist à causa: cada lista diz o seu, e nenhuma muda a outra', async () => {
    await prepararRevisao();

    await recusarComCausas('uniplus.validacao', [CAUSA_DO_FIM]);
    await flushProntidao(cenario, COM_O_ITEM_DO_FIM, CONFORMIDADE_LEGAL_VERDE);
    fixture.detectChanges();

    expect(regiao('sel-conformidade-estrutural')).not.toContain(SEM_FIM);
    expect(regiao('sel-conformidade-estrutural')).not.toContain(CAUSA_DO_FIM.message);
    expect(regiao('sel-recusas-da-publicacao')).not.toContain(ITEM_DO_FIM.mensagem);
    expect(regiao('sel-recusas-da-publicacao')).not.toContain(ITEM_DO_FIM.codigo);
  });

  it('não tira do checklist o que a causa não diz: causa sem item correspondente deixa o checklist conforme', async () => {
    await prepararRevisao();

    await recusarComCausas('uniplus.validacao', [CAUSA_DO_FIM]);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    expect(regiao('sel-conformidade-estrutural')).toContain('Nenhuma pendência estrutural.');
    expect(regiao('sel-recusas-da-publicacao')).toContain(CAUSA_DO_FIM.message);
  });

  it('mantém "Onde corrigir" quando a releitura do checklist falha', async () => {
    await prepararRevisao();

    await recusarComCausas('uniplus.validacao', [CAUSA_DO_FIM]);
    controller
      .match((req) => req.url.includes('/conformidade'))
      .forEach((req) => req.flush(null, { status: 503, statusText: 'Erro' }));
    await flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar o checklist');
    expect(regiao('sel-recusas-da-publicacao')).toContain(CAUSA_DO_FIM.message);
  });

  it('não relê o checklist quando a tentativa fica sem resposta, e a tela segue travada', async () => {
    await prepararRevisao();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).error(new ProgressEvent('error'));
    await gravacao;
    await flushMicrotasks();

    controller.expectNone(ROTA_CONFORMIDADE);
    expect(store.publicacaoNaoConfirmada()).toBe(true);
  });

  it('diz o erro de documento uma só vez quando a resposta o traz em "Onde corrigir"', async () => {
    await prepararRevisao();
    const mensagem = 'Somente um documento confirmado pode ser referenciado na publicação.';

    await recusarComCausas(DOCUMENTO_NAO_CONFIRMADO, [
      { code: DOCUMENTO_NAO_CONFIRMADO, message: mensagem },
    ]);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    expect(regiao('sel-recusas-da-publicacao')).toContain(mensagem);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('sel-ato-da-publicacao .alert--danger'),
    ).toBeNull();
  });

  it('diz que o checklist resume a conferência e que os itens não correspondem às causas', async () => {
    await prepararRevisao();

    await recusarComCausas('uniplus.validacao', [CAUSA_DO_FIM]);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    const texto = regiao('sel-recusas-da-publicacao');
    expect(texto).toContain('não correspondem um a um às causas desta lista');
  });
});
