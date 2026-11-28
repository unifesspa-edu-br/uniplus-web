import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import { RevisaoPassoComponent } from './revisao.component';
import { usarRevisao } from './revisao-publicacao.testing';
import {
  ROTA_PUBLICACAO,
  criarProcesso,
  flushProntidaoVerde,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

interface Erro {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

const DOCUMENTO_DO_EDITAL: Erro = {
  field: 'documentoEditalId',
  code: 'uniplus.selecao.processo_seletivo.documento_nao_confirmado',
  message: 'Somente um documento confirmado pode ser referenciado na publicação.',
};
const TIPO_DO_ATO: Erro = {
  field: 'ato.tipoAtoCodigo',
  code: 'uniplus.selecao.processo_seletivo.tipo_de_ato_sem_versao_vigente',
  message: 'O tipo de ato escolhido não tem versão vigente.',
};

describe('RevisaoPassoComponent: recusas do documento do edital e do tipo do ato', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let controller: HttpTestingController;
  let recusasDoServidor: RecusasDaPublicacao;

  usarRevisao((montado) => {
    cenario = montado;
    ({ fixture, componente, controller } = montado);
    recusasDoServidor = TestBed.inject(RecusasDaPublicacao);
  });

  const bloco = (): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('sel-recusas-da-publicacao');
  const textoDoBloco = (): string => bloco()?.textContent?.replace(/\s+/g, ' ') ?? '';
  const textosDosItens = (): (string | undefined)[] =>
    Array.from(bloco()?.querySelectorAll('li') ?? []).map((item) =>
      item.textContent?.replace(/\s+/g, ' '),
    );

  /** A API devolve o código da primeira causa como código da resposta. */
  async function publicarERecusar(erros: readonly Erro[]): Promise<void> {
    prepararCamposLocais(cenario);
    await criarProcesso(cenario);
    await flushProntidaoVerde(cenario);
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_PUBLICACAO).flush(
      {
        type: 'about:blank',
        title: 'A publicação do edital foi recusada',
        status: 422,
        code: erros[0].code,
        traceId: 't1',
        errors: erros,
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await gravacao;
    await flushProntidaoVerde(cenario);
    fixture.detectChanges();
  }

  it('mostra as duas recusas, cada uma com a mensagem e o código, na ordem da resposta', async () => {
    await publicarERecusar([DOCUMENTO_DO_EDITAL, TIPO_DO_ATO]);

    const itens = textosDosItens();
    expect(itens).toHaveLength(2);
    expect(itens[0]).toContain(DOCUMENTO_DO_EDITAL.message);
    expect(itens[0]).toContain(DOCUMENTO_DO_EDITAL.code);
    expect(itens[1]).toContain(TIPO_DO_ATO.message);
    expect(itens[1]).toContain(TIPO_DO_ATO.code);
  });

  it('mostra a recusa do tipo do ato mesmo quando o código da resposta é o do documento', async () => {
    await publicarERecusar([DOCUMENTO_DO_EDITAL, TIPO_DO_ATO]);

    expect(recusasDoServidor.resposta()?.codigo).toBe(DOCUMENTO_DO_EDITAL.code);
    expect(textoDoBloco()).toContain(TIPO_DO_ATO.message);
  });

  it('mostra só a recusa do documento quando a lista traz um item', async () => {
    await publicarERecusar([DOCUMENTO_DO_EDITAL]);

    expect(textosDosItens()).toHaveLength(1);
    expect(textoDoBloco()).toContain(DOCUMENTO_DO_EDITAL.message);
    expect(textoDoBloco()).not.toContain(TIPO_DO_ATO.message);
  });

  it('mostra só a recusa do tipo do ato quando a lista traz um item', async () => {
    await publicarERecusar([TIPO_DO_ATO]);

    expect(recusasDoServidor.resposta()?.codigo).toBe(TIPO_DO_ATO.code);
    expect(textosDosItens()).toHaveLength(1);
    expect(textoDoBloco()).toContain(TIPO_DO_ATO.message);
    expect(textoDoBloco()).not.toContain(DOCUMENTO_DO_EDITAL.message);
  });

  it('diz onde corrigir cada recusa, sem afirmar que não há campo nesta tela', async () => {
    await publicarERecusar([DOCUMENTO_DO_EDITAL, TIPO_DO_ATO]);

    expect(textoDoBloco()).not.toContain('Sem campo nesta tela.');
    expect(textosDosItens()[0]).toContain('passo Identificação');
    expect(textosDosItens()[1]).toContain('Tipo de ato');
  });
});
