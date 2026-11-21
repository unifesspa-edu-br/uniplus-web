import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
import { RevisaoPassoComponent } from './revisao.component';
import { usarRevisao } from './revisao-publicacao.testing';
import {
  CONFORMIDADE_LEGAL_VERDE,
  CONFORMIDADE_VERDE,
  ROTA_CONFORMIDADE,
  ROTA_CONFORMIDADE_LEGAL,
  ROTA_PUBLICACAO,
  clicarEm,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

const FASE_SEM_UNIDADE = 'uniplus.selecao.processo_seletivo.fase_sem_unidade_responsavel';
const MENSAGEM_DA_CAUSA = 'A fase MATRICULA não tem unidade responsável.';

const CAUSA_DA_FASE = {
  field: '/cronograma/fases/1/unidadeResponsavelId',
  code: FASE_SEM_UNIDADE,
  message: MENSAGEM_DA_CAUSA,
};

const RECUSA_422 = {
  status: 422,
  statusText: 'Unprocessable Entity',
  headers: { 'Content-Type': 'application/problem+json' },
};

describe('RevisaoPassoComponent: o que a recusa da publicação mantém quando o checklist é relido', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  usarRevisao((montado) => {
    cenario = montado;
    ({ fixture, componente, store, controller } = montado);
  });

  const tela = (seletor: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor);
  const fasesCitadas = (): string[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#revisao-fase-sem-unidade ~ ul li'),
    ).map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  const ondeCorrigir = (): string =>
    tela('sel-recusas-da-publicacao')?.textContent?.replace(/\s+/g, ' ') ?? '';

  async function recusarPorFaseSemUnidade(): Promise<void> {
    store.patchObjectSection('cronograma', {
      fases: [
        umaFaseDoCronograma({ codigo: 'INSCRICAO', unidadeResponsavelId: 'unidade-ceps' }),
        umaFaseDoCronograma({ codigo: 'MATRICULA', unidadeResponsavelId: null }),
      ],
    });
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).flush(
      {
        type: 'about:blank',
        title: MENSAGEM_DA_CAUSA,
        status: 422,
        code: FASE_SEM_UNIDADE,
        traceId: 't1',
        errors: [CAUSA_DA_FASE],
      },
      RECUSA_422,
    );
    await gravacao;
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();
  }

  function esperarAsDuasListasDaRecusa(): void {
    expect(fasesCitadas()).toHaveLength(1);
    expect(tela('#revisao-fase-sem-unidade ~ ul button')?.textContent).toContain(
      'Ir para a fase Fase MATRICULA',
    );
    expect(ondeCorrigir()).toContain(MENSAGEM_DA_CAUSA);
  }

  it('mantém "Ir para a fase" e "Onde corrigir" depois de "Atualizar checklist"', async () => {
    await recusarPorFaseSemUnidade();
    esperarAsDuasListasDaRecusa();

    clicarEm(cenario, 'Atualizar checklist');
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    esperarAsDuasListasDaRecusa();
  });

  it('mantém as duas listas enquanto o checklist recarrega, e não só depois', async () => {
    await recusarPorFaseSemUnidade();

    clicarEm(cenario, 'Atualizar checklist');
    fixture.detectChanges();

    esperarAsDuasListasDaRecusa();
    await flushProntidaoVerde(cenario);
  });

  it('mantém as duas listas quando a página relê o checklist depois de gravar um passo corrigido', async () => {
    await recusarPorFaseSemUnidade();

    const releitura = componente.recarregarChecklist();
    await flushProntidaoVerde(cenario);
    await releitura;
    fixture.detectChanges();

    esperarAsDuasListasDaRecusa();
  });

  it('mantém as duas listas quando a leitura falha e o operador tenta de novo', async () => {
    await recusarPorFaseSemUnidade();

    clicarEm(cenario, 'Atualizar checklist');
    controller
      .expectOne(ROTA_CONFORMIDADE)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    controller
      .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
      .flush(CONFORMIDADE_LEGAL_VERDE);
    await flushMicrotasks();
    fixture.detectChanges();
    clicarEm(cenario, 'Tentar novamente');
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    esperarAsDuasListasDaRecusa();
  });

  it('mantém as duas listas depois de uma tentativa sem resposta, que não conclui nada', async () => {
    await recusarPorFaseSemUnidade();

    const segunda = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).error(new ProgressEvent('error'));
    await segunda;
    await flushMicrotasks();
    fixture.detectChanges();

    controller.expectNone(ROTA_CONFORMIDADE);
    // Resultado incerto trava a edição, então o atalho para a fase some; a lista continua.
    expect(store.publicacaoNaoConfirmada()).toBe(true);
    expect(fasesCitadas()).toHaveLength(1);
    expect(ondeCorrigir()).toContain(MENSAGEM_DA_CAUSA);
  });

  it('mantém as duas listas enquanto a nova tentativa espera a resposta', async () => {
    await recusarPorFaseSemUnidade();

    const segunda = componente.persistir();
    fixture.detectChanges();

    esperarAsDuasListasDaRecusa();
    controller.expectOne(ROTA_PUBLICACAO).error(new ProgressEvent('error'));
    await segunda;
  });

  it('tira a lista de fases quando a unidade que faltava é preenchida, mesmo sem reler o checklist', async () => {
    await recusarPorFaseSemUnidade();

    store.patchObjectSection('cronograma', {
      fases: [
        umaFaseDoCronograma({ codigo: 'INSCRICAO', unidadeResponsavelId: 'unidade-ceps' }),
        umaFaseDoCronograma({ codigo: 'MATRICULA', unidadeResponsavelId: 'unidade-ceps' }),
      ],
    });
    fixture.detectChanges();

    expect(tela('#revisao-fase-sem-unidade')).toBeNull();
  });
});

