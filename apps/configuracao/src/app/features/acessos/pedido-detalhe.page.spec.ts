import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { EU, ok, pedido, recusa } from './testes';
import {
  MENSAGEM_DA_FALHA,
  servidorIndisponivel,
  GESTOR,
  PROTECAO_DE_DADOS,
  esperar,
  decisoesOferecidas,
  textoDoAlerta,
  titulosDosAlertas,
  dublesDoPedido,
  abrirPedido,
  provedoresDaPagina,
  montarPagina,
  solicitadoPorMim,
} from './pedido-detalhe.page.testing';

describe('PedidoDetalhePage — leitura e quem decide', () => {
  const dubles = dublesDoPedido();
  const { api } = dubles;
  const abrir = abrirPedido(dubles);

  it('mostra o resumo, o escopo nomeado e a etapa em que o pedido está', async () => {
    const { host } = await abrir([]);

    expect(host.textContent).toContain('Operador de inscrições');
    expect(host.textContent).toContain('CEPS');
    expect(host.textContent).toContain('Betina Teste');
    expect(host.textContent).toContain('Gestão de acessos');
  });

  it('descarta o resultado de uma carga antiga quando o id já mudou', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    const antigaObter = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValueOnce(antigaObter);
    api.trilha.mockReturnValueOnce(of(ok([])));
    fixture.componentRef.setInput('id', 'antigo');
    fixture.detectChanges();

    const novaObter = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValueOnce(novaObter);
    api.trilha.mockReturnValueOnce(of(ok([])));
    fixture.componentRef.setInput('id', 'novo');
    fixture.detectChanges();

    antigaObter.next(servidorIndisponivel());
    antigaObter.complete();
    await esperar(fixture);

    expect(host.querySelector('ui-alert')).toBeNull();
    expect(host.textContent).toContain('Carregando o pedido');

    novaObter.next(ok(pedido({ id: 'novo', justificativa: 'Justificativa do novo.' })));
    novaObter.complete();
    await esperar(fixture);
    expect(host.textContent).not.toContain('Carregando o pedido');
    expect(host.textContent).toContain('Justificativa do novo.');
  });

  it('ao mudar só o id da rota, carrega o pedido novo em vez de manter o anterior', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.obter.mockReturnValue(
      of(ok(pedido({ id: 'outro', justificativa: 'Justificativa do outro.' }))),
    );

    fixture.componentRef.setInput('id', 'outro');
    fixture.detectChanges();
    await esperar(fixture);

    expect(api.obter).toHaveBeenLastCalledWith('outro');
    expect(host.textContent).toContain('Justificativa do outro.');
  });

  it('o gestor de acessos vê aprovar e recusar no pedido da etapa dele', async () => {
    const { host } = await abrir([GESTOR]);

    expect(decisoesOferecidas(host)).toEqual([true, true]);
  });

  it('o Representante do controlador não decide pedido que ainda aguarda o gestor', async () => {
    const { host } = await abrir([PROTECAO_DE_DADOS]);

    expect(decisoesOferecidas(host)).toEqual([false, false]);
  });

  it('o Representante do controlador decide o pedido da etapa dele', async () => {
    const { host } = await abrir(
      [PROTECAO_DE_DADOS],
      pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }),
    );

    expect(decisoesOferecidas(host)).toEqual([true, true]);
  });

  it('quem é parte do pedido não decide', async () => {
    const { host } = await abrir([GESTOR], solicitadoPorMim());
    expect(decisoesOferecidas(host)).toEqual([false, false]);

    const outra = await abrir(
      [GESTOR],
      pedido({ beneficiario: { email: EU.email.toUpperCase(), identidade: null, nome: null } }),
    );
    expect(decisoesOferecidas(outra.host)).toEqual([false, false]);
  });

  it('quem já decidiu como gestor não vê aprovar nem recusar na etapa da proteção de dados', async () => {
    const decisao = {
      etapa: 'gestor',
      decisor: { emissor: 'unifesspa', sub: EU.id },
      resultado: 'aprovado',
      motivo: null,
      instante: '2026-10-28T13:00:00Z',
      permissoesAvaliadas: [],
      sensibilidadeAvaliada: 'pessoal',
      dispensa: null,
    };
    const naEtapaDaProtecaoDeDados = pedido({
      situacao: 'aguardando_protecao_de_dados',
      etapaAtual: 'protecao_de_dados',
      decisoes: [decisao],
    });

    const { host } = await abrir([GESTOR, PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados);
    expect(decisoesOferecidas(host)).toEqual([false, false]);

    const outro = await abrir(
      [GESTOR, PROTECAO_DE_DADOS],
      pedido({
        ...naEtapaDaProtecaoDeDados,
        decisoes: [{ ...decisao, decisor: { emissor: 'unifesspa', sub: 'sub-outro-gestor' } }],
      }),
    );
    expect(decisoesOferecidas(outro.host)).toEqual([true, true]);
  });

  it('depois do perfil alterado, o gestor original reavalia e o Representante do controlador que tentou conclui', async () => {
    const decisao = (etapa: string, resultado: string, sub: string) => ({
      etapa,
      decisor: { emissor: 'unifesspa', sub },
      resultado,
      motivo: null,
      instante: '2026-10-28T13:00:00Z',
      permissoesAvaliadas: [],
      sensibilidadeAvaliada: 'pessoal',
      dispensa: null,
    });
    const devolvido = pedido({
      decisoes: [
        decisao('gestor', 'aprovado', EU.id),
        decisao('protecao_de_dados', 'perfil_alterado', 'sub-outra-pessoa-2'),
      ],
    });

    const gestor = await abrir([GESTOR], devolvido);
    expect(decisoesOferecidas(gestor.host)).toEqual([true, true]);

    const naEtapaDaProtecaoDeDados = pedido({
      situacao: 'aguardando_protecao_de_dados',
      etapaAtual: 'protecao_de_dados',
      decisoes: [
        decisao('gestor', 'aprovado', EU.id),
        decisao('protecao_de_dados', 'perfil_alterado', 'sub-protecao-de-dados-0'),
        decisao('gestor', 'aprovado', 'sub-outro-gestor'),
      ],
    });
    const protecaoDeDados = await abrir([PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados, {
      id: 'sub-protecao-de-dados-0',
    });
    expect(decisoesOferecidas(protecaoDeDados.host)).toEqual([true, true]);

    const mesmoGestor = await abrir([GESTOR, PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados);
    expect(decisoesOferecidas(mesmoGestor.host)).toEqual([false, false]);
  });

  it('a falha da trilha também é falha da leitura e a nova tentativa a lê de novo', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    document.body.append(host);
    api.trilha.mockReturnValue(of(servidorIndisponivel()));
    fixture.debugElement.injector.get(PedidoDetalheStore).recarregar();
    await esperar(fixture);
    await esperar(fixture);

    const tentar = host.querySelector<HTMLButtonElement>('#tentar-pedido');
    expect(textoDoAlerta(host)).toContain(MENSAGEM_DA_FALHA);
    api.trilha.mockReturnValue(of(ok([])));
    tentar?.focus();
    tentar?.click();
    await esperar(fixture);
    await esperar(fixture);

    expect(host.querySelector('#tentar-pedido')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('#cfg-pedido-titulo'));
    host.remove();
  });

  it('o pedido inexistente mostra a recusa sem oferecer nova tentativa e mantém o caminho de volta', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.obter.mockReturnValue(
      of(recusa('uniplus.autorizacao.pedido.nao_encontrado', 404, 'Pedido não encontrado')),
    );
    fixture.debugElement.injector.get(PedidoDetalheStore).recarregar();
    await esperar(fixture);
    await esperar(fixture);

    expect(titulosDosAlertas(host)).toEqual(['Pedido não encontrado']);
    expect(host.querySelector('#tentar-pedido')).toBeNull();
    expect(host.textContent).not.toContain('Tentar novamente');
    expect(host.querySelector('ui-alert a')).not.toBeNull();
  });

  it('a trilha inexistente de um pedido lido não diz que o pedido não foi encontrado', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.trilha.mockReturnValue(
      of(recusa('uniplus.autorizacao.pedido.nao_encontrado', 404, 'Não encontrada')),
    );
    fixture.debugElement.injector.get(PedidoDetalheStore).recarregar();
    await esperar(fixture);
    await esperar(fixture);

    expect(titulosDosAlertas(host)).toEqual(['Trilha do pedido não encontrada']);
    expect(host.textContent).toContain('Betina Teste');
  });

  it('o pedido sem permissão de leitura não é chamado de não encontrado', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.obter.mockReturnValue(of(recusa('uniplus.autorizacao.sem_permissao', 403, 'Sem acesso')));
    fixture.debugElement.injector.get(PedidoDetalheStore).recarregar();
    await esperar(fixture);
    await esperar(fixture);

    expect(titulosDosAlertas(host)).toEqual(['Acesso negado']);
  });

  it('mostra a recusa da API ao ler um pedido que a pessoa não pode ver', async () => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    api.obter.mockReturnValue(
      of(recusa('uniplus.autorizacao.pedido.nao_encontrado', 404, 'Não encontrado')),
    );
    api.trilha.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.nao_encontrado', 404)));
    TestBed.configureTestingModule({ providers: provedoresDaPagina(dubles, []) });
    const fixture = await montarPagina('x');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Não encontrado');
  });
  beforeEach(() => TestBed.resetTestingModule());
});
