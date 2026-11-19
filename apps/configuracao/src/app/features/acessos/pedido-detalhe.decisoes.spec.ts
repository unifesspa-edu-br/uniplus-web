import { signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { ok, pedido, recusa } from './testes';
import {
  presente,
  GESTOR,
  PROTECAO_DE_DADOS,
  esperar,
  botao,
  dialogoDeMotivo,
  edicaoDe,
  clicar,
  decidirNoResumo,
  botaoDeConfirmacao,
  confirmarNoDialogo,
  campoDoMotivo,
  escreverMotivo,
  confirmarRecusa,
  recusarComMotivo,
  decisoesOferecidas,
  dialogoAberto,
  dialogoMotivoAlerta,
  textoDoAlerta,
  dublesDoPedido,
  abrirPedido,
  dialogoDeConfirmacao,
} from './pedido-detalhe.page.testing';

describe('PedidoDetalhePage — decisões', () => {
  const dubles = dublesDoPedido();
  const { api, notificacoes } = dubles;
  const abrir = abrirPedido(dubles);

  it('depois de recusa da API, recarrega o pedido e mostra a etapa que a API tem', async () => {
    const { host, fixture } = await abrir([GESTOR, PROTECAO_DE_DADOS]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.perfil_alterado', 409)));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    expect(host.textContent).toContain('Proteção de dados');
  });

  it('mantém a confirmação aberta e impede outra decisão durante o envio', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.aprovar.mockReturnValue(resposta);
    await decidirNoResumo(fixture, host, 'Aprovar');
    const dialogo = presente(dialogoDeConfirmacao(host));
    const confirmar = botaoDeConfirmacao(host);
    await clicar(fixture, confirmar);

    expect(confirmar.getAttribute('aria-busy')).toBe('true');
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain('Enviando');
    expect(botao(dialogo, 'Voltar')?.disabled).toBe(true);
    confirmar.click();
    expect(api.aprovar).toHaveBeenCalledTimes(1);

    resposta.next(ok(pedido()));
    resposta.complete();
    await esperar(fixture);
    expect(dialogo.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('fecha o diálogo de recusa quando o pedido já não está na etapa da pessoa', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    document.body.append(host);
    await decidirNoResumo(fixture, host, 'Recusar');
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.etapa_invalida')));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    await escreverMotivo(fixture, host, 'Motivo.');
    await confirmarRecusa(fixture, host);

    expect(decisoesOferecidas(host)).toEqual([false, false]);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    await esperar(fixture);
    expect(document.activeElement).toBe(host.querySelector('#cfg-pedido-titulo'));
    host.remove();
  });

  it('fecha a confirmação quando a recarga traz outra etapa e leva o foco ao título', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    document.body.append(host);
    await decidirNoResumo(fixture, host, 'Aprovar');
    expect(dialogoAberto(host, ':scope > ui-dialog')).toBe(true);
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    fixture.debugElement.injector.get(PedidoDetalheStore).recarregar();
    await esperar(fixture);
    await esperar(fixture);

    expect(dialogoAberto(host, ':scope > ui-dialog')).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('#cfg-pedido-titulo'));
    host.remove();
  });

  it('bloqueia nova decisão após recusa da API até reavaliar o pedido recarregado', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    const recarga = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValue(recarga);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.perfil_alterado')));
    await recusarComMotivo(fixture, host, 'Motivo');

    expect(host.textContent).toContain('Carregando o pedido');
    await confirmarRecusa(fixture, host);
    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);
    expect(api.recusar).toHaveBeenCalledTimes(1);
    expect(api.aprovar).not.toHaveBeenCalled();

    recarga.next(
      ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' })),
    );
    recarga.complete();
    await esperar(fixture);
    expect(decisoesOferecidas(host)).toEqual([false, false]);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
    await confirmarRecusa(fixture, host);
    expect(api.recusar).toHaveBeenCalledTimes(1);
  });

  it('aprova e recarrega o pedido', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(ok(pedido({ situacao: 'aguardando_protecao_de_dados' }))));

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    expect(notificacoes.success).toHaveBeenCalledWith('Pedido atualizado');
    expect(api.obter).toHaveBeenCalledTimes(2);
  });

  it('mostra a recusa de quem decide o pedido de que é parte e relê o pedido', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.decisor_e_parte')));

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it('mostra a recusa do perfil em janela de migração junto à decisão que a causou', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(
      of(
        recusa(
          'uniplus.autorizacao.pedido.perfil_em_janela_de_migracao',
          422,
          'O perfil está em janela de migração.',
        ),
      ),
    );

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(textoDoAlerta(host)).toContain('O perfil está em janela de migração.');
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('a falha de servidor da decisão vira notificação, sem aviso de sucesso', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.internal.unexpected', 500, 'Erro interno')));

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
    expect(notificacoes.errorFromProblem.mock.calls[0]?.[1]).toEqual({ title: 'Erro interno' });
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('ao reabrir a recusa limpa o motivo e a validação anterior', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    await recusarComMotivo(fixture, host, '');
    const campo = campoDoMotivo(host);
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo);
    await escreverMotivo(fixture, host, 'Motivo anterior');
    await clicar(fixture, botao(dialogoDeMotivo(host), 'Cancelar'));
    await decidirNoResumo(fixture, host, 'Recusar');
    expect(campo?.value).toBe('');
    expect(campo?.getAttribute('aria-invalid')).toBeNull();
  });

  it('impede decisões concorrentes e mantém o diálogo aberto durante o envio', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.recusar.mockReturnValue(resposta);
    await decidirNoResumo(fixture, host, 'Recusar');
    await escreverMotivo(fixture, host, 'Motivo');
    const edicao = edicaoDe(fixture);
    await confirmarRecusa(fixture, host);
    const campo = campoDoMotivo(host);
    const botao = host.querySelector<HTMLButtonElement>('cfg-motivo-dialog .btn--danger');
    expect(campo?.matches(':disabled')).toBe(true);
    expect(botao?.getAttribute('aria-disabled')).toBe('true');
    expect(host.querySelector('cfg-motivo-dialog [role="status"]')?.textContent).toContain(
      'Enviando decisão',
    );
    botao?.click();
    void edicao.recusar(signal(true));
    void edicao.executar(false);
    host
      .querySelector('cfg-motivo-dialog dialog')
      ?.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(edicao.recusando()).toBe(true);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(true);
    expect(api.recusar).toHaveBeenCalledTimes(1);
    expect(api.aprovar).not.toHaveBeenCalled();
    resposta.next(ok(pedido()));
    resposta.complete();
    await esperar(fixture);
    expect(edicao.recusando()).toBe(false);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
  });

  it('mostra e foca o motivo recusado pelo servidor', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Dados inválidos',
            status: 422,
            code: 'uniplus.validacao',
            traceId: '',
            errors: [
              {
                field: 'Motivo',
                code: 'uniplus.autorizacao.pedido.motivo_invalido',
                message: 'Motivo recusado.',
              },
            ],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    await recusarComMotivo(fixture, host, 'Motivo');
    await esperar(fixture);
    const campo = campoDoMotivo(host);
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Motivo recusado.');
    expect(document.activeElement).toBe(campo);
  });

  it('confirmar de novo sem editar o motivo recusado volta a enviar a recusa à API', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Dados inválidos',
            status: 422,
            code: 'uniplus.validacao',
            traceId: '',
            errors: [
              {
                field: 'Motivo',
                code: 'uniplus.autorizacao.pedido.motivo_invalido',
                message: 'Motivo recusado.',
              },
            ],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    await recusarComMotivo(fixture, host, 'Motivo');
    await esperar(fixture);

    await confirmarRecusa(fixture, host);

    expect(api.recusar).toHaveBeenCalledTimes(2);
  });

  it('recusa com motivo e fecha o diálogo', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(ok(pedido({ situacao: 'recusado', etapaAtual: null }))));

    await recusarComMotivo(fixture, host, 'Sem necessidade funcional.');

    expect(api.recusar.mock.calls[0]?.slice(0, 2)).toEqual([
      'pedido-1',
      'Sem necessidade funcional.',
    ]);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
  });

  it('mantém o diálogo de recusa com o erro da API', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.motivo_invalido')));

    await recusarComMotivo(fixture, host, 'x');

    expect(edicaoDe(fixture).erroDaRecusa()).toBe('Recusado');
    expect(dialogoMotivoAlerta(host)).toContain('Recusado');
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(true);
  });

  it('reabrir o diálogo de recusa não mostra o erro da tentativa anterior', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.motivo_invalido')));
    await recusarComMotivo(fixture, host, 'x');
    await clicar(fixture, botao(dialogoDeMotivo(host), 'Cancelar'));

    await decidirNoResumo(fixture, host, 'Recusar');

    expect(edicaoDe(fixture).erroDaRecusa()).toBeNull();
    expect(dialogoMotivoAlerta(host)).toBeUndefined();
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(true);
  });

  it('aplica a decisão retornada enquanto a recarga está pendente', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    const recarga = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValue(recarga);
    api.aprovar.mockReturnValue(
      of(
        ok(
          pedido({
            situacao: 'aguardando_protecao_de_dados',
            etapaAtual: 'protecao_de_dados',
          }),
        ),
      ),
    );
    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);
    expect(host.textContent).toContain('Carregando o pedido');
    expect(decisoesOferecidas(host)).toEqual([false, false]);
    recarga.next(
      ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' })),
    );
    recarga.complete();
    await esperar(fixture);
    expect(decisoesOferecidas(host)).toEqual([false, false]);
  });

  beforeEach(() => TestBed.resetTestingModule());
});