describe('RevisaoPassoComponent: o checklist enquanto é relido', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;

  usarRevisao((montado) => {
    cenario = montado;
    ({ fixture } = montado);
  });

  const texto = (seletor: string): string =>
    ((fixture.nativeElement as HTMLElement).querySelector(seletor)?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  const atualizando = (seletor: string): HTMLElement | null =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        `${seletor} [role="status"]`,
      ),
    ).find((aviso) => aviso.textContent?.includes('Atualizando o checklist…')) ?? null;

  it('não diz "nenhuma pendência" nem "nenhuma obrigatoriedade reprovada" enquanto relê, e diz que atualiza', async () => {
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();
    expect(texto('sel-conformidade-estrutural')).toContain('Nenhuma pendência estrutural.');
    expect(texto('sel-conformidade-legal')).toContain('Nenhuma obrigatoriedade legal reprovada.');

    clicarEm(cenario, 'Atualizar checklist');
    fixture.detectChanges();

    expect(texto('sel-conformidade-estrutural')).not.toContain('Nenhuma pendência estrutural.');
    expect(texto('sel-conformidade-legal')).not.toContain('Nenhuma obrigatoriedade legal');
    expect(atualizando('sel-conformidade-estrutural')).not.toBeNull();
    expect(atualizando('sel-conformidade-legal')).not.toBeNull();
    await flushProntidaoVerde(cenario);
  });

  it('volta a dizer que não há pendência quando a leitura nova termina', async () => {
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();
    clicarEm(cenario, 'Atualizar checklist');
    fixture.detectChanges();

    await flushProntidaoVerde(cenario);
    fixture.detectChanges();

    expect(texto('sel-conformidade-estrutural')).toContain('Nenhuma pendência estrutural.');
    expect(texto('sel-conformidade-legal')).toContain('Nenhuma obrigatoriedade legal reprovada.');
    expect(atualizando('sel-conformidade-estrutural')).toBeNull();
    expect(atualizando('sel-conformidade-legal')).toBeNull();
  });

  it('mostra a pendência que a leitura nova trouxe, e não o "nenhuma" da anterior', async () => {
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();
    clicarEm(cenario, 'Atualizar checklist');
    fixture.detectChanges();

    const pendente = {
      ...CONFORMIDADE_VERDE,
      itens: [{ codigo: 'x', dimensao: 'taxa_inscricao', mensagem: 'falta declarar', ok: false }],
    };
    cenario.controller.expectOne(ROTA_CONFORMIDADE).flush(pendente);
    cenario.controller
      .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
      .flush(CONFORMIDADE_LEGAL_VERDE);
    await flushMicrotasks();
    fixture.detectChanges();

    expect(texto('sel-conformidade-estrutural')).toContain('falta declarar');
    expect(texto('sel-conformidade-estrutural')).not.toContain('Nenhuma pendência estrutural.');
  });
});
