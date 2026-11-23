import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { PASSOS } from '../../processo-seletivo.data';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import { RevisaoPassoComponent } from './revisao.component';
import { usarRevisao } from './revisao-publicacao.testing';
import {
  PROCESSO_DTO_MINIMO,
  PROCESSO_ID,
  ROTA_DETALHE,
  ROTA_PUBLICACAO,
  ROTA_SNAPSHOT,
  SNAPSHOT_DTO,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

const PAGINAS = 'https://erros.exemplo.unifesspa.edu.br/erros/';
const SEM_FIM = 'uniplus.selecao.processo_seletivo.fase_sem_definitivo_sem_data_final';
const PRELIMINAR = 'uniplus.selecao.processo_seletivo.fase_com_preliminar_sem_definitivo';
const GERAL = 'uniplus.selecao.processo_seletivo.cronograma_incompleto';

interface Erro {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
  readonly identificadores?: readonly { lista: string; identificador: string }[];
}

const FIM_DA_FASE: Erro = {
  field: '/cronograma/fases/0/fim',
  code: SEM_FIM,
  message: 'A fase Classificação não publica resultado definitivo e não declara a data final.',
};
const PRODUTOS_DA_FASE: Erro = {
  field: '/cronograma/fases/1/produtos',
  code: PRELIMINAR,
  message: 'A fase Resultado publica o preliminar sem o definitivo.',
};

const CAUSA_GERAL: Erro = { code: GERAL, message: 'O cronograma está incompleto.' };

describe('RevisaoPassoComponent: recusas da publicação', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let recusasDoServidor: RecusasDaPublicacao;

  usarRevisao((montado) => {
    cenario = montado;
    ({ fixture, componente, store, controller } = montado);
    recusasDoServidor = TestBed.inject(RecusasDaPublicacao);
  });

  const bloco = (): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('sel-recusas-da-publicacao');
  const textoDoBloco = (): string => bloco()?.textContent?.replace(/\s+/g, ' ') ?? '';

  async function prepararRevisao(): Promise<void> {
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
  }

  async function publicarERecusar(erros: readonly Erro[]): Promise<void> {
    const gravacao = componente.persistir();
    const problema = {
      type: `${PAGINAS}uniplus.validacao`,
      title: 'A configuração não pode ser publicada',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 't1',
      errors: erros,
    };
    controller.expectOne(ROTA_PUBLICACAO).flush(problema, {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/problem+json' },
    });
    await gravacao;
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();
  }

  async function responderChecklist(status: number): Promise<void> {
    controller
      .match((req) => req.url.includes('/conformidade'))
      .forEach((req) =>
        status === 200
          ? req.flush({ processoSeletivoId: PROCESSO_ID, itens: [], avisos: [], regras: [] })
          : req.flush(null, { status, statusText: 'Erro' }),
      );
    await flushMicrotasks();
  }

  const textosDosItens = (): (string | undefined)[] =>
    Array.from(bloco()?.querySelectorAll('li') ?? []).map((item) =>
      item.textContent?.replace(/\s+/g, ' '),
    );

  async function voltarAoPasso() {
    fixture.destroy();
    const volta = TestBed.createComponent(RevisaoPassoComponent);
    volta.detectChanges();
    await flushMicrotasks();
    const texto = (): string => (volta.nativeElement as HTMLElement).textContent ?? '';
    return { volta, texto };
  }

  async function responderRelidoDoChecklist(): Promise<void> {
    controller
      .expectOne((req) => req.url.endsWith('/conformidade'))
      .flush({ processoSeletivoId: PROCESSO_DTO_MINIMO.id, itens: [], avisos: [] });
    controller
      .match((req) => req.url.includes('/conformidade-legal'))
      .forEach((req) => req.flush({ regras: [], avisos: [], dataReferencia: '2027-01-01' }));
    await flushMicrotasks();
  }

  async function publicarSemResposta(): Promise<void> {
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).error(new ProgressEvent('error'));
    await gravacao;
    fixture.detectChanges();
  }

  async function publicarComSucesso(): Promise<void> {
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });
    await flushMicrotasks();
    controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
    controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
    await gravacao;
    fixture.detectChanges();
  }

  it('mostra a recusa do Fim com a mensagem, o código e a página, sem "Ir ao campo"', async () => {
    await prepararRevisao();

    await publicarERecusar([FIM_DA_FASE]);

    expect(textoDoBloco()).toContain('Onde corrigir');
    expect(textoDoBloco()).toContain(FIM_DA_FASE.message);
    expect(textoDoBloco()).toContain(SEM_FIM);
    expect(bloco()?.querySelector(`a[href="${PAGINAS}${SEM_FIM}"]`)).not.toBeNull();
    expect(bloco()?.querySelector('button')).toBeNull();
  });

  it('avisa que a recusa não aponta campo e que veio da última resposta que recusou', async () => {
    await prepararRevisao();

    await publicarERecusar([FIM_DA_FASE]);

    expect(textoDoBloco()).toContain('Apontada na última resposta que recusou a publicação.');
    expect(textoDoBloco()).toContain('Sem campo nesta tela.');
  });

  it('lista todas as causas na ordem da API, inclusive a geral, que não leva a nota de campo', async () => {
    await prepararRevisao();

    await publicarERecusar([PRODUTOS_DA_FASE, CAUSA_GERAL, FIM_DA_FASE]);

    const itens = textosDosItens();
    expect(itens).toHaveLength(3);
    expect(itens[0]).toContain(PRODUTOS_DA_FASE.message);
    expect(itens[1]).toContain('O cronograma está incompleto.');
    expect(itens[1]).not.toContain('Sem campo nesta tela.');
    expect(itens[2]).toContain(FIM_DA_FASE.message);
  });

  it('não mostra o bloco enquanto não houve recusa com causas', async () => {
    await prepararRevisao();

    expect(bloco()).toBeNull();
  });

  it('avisa que o rascunho mudou e que é preciso publicar de novo, mantendo as recusas', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);
    expect(textoDoBloco()).not.toContain('O rascunho foi alterado');

    store.patchObjectSection('cronograma', { fases: [umaFaseDoCronograma()] });
    fixture.detectChanges();

    expect(textoDoBloco()).toContain('O rascunho foi alterado depois dessa resposta do servidor');
    expect(textoDoBloco()).toContain('É preciso publicar de novo');
    expect(textoDoBloco()).toContain(FIM_DA_FASE.message);
    expect(bloco()?.querySelector('button')).toBeNull();
  });

  it('avisa que o rascunho mudou também quando a alteração é fora do cronograma', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    store.patchObjectSection('identificacao', { nome: 'Nome corrigido' });
    fixture.detectChanges();

    expect(textoDoBloco()).toContain('O rascunho foi alterado depois dessa resposta do servidor');
  });

  it('mostra as recusas enquanto o checklist recarrega', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    void componente.recarregarChecklist();
    fixture.detectChanges();

    expect(textoDoBloco()).toContain(FIM_DA_FASE.message);
    await responderChecklist(200);
  });

  it('mostra as recusas quando o checklist falha ao ser relido', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    void componente.recarregarChecklist();
    await responderChecklist(503);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar o checklist');
    expect(textoDoBloco()).toContain(FIM_DA_FASE.message);
  });

  it('mostra as recusas ao voltar ao passo, com o checklist carregando e depois com falha', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    const { volta, texto } = await voltarAoPasso();
    expect(texto()).toContain(FIM_DA_FASE.message);

    await responderChecklist(503);
    volta.detectChanges();
    expect(texto()).toContain('Não foi possível carregar o checklist');
    expect(texto()).toContain(FIM_DA_FASE.message);
  });

  it('troca todas as recusas pelas da resposta recusada seguinte', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE, PRODUTOS_DA_FASE]);

    await publicarERecusar([PRODUTOS_DA_FASE]);

    expect(recusasDoServidor.recusas().map((recusa) => recusa.codigo)).toEqual([PRELIMINAR]);
    expect(recusasDoServidor.recusas()[0].resposta).toBe(2);
    expect(textoDoBloco()).not.toContain(FIM_DA_FASE.message);
  });

  it('esvazia as recusas quando a publicação é aceita', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    await publicarComSucesso();

    expect(recusasDoServidor.recusas()).toEqual([]);
    expect(bloco()).toBeNull();
  });

  it('mantém as recusas quando a tentativa fica sem resposta', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    await publicarSemResposta();

    expect(store.publicacaoNaoConfirmada()).toBe(true);
    expect(recusasDoServidor.recusas().map((recusa) => recusa.codigo)).toEqual([SEM_FIM]);
    expect(textoDoBloco()).toContain(FIM_DA_FASE.message);
    expect(textoDoBloco()).toContain('da última resposta do servidor que recusou a publicação');
    expect(textoDoBloco()).not.toContain('última tentativa');
  });

  it('mantém as recusas quando o checklist é relido', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    void componente.recarregarChecklist();
    await responderRelidoDoChecklist();

    expect(recusasDoServidor.recusas()).toHaveLength(1);
  });

  it('sobrevive à saída do passo, porque pertence à página', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    fixture.destroy();

    expect(TestBed.inject(RecusasDaPublicacao).recusas()).toHaveLength(1);
  });

  it('esvazia as recusas quando muda o processo', async () => {
    await prepararRevisao();
    await publicarERecusar([FIM_DA_FASE]);

    store.geracao.update((geracao) => geracao + 1);
    TestBed.tick();

    expect(recusasDoServidor.recusas()).toEqual([]);
  });

  describe('"Ir ao campo"', () => {
    const FIM_IDENTIFICADO: Erro = {
      ...FIM_DA_FASE,
      field: 'fases[0].fim',
      identificadores: [{ lista: 'fases', identificador: 'CLASSIFICACAO' }],
    };
    const botao = (): HTMLButtonElement | null =>
      bloco()?.querySelector<HTMLButtonElement>('button') ?? null;

    it('leva uma recusa da prova presencial ao passo correspondente', async () => {
      await prepararRevisao();
      await publicarERecusar([
        { code: 'ProvaPresencial.PorDeclarar', message: 'Declare a prova.' },
      ]);

      botao()?.click();

      expect(store.passoAtual()).toBe(
        PASSOS.findIndex((passo) => passo.rotulo === 'Prova presencial'),
      );
      expect(recusasDoServidor.destino()?.codigo).toBe('ProvaPresencial.PorDeclarar');
    });

    it('oferece o botão à recusa que aponta uma fase que está no cronograma', async () => {
      await prepararRevisao();
      store.patchObjectSection('cronograma', {
        fases: [umaFaseDoCronograma({ codigo: 'CLASSIFICACAO' })],
      });

      await publicarERecusar([FIM_IDENTIFICADO]);

      expect(botao()?.textContent).toContain('Ir ao campo');
      expect(textoDoBloco()).not.toContain('Sem campo nesta tela.');
    });

    it('leva ao passo Cronograma e deixa o destino para o passo abrir o campo', async () => {
      await prepararRevisao();
      store.patchObjectSection('cronograma', {
        fases: [umaFaseDoCronograma({ codigo: 'CLASSIFICACAO' })],
      });
      await publicarERecusar([FIM_IDENTIFICADO]);

      botao()?.click();

      expect(store.passoAtual()).toBe(PASSOS.findIndex((passo) => passo.rotulo === 'Cronograma'));
      expect(recusasDoServidor.destino()?.codigo).toBe(SEM_FIM);
    });

    it('não oferece o botão quando a fase que a recusa aponta não está mais no cronograma', async () => {
      await prepararRevisao();
      store.patchObjectSection('cronograma', {
        fases: [umaFaseDoCronograma({ codigo: 'OUTRA_FASE' })],
      });

      await publicarERecusar([FIM_IDENTIFICADO]);

      expect(botao()).toBeNull();
      expect(textoDoBloco()).toContain('Sem campo nesta tela.');
    });
  });
});
