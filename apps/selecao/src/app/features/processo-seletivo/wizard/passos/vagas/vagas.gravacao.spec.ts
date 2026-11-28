import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { montarPassoEmGravacao } from './vagas.gravacao.testing';
import { TelaDasVagas } from './tela-das-vagas.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  MODALIDADE,
  OFERTA,
  OUTRA_OFERTA,
  ROTA_DISTRIBUICAO,
  comReleitura,
  distribuicao,
  ServicosDasVagas,
} from './vagas.testing';

describe('VagasPassoComponent — gravação da distribuição', () => {
  let componente: VagasPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let servicos: ServicosDasVagas;
  let operador: TelaDasVagas;
  let simular: (ofertas: readonly string[]) => void;

  beforeEach(async () => {
    ({ componente, store, controller, servicos, operador, simular } =
      await montarPassoEmGravacao());
  });

  afterEach(() => controller.verify());

  /** O comando substitui a configuração inteira: as duas ofertas vão juntas. */
  it('envia a coleção completa num único PUT', async () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_DISTRIBUICAO);
    expect(requisicao.request.method).toBe('PUT');
    expect(requisicao.request.body).toHaveLength(2);
    expect(requisicao.request.body[0]).toMatchObject({
      ofertaCursoId: OFERTA,
      vagasOfertadasBase: 40,
      percentualDaReservaLegal: 0.5,
      modalidadeIds: [MODALIDADE],
      quadro: [{ modalidadeId: MODALIDADE, quantidade: 2 }],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  /** ADR-0027: comando de escrita viaja com Idempotency-Key. */
  it('envia a gravação com Idempotency-Key', async () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_DISTRIBUICAO);
    expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await comReleitura(controller, gravacao);
  });

  /**
   * A recusa da API não pode apagar o formulário —
   * o operador precisa corrigir a partir do que já preencheu.
   */
  it('preserva o rascunho quando a API recusa a coleção', async () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    controller.expectOne(ROTA_DISTRIBUICAO).flush(
      {
        type: 'about:blank',
        title: 'A quantidade de AC_I não pode ser fixada pelo edital.',
        status: 422,
        code: 'uniplus.selecao.configuracao_distribuicao_vagas.quantidade_calculada_nao_informavel',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await comReleitura(controller, gravacao);
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toBeTruthy();
    expect(store.draft().vagas.ofertas).toHaveLength(2);
    expect(store.salvando()).toBe(false);
  });

  /**
   * O que a regra calcula é a maior parte do que será publicado, e só existe
   * depois da simulação: gravar sem ela é declarar um quadro que ninguém viu.
   */
  it('recusa gravar o quadro alterado antes de simular', async () => {
    operador.alterarVoBase(OFERTA, '35');

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((mensagem) => mensagem.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Uma edição descarta o resultado: a conferência é sobre o que está em tela. */
  it('volta a exigir simulação depois de editar o quadro', () => {
    operador.alterarVoBase(OFERTA, '34');
    simular([OFERTA, OUTRA_OFERTA]);
    expect(servicos.estado.faltaSimular()).toBe(false);

    operador.alterarVoBase(OFERTA, '35');

    expect(store.draft().vagas.ofertas[0].voBase).toBe('35');
    expect(servicos.estado.faltaSimular()).toBe(true);
  });

  /**
   * Gravar sem simular é declarar um quadro que ninguém viu — e essa continua sendo a recusa do
   * passo. A conferência do operador saiu de `persistir()` e virou o diálogo que a página abre
   * antes de chamar aqui: enquanto era estado do componente, um recarregamento a derrubava e a
   * gravação falhava num passo que o operador não tinha aberto.
   */
  it('recusa gravar o quadro alterado sem simular', async () => {
    operador.alterarVoBase(OFERTA, '35');

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((mensagem) => mensagem.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** O quadro gravado e aberto de novo não foi alterado: a simulação perdida na recarga não é pedida. */
  it('não pede simulação para o quadro gravado e sem alteração', () => {
    expect(servicos.estado.quadroAlterado()).toBe(false);
    expect(servicos.estado.faltaSimular()).toBe(false);
    expect(componente.validar().valid).toBe(true);
  });

  /** Sem simulação, a confirmação não inventa zero para o que a regra calcularia. */
  it('confirma o quadro gravado sem mostrar totais calculados que não conhece', () => {
    const rotulos = componente.confirmacaoDeGravacao()?.itens.map((item) => item.rotulo) ?? [];

    expect(rotulos).toContain('Ofertas de curso no quadro');
    expect(rotulos.some((rotulo) => rotulo.includes('calculadas pela regra'))).toBe(false);
    expect(rotulos.some((rotulo) => rotulo.startsWith('Total publicado'))).toBe(false);
  });

  /** Publicar regrava o passo: o quadro gravado e intacto segue para a API sem nova simulação. */
  it('grava o quadro sem alteração sem pedir simulação', async () => {
    const gravacao = componente.persistir();

    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, { status: 204, statusText: 'No Content' });
    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  /** O problema do quadro gravado é apontado pelo motivo próprio, sem pedir simulação. */
  it('recusa o quadro gravado com problema próprio sem mencionar simulação', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [{ ...distribuicao(OFERTA), voBase: '' }, distribuicao(OUTRA_OFERTA)],
    });

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((mensagem) => mensagem.includes('total de vagas'))).toBe(true);
    expect(resultado.messages?.some((mensagem) => mensagem.includes('Simule o quadro'))).toBe(
      false,
    );
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Simulado e sem pendência, o passo grava — sem pedir marca nenhuma. */
  it('grava depois de simular, sem exigir declaração do operador', async () => {
    simular([OFERTA, OUTRA_OFERTA]);

    expect(componente.validar().valid).toBe(true);
  });

  /** Ninguém confirma um quadro que o passo não vai gravar. */
  it('não oferece confirmação enquanto há pendência', () => {
    operador.alterarVoBase(OFERTA, '35');
    expect(componente.confirmacaoDeGravacao()).toBeNull();
  });

  /** Sem processo criado não há o que gravar, e o comando não sai. */
  it('recusa gravar antes de o processo existir', async () => {
    store.processoSeletivoId.set(null);

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /**
   * O comando não sai de um passo que a validação recusaria: os campos são
   * texto, e o que não é número viraria zero no envio.
   */
  it('não envia comando quando a validação do passo recusa', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [{ ...distribuicao(OFERTA), voBase: '' }],
    });

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });
});
