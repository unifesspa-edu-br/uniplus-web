import { SentidoDoMotivoCodigo, TipoMotivoDeDecisaoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import { umMotivoNoDocumento } from '../../../shared/motivos/motivos.testing';
import {
  FASE_ID,
  FORA_DO_PRAZO_NO_CADASTRO,
  MOTIVO_SEM_RESULTADO,
  OUTRA_FASE_ID,
  PROBLEMA_JSON,
  ROTA_DA_ESCOLHA_DO_PROCESSO,
  ROTA_DO_CADASTRO,
  SEM_RESULTADO_NO_CADASTRO,
  carregarComOServidor,
  corpoDoProblema,
  escolhidoPeloProcesso,
  esperar,
  montarOStoreDosMotivos,
  rotaDoMotivoNaFase,
  type Montagem,
} from './motivos-da-fase.testing';

const CADASTRO = [SEM_RESULTADO_NO_CADASTRO, FORA_DO_PRAZO_NO_CADASTRO];
const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };
const SEM_RESULTADO_ESCOLHIDO = escolhidoPeloProcesso(SEM_RESULTADO_NO_CADASTRO);
const PEDIDO_DE_SEM_RESULTADO = umMotivoNoDocumento(
  { faseChave: FASE_ID },
  { codigo: 'SEM_RESULTADO_INEP' },
);

let montagem: Montagem;

afterEach(() => montagem.controller.verify());

/** Responde o PUT ou o DELETE com o status dado e deixa a releitura pendente de resposta. */
async function responderAEscolha(
  rota: string,
  resposta: { status: number; codigo?: string },
): Promise<void> {
  const requisicao = montagem.controller.expectOne(rota);
  if (resposta.codigo === undefined) requisicao.flush(null, SEM_CONTEUDO);
  else {
    requisicao.flush(corpoDoProblema(resposta.status, resposta.codigo), {
      status: resposta.status,
      statusText: 'Recusa',
      headers: PROBLEMA_JSON,
    });
  }
  await esperar();
}

function responderAReleitura(escolha: readonly unknown[]): void {
  montagem.controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush(escolha);
}

describe('MotivosDaFaseStore: leitura', () => {
  it('lê o cadastro só do tipo da homologação das inscrições, com os desativados', async () => {
    montagem = montarOStoreDosMotivos();
    montagem.store.carregar();

    const cadastro = montagem.controller.expectOne((req) => req.url === ROTA_DO_CADASTRO);
    expect(cadastro.request.params.get('tipo')).toBe('HOMOLOGACAO_DAS_INSCRICOES');
    expect(cadastro.request.params.get('apenasAtivos')).toBe('false');
    cadastro.flush(CADASTRO);
    responderAReleitura([]);
    await esperar();

    expect(montagem.store.cadastro()).toEqual(CADASTRO);
    expect(montagem.store.cadastroCarregado()).toBe(true);
    expect(montagem.store.falhaDeLeitura()).toBeNull();
  });

  it('lê uma vez, por mais que a seção peça', async () => {
    montagem = montarOStoreDosMotivos();

    await carregarComOServidor(montagem, CADASTRO, []);
    montagem.store.carregar();

    montagem.controller.expectNone(ROTA_DA_ESCOLHA_DO_PROCESSO);
  });

  it('mostra só os motivos que o processo escolheu para esta fase, pela chave dela', async () => {
    montagem = montarOStoreDosMotivos();

    await carregarComOServidor(montagem, CADASTRO, [
      SEM_RESULTADO_ESCOLHIDO,
      escolhidoPeloProcesso(FORA_DO_PRAZO_NO_CADASTRO, OUTRA_FASE_ID),
      escolhidoPeloProcesso(FORA_DO_PRAZO_NO_CADASTRO, null),
    ]);

    expect(montagem.store.escolhidos()).toEqual([
      expect.objectContaining({
        faseChave: FASE_ID,
        tipoDeDecisaoCodigo: 'HOMOLOGACAO_DAS_INSCRICOES',
        codigo: 'SEM_RESULTADO_INEP',
        descricao: 'Sem resultado no retorno do INEP.',
        sentido: 'DESFAVORAVEL',
      }),
    ]);
  });

  it('oferece às condições só os motivos desfavoráveis da homologação que a fase escolheu', async () => {
    montagem = montarOStoreDosMotivos();
    const favoravel = {
      ...escolhidoPeloProcesso(FORA_DO_PRAZO_NO_CADASTRO),
      sentido: { codigo: SentidoDoMotivoCodigo.FAVORAVEL, rotulo: 'Favorável' },
    };
    const deOutroTipo = {
      ...escolhidoPeloProcesso({ ...SEM_RESULTADO_NO_CADASTRO, codigo: 'EMPATE' }),
      tipo: { codigo: TipoMotivoDeDecisaoCodigo.CLASSIFICACAO, rotulo: 'Classificação' },
    };

    await carregarComOServidor(montagem, CADASTRO, [
      SEM_RESULTADO_ESCOLHIDO,
      favoravel,
      deOutroTipo,
    ]);

    expect(montagem.store.desfavoraveisDaHomologacao().map((motivo) => motivo.codigo)).toEqual([
      'SEM_RESULTADO_INEP',
    ]);
  });

  it('avisa da falha e mantém a lista que já tinha quando a releitura falha', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, [SEM_RESULTADO_ESCOLHIDO]);

    void montagem.store.reler();
    montagem.controller
      .expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO)
      .flush(null, { status: 500, statusText: 'Erro' });
    await esperar();

    expect(montagem.store.falhaDeLeitura()).toBe(
      'Não foi possível carregar os motivos desta fase.',
    );
    expect(montagem.store.escolhidos()).toHaveLength(1);
  });

  it('bloqueia a escolha enquanto a lista lida não for confirmada pela releitura', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, [SEM_RESULTADO_ESCOLHIDO]);
    expect(montagem.store.modo()).toBe('edicao');

    void montagem.store.reler();
    montagem.controller
      .expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO)
      .flush(null, { status: 500, statusText: 'Erro' });
    await esperar();

    expect(montagem.store.modo()).toBe('bloqueado');
  });

  it('descarta a resposta de uma leitura superada por outra mais nova', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    void montagem.store.reler();
    void montagem.store.reler();
    const [antiga, nova] = montagem.controller.match(ROTA_DA_ESCOLHA_DO_PROCESSO);
    nova.flush([]);
    antiga.flush([SEM_RESULTADO_ESCOLHIDO]);
    await esperar();

    expect(montagem.store.escolhidos()).toEqual([]);
  });
});

