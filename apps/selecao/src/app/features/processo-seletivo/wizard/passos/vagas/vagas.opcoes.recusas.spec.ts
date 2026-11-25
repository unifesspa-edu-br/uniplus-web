import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ProcessoSeletivoDto,
  SituacaoDoProcessoSeletivoCodigo,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  ROTA_OPCOES,
  ROTA_PROCESSO_RELIDO,
  SEM_CORPO,
  proximoTick,
  recusa422,
  montarPassoDeOpcoes,
} from './vagas.opcoes.testing';
import { VagasPassoComponent } from './vagas.component';
import { OFERTA, OUTRA_OFERTA, ROTA_DISTRIBUICAO, comReleitura } from './vagas.testing';

describe('VagasPassoComponent — recusas e consulta do número de opções de curso', () => {
  const TEXTO = 'Com 2 opções de curso, cadastre pelo menos dois cursos.';

  let componente: VagasPassoComponent;
  let fixture: ComponentFixture<VagasPassoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let tela: HTMLElement;
  let campo: () => HTMLSelectElement;
  let escolherNumero: (numero: string) => void;
  let ofertas: (...ids: string[]) => void;
  let gravado: (numero: number) => void;
  let encerrar: () => void;

  beforeEach(async () => {
    ({
      componente,
      fixture,
      store,
      controller,
      tela,
      campo,
      escolherNumero,
      ofertas,
      gravado,
      encerrar,
    } = await montarPassoDeOpcoes());
  });

  afterEach(() => encerrar());

  it('mostra no campo, com o mesmo texto, a recusa da API ao gravar o número', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    const { body, opts } = recusa422(
      'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas',
    );
    controller.expectOne(ROTA_OPCOES).flush(body, opts);

    const resultado = await gravacao;
    fixture.detectChanges();

    expect(resultado).toEqual({
      valid: false,
      messages: [`A distribuição de vagas foi gravada. ${TEXTO}`],
    });
    expect(tela.querySelector('#f-opcoes-curso-erro')?.textContent).toContain(TEXTO);
  });

  it('mostra no mesmo campo a recusa da API sem campo, vinda da gravação da distribuição', async () => {
    gravado(2);
    ofertas(OFERTA);
    escolherNumero('1');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    const { body, opts } = recusa422(
      'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas',
    );
    controller.expectOne(ROTA_DISTRIBUICAO).flush(body, opts);

    const resultado = await gravacao;
    fixture.detectChanges();

    expect(resultado.messages).toEqual([`O número de opções de curso foi gravado. ${TEXTO}`]);
    expect(tela.querySelector('#f-opcoes-curso-erro')?.textContent).toContain(TEXTO);
  });

  it('guarda o número gravado e relê o processo quando a releitura depois da gravação falha', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_PROCESSO_RELIDO).flush(null, { status: 500, statusText: 'Erro' });
    await gravacao;

    expect(store.opcoesDeCursoGravadas()).toBe(2);
    expect(store.vagasGravadasDefasadas()).toBe(true);

    // Com o número 2 gravado, reduzir para 1 curso e 1 opção só passa baixando o número antes.
    ofertas(OFERTA);
    escolherNumero('1');
    const segunda = componente.persistir();
    controller.expectOne(ROTA_PROCESSO_RELIDO).flush({ opcoesDeCurso: { numero: 2 } });
    await proximoTick();
    controller.expectNone(ROTA_DISTRIBUICAO);
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await expect(comReleitura(controller, segunda)).resolves.toEqual({ valid: true });
  });

  it('trata o conflito de idempotência em andamento como resposta inconclusiva', async () => {
    gravado(1);
    ofertas(OFERTA);
    escolherNumero('1');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(
      {
        type: 'about:blank',
        title: 'Em andamento.',
        status: 409,
        code: 'uniplus.idempotency.processing_conflict',
        traceId: 'trace-1',
      },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await gravacao;

    expect(store.vagasGravadasDefasadas()).toBe(true);
  });

  it('descarta o erro do campo ao trocar de processo na mesma rota', async () => {
    ofertas(OFERTA);
    escolherNumero('2');
    await componente.persistir();
    fixture.detectChanges();
    expect(tela.querySelector('#f-opcoes-curso-erro')).not.toBeNull();

    store.geracao.update((valor) => valor + 1);
    TestBed.tick();
    fixture.detectChanges();

    expect(tela.querySelector('#f-opcoes-curso-erro')).toBeNull();
  });

  it('em consulta, lê o número gravado como texto', () => {
    store.patchObjectSection('opcoesDeCurso', { numero: '2' });
    store.remoteSnapshot.set({
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      },
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(campo()).toBeNull();
    expect((tela.textContent ?? '').replace(/\s+/g, ' ')).toContain(
      'Número de opções de curso 2 opções',
    );
  });
});
