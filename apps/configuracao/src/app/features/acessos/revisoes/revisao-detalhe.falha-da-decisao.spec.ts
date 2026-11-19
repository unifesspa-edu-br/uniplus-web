import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusaPeloInterceptor } from '../testes';
import {
  abrirRevisao,
  api,
  assentar,
  botao,
  botoes,
  itemDecidido,
  leituras,
  linha,
  revisao,
} from './revisao.testing';

const REGISTRO_NAO_GRAVOU = 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar';
const falhaDoRegistro = () =>
  of(recusaPeloInterceptor(REGISTRO_NAO_GRAVOU, 503, 'Registro de acesso indisponível'));

const itens = (host: HTMLElement) => host.querySelectorAll('tr[data-item-id]');

/** Abre a revisão e deixa a releitura seguinte pendente até o teste responder. */
async function abrirComReleituraPendente() {
  const pagina = await abrirRevisao();
  const releitura = new Subject<unknown>();
  leituras.mockImplementation(() => releitura);
  const responder = async (resposta: unknown) => {
    releitura.next(resposta);
    releitura.complete();
    await assentar();
  };
  return { ...pagina, responder };
}

async function revogarComMotivo(host: HTMLElement): Promise<void> {
  botao(linha(host, 'i1'), 'Revogar').click();
  await assentar();
  const campo = document.body.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea');
  if (campo === null) throw new Error('campo do motivo ausente');
  campo.value = 'Mudou de setor.';
  campo.dispatchEvent(new Event('input'));
  botao(document.body, 'Revogar acesso').click();
  await assentar();
}

const dialogoAberto = () =>
  document.body.querySelector<HTMLDialogElement>('cfg-motivo-dialog dialog')?.open === true;

describe('RevisaoDetalhePage: decisão de desfecho incerto', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('confirmar com o registro de acesso fora do ar (503) tira a revisão da tela até a releitura', async () => {
    api.confirmar.mockReturnValue(falhaDoRegistro());
    const { host, responder } = await abrirComReleituraPendente();

    botao(linha(host, 'i1'), 'Confirmar').click();
    await assentar();

    expect(host.textContent).toContain('Não foi possível concluir a decisão');
    expect(itens(host)).toHaveLength(0);
    expect(botoes(host).filter((b) => ['Confirmar', 'Revogar'].includes(b))).toEqual([]);

    await responder(ok(revisao({ itens: [itemDecidido({ id: 'i1' })] })));

    expect(itens(host)).toHaveLength(1);
    expect(host.textContent).toContain('A revisão foi relida.');
    expect(api.confirmar).toHaveBeenCalledTimes(1);
  });

  it('revogar com o registro de acesso fora do ar (503) fecha o diálogo e não mostra dado até a releitura', async () => {
    api.revogar.mockReturnValue(falhaDoRegistro());
    const { host, responder } = await abrirComReleituraPendente();

    await revogarComMotivo(host);

    expect(dialogoAberto()).toBe(false);
    expect(itens(host)).toHaveLength(0);

    await responder(ok(revisao()));

    expect(itens(host)).toHaveLength(4);
    expect(botoes(linha(host, 'i1'))).toEqual(['Confirmar', 'Revogar']);
  });

  it('se a releitura também falha, a tela fica sem dado e só volta com "Tentar novamente" bem-sucedido', async () => {
    api.confirmar.mockReturnValue(falhaDoRegistro());
    const { host, responder } = await abrirComReleituraPendente();

    botao(linha(host, 'i1'), 'Confirmar').click();
    await assentar();
    await responder(recusaPeloInterceptor(REGISTRO_NAO_GRAVOU, 503, 'x'));

    expect(itens(host)).toHaveLength(0);
    leituras.mockImplementation(() => of(ok(revisao())));
    botao(host, 'Tentar novamente').click();
    await assentar();

    expect(itens(host)).toHaveLength(4);
  });

  it('um erro inesperado na decisão também deixa a tela sem ação até a releitura', async () => {
    api.confirmar.mockReturnValue(throwError(() => new Error('falha inesperada')));
    const { host, responder } = await abrirComReleituraPendente();

    botao(linha(host, 'i1'), 'Confirmar').click();
    await assentar();

    expect(itens(host)).toHaveLength(0);
    expect(host.textContent).toContain('Não foi possível concluir a decisão');

    await responder(ok(revisao()));
    expect(itens(host)).toHaveLength(4);
  });
});