async function incluirEPegarAChave(): Promise<string | null> {
  const pedido = montagem.store.escolher(PEDIDO_DE_SEM_RESULTADO);
  const put = montagem.controller.expectOne(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO));
  const chave = put.request.headers.get('Idempotency-Key');
  put.flush(null, SEM_CONTEUDO);
  await esperar();
  responderAReleitura([]);
  await pedido;
  return chave;
}

describe('MotivosDaFaseStore: escolher e retirar', () => {
  it('inclui o motivo do cadastro na fase com chave de idempotência e relê o servidor', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    const pedido = montagem.store.escolher(PEDIDO_DE_SEM_RESULTADO);
    const put = montagem.controller.expectOne(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO));
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.get('Idempotency-Key')).toBeTruthy();
    put.flush(null, SEM_CONTEUDO);
    await esperar();
    responderAReleitura([SEM_RESULTADO_ESCOLHIDO]);
    await pedido;

    expect(montagem.store.escolhidos().map((motivo) => motivo.codigo)).toEqual([
      'SEM_RESULTADO_INEP',
    ]);
    expect(montagem.store.recusa()).toBeNull();
  });

  it('retira o motivo que a fase escolheu e relê o servidor', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, [SEM_RESULTADO_ESCOLHIDO]);

    const pedido = montagem.store.retirar(PEDIDO_DE_SEM_RESULTADO);
    const exclusao = montagem.controller.expectOne(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO));
    expect(exclusao.request.method).toBe('DELETE');
    expect(exclusao.request.headers.get('Idempotency-Key')).toBeTruthy();
    exclusao.flush(null, SEM_CONTEUDO);
    await esperar();
    responderAReleitura([]);
    await pedido;

    expect(montagem.store.escolhidos()).toEqual([]);
  });

  it('usa uma chave de idempotência nova a cada pedido', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    const primeira = await incluirEPegarAChave();
    const segunda = await incluirEPegarAChave();

    expect(primeira).toBeTruthy();
    expect(segunda).not.toBe(primeira);
  });

  it('mantém a caixa desabilitada enquanto grava e depois de reler a libera', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);
    expect(montagem.store.modo()).toBe('edicao');

    const pedido = montagem.store.escolher(PEDIDO_DE_SEM_RESULTADO);
    expect(montagem.store.gravando()).toBe(true);
    expect(montagem.store.modo()).toBe('bloqueado');
    await responderAEscolha(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO), { status: 204 });
    expect(montagem.store.modo()).toBe('bloqueado');
    responderAReleitura([SEM_RESULTADO_ESCOLHIDO]);
    await pedido;

    expect(montagem.store.gravando()).toBe(false);
    expect(montagem.store.modo()).toBe('edicao');
  });

  it('ignora um segundo pedido enquanto o primeiro grava', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    const primeiro = montagem.store.escolher(PEDIDO_DE_SEM_RESULTADO);
    await montagem.store.escolher(
      umMotivoNoDocumento({ faseChave: FASE_ID }, { codigo: 'FORA_DO_PRAZO' }),
    );
    await responderAEscolha(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO), { status: 204 });
    responderAReleitura([]);
    await primeiro;

    montagem.controller.expectNone(rotaDoMotivoNaFase(FORA_DO_PRAZO_NO_CADASTRO.id));
  });

  it('não envia nada para o motivo que não está no cadastro', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    await montagem.store.escolher(
      umMotivoNoDocumento({ faseChave: FASE_ID }, { codigo: 'FORA_DO_CADASTRO' }),
    );

    expect(montagem.store.gravando()).toBe(false);
  });
});

