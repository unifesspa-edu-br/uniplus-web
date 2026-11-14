import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoPassoComponent } from './revisao.component';
import {
  ROTA_PUBLICACAO,
  criarProcesso,
  flushProntidaoVerde,
  montarOCenario,
  prepararCamposLocais,
  textoDaTela,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent — publicação recusada com 409', () => {
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

  /** Publica com o rascunho preenchido e responde 409 com o código e o título dados. */
  async function publicarERecusarComConflito(code: string, titulo: string) {
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
    const antes = store.draft().publicacao;
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).flush(
      { type: 'about:blank', title: titulo, status: 409, code, traceId: 't4' },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    const resultado = await gravacao;
    fixture.detectChanges();
    return { resultado, antes };
  }

  it.each([
    ['uniplus.publicacoes.ato_normativo.objeto_ja_tem_ato_vivo_do_tipo', 'O objeto já tem ato vivo do tipo'],
    ['uniplus.publicacoes.ato_normativo.raiz_ja_retificada', 'O ato já foi retificado'],
  ])('em 409 %s, mostra a mensagem da API no bloco do ato e mantém o rascunho', async (code, titulo) => {
    const { resultado, antes } = await publicarERecusarComConflito(code, titulo);

    expect(resultado).toEqual({ valid: false, messages: [titulo] });
    expect(textoDaTela(cenario)).toContain(titulo);
    expect(store.draft().publicacao).toEqual(antes);
  });

  it('em 409 de identificador legível em uso, devolve a mensagem da API e mantém o rascunho', async () => {
    const titulo = 'O identificador legível já é usado por outro processo seletivo';
    const { resultado, antes } = await publicarERecusarComConflito(
      'uniplus.selecao.processo_seletivo.identificador_legivel_em_uso',
      titulo,
    );

    expect(resultado).toEqual({ valid: false, messages: [titulo] });
    expect(store.draft().publicacao).toEqual(antes);
  });
});
