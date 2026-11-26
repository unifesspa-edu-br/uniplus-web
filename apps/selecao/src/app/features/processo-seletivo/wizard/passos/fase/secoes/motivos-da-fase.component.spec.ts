import { ApplicationRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import { provideTiposDeDecisaoDaApi } from '../../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import {
  FORA_DO_PRAZO_NO_CADASTRO,
  MOTIVO_SEM_RESULTADO,
  PROBLEMA_JSON,
  ROTA_DA_ESCOLHA_DO_PROCESSO,
  ROTA_DO_CADASTRO,
  SEM_RESULTADO_NO_CADASTRO,
  corpoDoProblema,
  escolhidoPeloProcesso,
  esperar,
  montarOStoreDosMotivos,
  rotaDoMotivoNaFase,
  type Montagem,
  type OpcoesDaMontagem,
} from '../motivos/motivos-da-fase.testing';
import { MotivosDaFaseComponent } from './motivos-da-fase.component';

const CADASTRO = [SEM_RESULTADO_NO_CADASTRO, FORA_DO_PRAZO_NO_CADASTRO];

let montagem: Montagem;
let tela: ComponentFixture<MotivosDaFaseComponent>;

afterEach(() => montagem.controller.verify());

async function assentar(): Promise<void> {
  tela.detectChanges();
  TestBed.inject(ApplicationRef).tick();
  await esperar();
}

/** A seção montada no documento, com o servidor já tendo respondido às duas leituras. */
async function montarASecao(
  opcoes: OpcoesDaMontagem = {},
  escolhidos = [escolhidoPeloProcesso(SEM_RESULTADO_NO_CADASTRO)],
): Promise<void> {
  montagem = montarOStoreDosMotivos(
    { tiposDeclarados: ['HOMOLOGACAO_DAS_INSCRICOES'], ...opcoes },
    [provideTiposDeDecisaoDaApi()],
  );
  tela = TestBed.createComponent(MotivosDaFaseComponent);
  document.body.appendChild(tela.nativeElement);
  await assentar();
  montagem.controller.expectOne((req) => req.url === ROTA_DO_CADASTRO).flush(CADASTRO);
  montagem.controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush(escolhidos);
  await assentar();
}

const elemento = (): HTMLElement => tela.nativeElement;
const caixa = (codigo: string): HTMLInputElement =>
  elemento().querySelector(
    `#fase-HOMOLOGACAO_INSCRICOES-motivos-HOMOLOGACAO_DAS_INSCRICOES-${codigo}`,
  ) as HTMLInputElement;
const violacoes = async () =>
  (await axe.run(elemento(), { rules: { region: { enabled: false } } })).violations;

