import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { EU, ok, pedido, recusa } from './testes';
import {
  presente,
  GESTOR,
  esperar,
  botao,
  noResumo,
  edicaoDe,
  clicar,
  decidirNoResumo,
  botaoDeConfirmacao,
  confirmarNoDialogo,
  textoDoAlerta,
  selecionarArquivo,
  pdf,
  dublesDoPedido,
  abrirPedido,
  solicitadoPorMim,
} from './pedido-detalhe.page.testing';

describe('PedidoDetalhePage — aceite, cancelamento e anexo', () => {
  const dubles = dublesDoPedido();
  const { api, anexos, notificacoes } = dubles;
  const abrir = abrirPedido(dubles);

  it('o beneficiário nomeado aceita o pedido que espera por ele', async () => {
    const aguardando = pedido({
      situacao: 'aguardando_beneficiario',
      etapaAtual: null,
      beneficiario: { email: EU.email, identidade: null, nome: null },
    });
    const { fixture, host } = await abrir([], aguardando);
    api.aceitar.mockReturnValue(of(ok(pedido())));

    await decidirNoResumo(fixture, host, 'Aceitar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(api.aceitar).toHaveBeenCalled();
  });

  it('o solicitante cancela antes da primeira decisão e volta à lista', async () => {
    const { fixture, host, navegar } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(ok(undefined)));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos']);
    expect(notificacoes.success).toHaveBeenCalledWith('Pedido cancelado');
  });

  it('não oferece cancelar depois da decisão nem no pedido encerrado', async () => {
    const decisao = {
      etapa: 'gestor',
      decisor: { emissor: 'unifesspa', sub: 'sub-gestor-0000' },
      resultado: 'aprovado',
      motivo: null,
      instante: '2026-10-28T13:00:00Z',
      permissoesAvaliadas: [],
      sensibilidadeAvaliada: 'pessoal',
      dispensa: null,
    };
    const decidido = await abrir([], { ...solicitadoPorMim(), decisoes: [decisao] });
    expect(botao(noResumo(decidido.host), 'Cancelar o pedido')).toBeUndefined();
    expect(decidido.host.textContent).toContain('Dado pessoal');

    const encerrado = await abrir([], { ...solicitadoPorMim(), situacao: 'aprovado' });
    expect(botao(noResumo(encerrado.host), 'Cancelar o pedido')).toBeUndefined();
  });

  it('mostra a recusa do cancelamento sem sair da página', async () => {
    const { fixture, host, navegar } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.situacao_invalida')));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    expect(navegar).not.toHaveBeenCalled();
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it('a falha de servidor do cancelamento vira notificação', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(recusa('uniplus.internal.unexpected', 500, 'Erro interno')));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('destaca a pendência e a ação de anexar quando o pedido aguarda o documento', async () => {
    const { host } = await abrir(
      [],
      pedido({ ...solicitadoPorMim(), situacao: 'aguardando_documento', etapaAtual: null }),
    );

    expect(host.textContent).toContain('Falta o documento de designação');
    expect(host.textContent).toContain('Aguardando o documento de designação');
    const botoes = Array.from(host.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(botoes).toContain('Anexar o documento');
  });

  describe('envio de anexo pelo solicitante', () => {
    const TERMO = { versaoId: 'termo-v2', numero: 2, resumo: 'a'.repeat(64), aceite: null };
    const temEnvio = (host: HTMLElement) =>
      host.querySelector('cfg-pedido-documentos input[type="file"]') !== null;

    it('não oferece o envio no pedido protegido que não declarou documento', async () => {
      const { host } = await abrir([], pedido({ ...solicitadoPorMim(), termo: TERMO }));

      expect(temEnvio(host)).toBe(false);
    });

    it('oferece o envio no pedido protegido que declarou o documento e ainda o espera', async () => {
      const { host } = await abrir(
        [],
        pedido({
          ...solicitadoPorMim(),
          termo: TERMO,
          anexaraDocumento: true,
          situacao: 'aguardando_documento',
          etapaAtual: null,
        }),
      );

      expect(temEnvio(host)).toBe(true);
    });

    it('continua oferecendo o envio no pedido comum, sem declaração', async () => {
      const { host } = await abrir([], solicitadoPorMim());

      expect(temEnvio(host)).toBe(true);
    });
  });

  it('anexa o documento do solicitante e recarrega o pedido', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockResolvedValue({ ok: true });

    await selecionarArquivo(fixture, host, pdf());

    expect(anexos.anexar).toHaveBeenCalled();
    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(notificacoes.success).toHaveBeenCalledWith(
      'Documento enviado',
      'Ele segue para verificação.',
    );
  });

  it('libera o seletor de arquivo quando o envio do anexo falha com exceção', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockRejectedValue(new Error('rede'));

    await selecionarArquivo(fixture, host, pdf());

    const documentos = presente(host.querySelector('cfg-pedido-documentos'));
    expect(documentos.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(false);
    expect(documentos.textContent).not.toContain('Enviando o documento');
    expect(edicaoDe(fixture).anexando()).toBe(false);
    expect(documentos.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível concluir a operação',
    );
  });

  it('ignora o segundo clique em cancelar enquanto o primeiro está em andamento', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.cancelar.mockReturnValue(resposta);

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);
    await confirmarNoDialogo(fixture, host);
    resposta.next(ok(undefined));
    resposta.complete();
    await esperar(fixture);

    expect(api.cancelar).toHaveBeenCalledTimes(1);
    expect(botaoDeConfirmacao(host).getAttribute('aria-busy')).toBeNull();
  });

  it('libera a ação e mostra o erro quando o cancelamento falha com exceção', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(throwError(() => new Error('rede')));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(botaoDeConfirmacao(host).getAttribute('aria-busy')).toBeNull();
    expect(edicaoDe(fixture).erro()).toContain('Não foi possível concluir a operação');
    expect(textoDoAlerta(host)).toContain('Não foi possível concluir a operação');
  });

  it('mostra a falha do anexo no próprio campo', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });

    await selecionarArquivo(fixture, host, pdf());

    expect(edicaoDe(fixture).erroDoAnexo()).toBe('Falha ao enviar o arquivo.');
    expect(host.querySelector('cfg-pedido-documentos [role="alert"]')?.textContent).toContain(
      'Falha ao enviar o arquivo.',
    );
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(api.obter).toHaveBeenCalledTimes(1);
  });

  it('abre só o documento verificado e explica o bloqueio de janelas', async () => {
    const comAnexo = pedido({
      anexos: [
        {
          id: 'a1',
          situacao: 'verificado',
          tamanhoDeclarado: 10,
          enviadoEm: '2026-10-28T12:30:00Z',
        },
        { id: 'a2', situacao: 'em_verificacao', tamanhoDeclarado: 10, enviadoEm: null },
      ],
    });
    const { fixture, host } = await abrir([GESTOR], comAnexo);
    anexos.abrir.mockResolvedValue('bloqueada');

    expect(host.textContent).toContain('Em verificação');
    expect(host.textContent?.match(/Abrir documento/gu)).toHaveLength(1);
    await clicar(fixture, botao(host, 'Abrir documento'));

    expect(anexos.abrir).toHaveBeenCalledWith('pedido-1', 'a1', expect.any(Function));
    expect(edicaoDe(fixture).erro()).toContain('bloqueou');
    expect(textoDoAlerta(host)).toContain('bloqueou');
  });

  beforeEach(() => TestBed.resetTestingModule());
});