describe('MotivosDaFaseStore: recusas', () => {
  async function pedirEResponder(codigo: string, status: number): Promise<void> {
    const pedido = montagem.store.escolher(PEDIDO_DE_SEM_RESULTADO);
    await responderAEscolha(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO), { status, codigo });
    responderAReleitura([SEM_RESULTADO_ESCOLHIDO]);
    await pedido;
  }

  it('trata o 409 de motivo já escolhido como feito: relê e não mostra recusa', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    await pedirEResponder('uniplus.selecao.motivo_de_decisao.ja_escolhido', 409);

    expect(montagem.store.recusa()).toBeNull();
    expect(montagem.store.escolhidos()).toHaveLength(1);
  });

  it('trata a retirada de motivo que a fase não escolhe como feita: relê e não mostra recusa', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, [SEM_RESULTADO_ESCOLHIDO]);

    const pedido = montagem.store.retirar(PEDIDO_DE_SEM_RESULTADO);
    await responderAEscolha(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO), {
      status: 404,
      codigo: 'uniplus.selecao.motivo_de_decisao.nao_escolhido',
    });
    responderAReleitura([]);
    await pedido;

    expect(montagem.store.recusa()).toBeNull();
    expect(montagem.store.escolhidos()).toEqual([]);
  });

  it('mostra a recusa de motivo desativado com o código e a página do erro, e relê', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    await pedirEResponder('uniplus.selecao.motivo_de_decisao.motivo_inativo', 422);

    expect(montagem.store.recusa()).toEqual({
      codigo: 'uniplus.selecao.motivo_de_decisao.motivo_inativo',
      mensagem: 'A escolha do motivo foi recusada.',
      pagina: 'https://erros.example/uniplus.selecao.motivo_de_decisao.motivo_inativo',
    });
    expect(montagem.store.podeTentarDeNovo()).toBe(false);
  });

  it('mostra a recusa de processo fora de rascunho', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);

    await pedirEResponder(
      'uniplus.selecao.processo_seletivo.mutacao_pos_publicacao_bloqueada',
      422,
    );

    expect(montagem.store.recusa()?.codigo).toBe(
      'uniplus.selecao.processo_seletivo.mutacao_pos_publicacao_bloqueada',
    );
  });

  it('com o processo ocupado (503) relê, oferece tentar de novo e repete o pedido com chave nova', async () => {
    montagem = montarOStoreDosMotivos();
    await carregarComOServidor(montagem, CADASTRO, []);
    const pedido = montagem.store.escolher(PEDIDO_DE_SEM_RESULTADO);
    const primeira = montagem.controller.expectOne(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO));
    const chaveDaPrimeira = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(corpoDoProblema(503, 'uniplus.concorrencia.espera_esgotada'), {
      status: 503,
      statusText: 'Indisponível',
      headers: PROBLEMA_JSON,
    });
    await esperar();
    responderAReleitura([]);
    await pedido;
    expect(montagem.store.podeTentarDeNovo()).toBe(true);
    expect(montagem.store.recusa()?.codigo).toBe('uniplus.concorrencia.espera_esgotada');

    const nova = montagem.store.tentarDeNovo();
    const segunda = montagem.controller.expectOne(rotaDoMotivoNaFase(MOTIVO_SEM_RESULTADO));
    expect(segunda.request.method).toBe('PUT');
    expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chaveDaPrimeira);
    segunda.flush(null, SEM_CONTEUDO);
    await esperar();
    responderAReleitura([SEM_RESULTADO_ESCOLHIDO]);
    await nova;

    expect(montagem.store.recusa()).toBeNull();
    expect(montagem.store.podeTentarDeNovo()).toBe(false);
  });
});