describe('MotivosDaFaseComponent', () => {
  it('mostra o título no nível 3 e as caixas do cadastro, com a escolhida pela fase marcada', async () => {
    await montarASecao();

    expect(elemento().querySelector('h3')?.textContent).toContain('Motivos de decisão');
    expect(caixa('SEM_RESULTADO_INEP').checked).toBe(true);
    expect(caixa('FORA_DO_PRAZO').checked).toBe(false);
    expect(caixa('FORA_DO_PRAZO').disabled).toBe(false);
  });

  it('grava na hora o motivo que a pessoa marca', async () => {
    await montarASecao();

    caixa('FORA_DO_PRAZO').click();
    montagem.controller
      .expectOne(rotaDoMotivoNaFase(FORA_DO_PRAZO_NO_CADASTRO.id))
      .flush(null, { status: 204, statusText: 'No Content' });
    await esperar();
    montagem.controller
      .expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO)
      .flush([
        escolhidoPeloProcesso(SEM_RESULTADO_NO_CADASTRO),
        escolhidoPeloProcesso(FORA_DO_PRAZO_NO_CADASTRO),
      ]);
    await assentar();

    expect(caixa('FORA_DO_PRAZO').checked).toBe(true);
  });

  it('retira na hora o motivo que a pessoa desmarca', async () => {
    await montarASecao();

    caixa('SEM_RESULTADO_INEP').click();
    const exclusao = montagem.controller.expectOne(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO));
    expect(exclusao.request.method).toBe('DELETE');
    exclusao.flush(null, { status: 204, statusText: 'No Content' });
    await esperar();
    montagem.controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush([]);
    await assentar();

    expect(caixa('SEM_RESULTADO_INEP').checked).toBe(false);
  });

  it('desabilita as caixas enquanto a escolha grava', async () => {
    await montarASecao();

    caixa('FORA_DO_PRAZO').click();
    await assentar();

    expect(caixa('FORA_DO_PRAZO').disabled).toBe(true);
    montagem.controller.expectOne(rotaDoMotivoNaFase(FORA_DO_PRAZO_NO_CADASTRO.id)).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await esperar();
    montagem.controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush([]);
    await assentar();
    expect(caixa('FORA_DO_PRAZO').disabled).toBe(false);
  });

  it('pede para gravar o cronograma e desabilita as caixas quando a fase ainda não foi gravada', async () => {
    await montarASecao({ faseGravada: false });

    expect(elemento().textContent).toContain(
      'Grave o cronograma para escolher os motivos desta fase.',
    );
    expect(caixa('FORA_DO_PRAZO').disabled).toBe(true);
  });

  it('só lê, sem caixas, depois da publicação', async () => {
    await montarASecao({ situacao: SituacaoDoProcessoSeletivoCodigo.PUBLICADO });

    expect(elemento().querySelector('input[type="checkbox"]')).toBeNull();
    expect(elemento().textContent).not.toContain('Grave o cronograma');
  });

  it('mostra a recusa junto da seção, com o código e o link da página do erro', async () => {
    await montarASecao();

    caixa('FORA_DO_PRAZO').click();
    montagem.controller
      .expectOne(rotaDoMotivoNaFase(FORA_DO_PRAZO_NO_CADASTRO.id))
      .flush(corpoDoProblema(422, 'uniplus.selecao.motivo_de_decisao.motivo_inativo'), {
        status: 422,
        statusText: 'Recusa',
        headers: PROBLEMA_JSON,
      });
    await esperar();
    montagem.controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush([]);
    await assentar();

    const recusa = elemento().querySelector('[role="alert"]') as HTMLElement;
    expect(recusa.textContent).toContain('uniplus.selecao.motivo_de_decisao.motivo_inativo');
    expect(recusa.querySelector('a')?.getAttribute('href')).toBe(
      'https://erros.example/uniplus.selecao.motivo_de_decisao.motivo_inativo',
    );
  });

  it('oferece tentar de novo quando o processo estava ocupado', async () => {
    await montarASecao();

    caixa('FORA_DO_PRAZO').click();
    montagem.controller
      .expectOne(rotaDoMotivoNaFase(FORA_DO_PRAZO_NO_CADASTRO.id))
      .flush(corpoDoProblema(503, 'uniplus.concorrencia.espera_esgotada'), {
        status: 503,
        statusText: 'Indisponível',
        headers: PROBLEMA_JSON,
      });
    await esperar();
    montagem.controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush([]);
    await assentar();
    (
      elemento().querySelector('#fase-HOMOLOGACAO_INSCRICOES-motivos-tentar-de-novo') as HTMLElement
    ).click();

    const repetido = montagem.controller.expectOne(
      rotaDoMotivoNaFase(FORA_DO_PRAZO_NO_CADASTRO.id),
    );
    expect(repetido.request.method).toBe('PUT');
    repetido.flush(null, { status: 204, statusText: 'No Content' });
    await esperar();
    montagem.controller
      .expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO)
      .flush([escolhidoPeloProcesso(FORA_DO_PRAZO_NO_CADASTRO)]);
    await assentar();
    expect(elemento().querySelector('[role="alert"]')).toBeNull();
  });
});

describe('MotivosDaFaseComponent: acessibilidade', () => {
  it('não tem violações com a escolha liberada', async () => {
    await montarASecao();

    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações com a fase ainda não gravada', async () => {
    await montarASecao({ faseGravada: false });

    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações na consulta', async () => {
    await montarASecao({ situacao: SituacaoDoProcessoSeletivoCodigo.PUBLICADO });

    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações com a recusa e o botão de tentar de novo', async () => {
    await montarASecao();
    caixa('FORA_DO_PRAZO').click();
    montagem.controller
      .expectOne(rotaDoMotivoNaFase(FORA_DO_PRAZO_NO_CADASTRO.id))
      .flush(corpoDoProblema(503, 'uniplus.concorrencia.espera_esgotada'), {
        status: 503,
        statusText: 'Indisponível',
        headers: PROBLEMA_JSON,
      });
    await esperar();
    montagem.controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush([]);
    await assentar();

    expect(elemento().querySelector('[role="alert"] button')).not.toBeNull();
    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações com a falha de leitura e o aviso de nova tentativa', async () => {
    montagem = montarOStoreDosMotivos({ tiposDeclarados: ['HOMOLOGACAO_DAS_INSCRICOES'] }, [
      provideTiposDeDecisaoDaApi(),
    ]);
    tela = TestBed.createComponent(MotivosDaFaseComponent);
    document.body.appendChild(tela.nativeElement);
    await assentar();
    montagem.controller
      .expectOne((req) => req.url === ROTA_DO_CADASTRO)
      .flush(null, { status: 500, statusText: 'Erro' });
    montagem.controller
      .expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO)
      .flush(null, { status: 500, statusText: 'Erro' });
    await assentar();

    expect(elemento().textContent).toContain('Não foi possível carregar os motivos desta fase.');
    expect(await violacoes()).toEqual([]);
  });
});
