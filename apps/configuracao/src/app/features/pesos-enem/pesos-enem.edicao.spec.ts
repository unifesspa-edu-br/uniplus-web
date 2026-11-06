import { PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BASE,
  PaginaDeTeste,
  RES_750,
  RES_805,
  areaDo,
  linhas750,
  linhas805,
  pesoDe,
  problem,
} from './pesos-enem.testing';

describe('PesosEnemPage — edição em linha', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_EnterEdit_HabilitaInputsERevelaBarra', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    expect(t.edicao.emEdicao()).toBe(RES_805);
    const form = t.edicao.form();
    expect(form).not.toBeNull();
    expect(form?.controls).toHaveLength(4);
    expect(form?.controls[0]?.controls.grupoCurso.value).toEqual({
      codigo: 'TECNOLOGICA',
      rotulo: 'Tecnológica',
    });

    const barra = t.fixture.nativeElement.querySelector('#grid-pe-bar');
    expect(barra).not.toBeNull();
  });

  it('PesosEnemPage_EnterEdit_OrdenaPelosGruposDaApiMesmoComLinhasForaDeOrdem', async () => {
    // Regressão: a API pode devolver as 4 linhas em qualquer ordem (ex.: id de
    // inserção); o modo edição deve seguir a MESMA ordem do modo leitura
    // (a da lista de grupos), não a ordem crua da resposta.
    const foraDeOrdem = [linhas805[3], linhas805[1], linhas805[0], linhas805[2]].filter(
      (l): l is PesoAreaEnemDto => l !== undefined,
    );
    await t.carregarUmaPagina(foraDeOrdem);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    const ordemObtida = t.edicao.form()?.controls.map((g) => g.controls.grupoCurso.value.codigo);
    expect(ordemObtida).toEqual([
      'TECNOLOGICA',
      'HUMANISTICA_I',
      'HUMANISTICA_II',
      'SAUDE_E_BIOLOGICAS',
    ]);
  });

  it('PesosEnemPage_Cancelar_ReverteSemChamarApiEDevolveFoco', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    areaDo(t.edicao.form()?.controls[0], 'LINGUAGENS').controls.peso.setValue(3);
    t.edicao.cancelar();
    await t.propagate();

    expect(t.edicao.emEdicao()).toBeNull();
    expect(t.edicao.form()).toBeNull();
    // Nenhuma chamada de API disparada pelo cancelamento (o afterEach->verify()
    // garante isso: qualquer request não esperada falharia o teste).
    expect(
      pesoDe(
        t.store.registros().find((l) => l.id === linhas805[0]?.id),
        'LINGUAGENS',
      ),
    ).toBe(1);
  });

  it('PesosEnemPage_Esc_FechaModoEdicaoERestauraValores', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    const grid = t.fixture.nativeElement.querySelector('.pe-grid') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    t.fixture.detectChanges();

    expect(t.edicao.emEdicao()).toBeNull();
  });

  it('PesosEnemPage_EscDuranteEnvio_NaoLimpaSessaoAntesDoForkJoinResolver', async () => {
    // Regressão: o botão Cancelar já fica [disabled]
    // durante o envio, mas o atalho Esc não tinha essa trava — pressionar
    // Esc enquanto o PUT estava em voo limpava editForm()/
    // estadoLinhasEdicao() antes da resposta chegar, e o sucesso posterior
    // não tinha mais onde aplicar os valores salvos.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    t.edicao.salvar();
    await t.propagate();

    const grid = t.fixture.nativeElement.querySelector('.pe-grid') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    t.fixture.detectChanges();

    // Esc não teve efeito: a sessão continua aberta.
    expect(t.edicao.emEdicao()).toBe(RES_805);
    expect(t.edicao.form()).not.toBeNull();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    // Só depois do envio resolver a sessão fecha de fato.
    expect(t.edicao.emEdicao()).toBeNull();
  });

  it('PesosEnemPage_TrocarSessaoDuranteSalvar_NaoTrocaAteEnvioTerminar', async () => {
    // Regressão: trocar de sessão de edição enquanto o
    // forkJoin da sessão atual ainda está em voo permitiria que a resposta
    // tardia (que reaplica editForm()/estadoLinhasEdicao() e pode chamar
    // cancelarEdicao()) fechasse ou corrompesse a sessão nova que o usuário
    // já tinha aberto.
    await t.carregarUmaPagina([...linhas805, ...linhas750]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    t.edicao.salvar();
    await t.propagate();

    // Tenta trocar para outra resolução enquanto o envio está em voo.
    t.edicao.pedirEdicao(RES_750);
    await t.propagate();
    expect(t.edicao.emEdicao()).toBe(RES_805);

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();

    // Só agora, com o envio concluído, a troca de sessão é permitida.
    t.edicao.pedirEdicao(RES_750);
    await t.propagate();
    expect(t.edicao.emEdicao()).toBe(RES_750);
  });

  it('PesosEnemPage_CancelarAposSucessoParcial_AplicaLinhasJaPersistidas', async () => {
    // Regressão: se 1 de 4 PUTs falha e o
    // usuário cancela em vez de reenviar o pendente, o modo leitura não pode
    // voltar a mostrar o valor pré-edição das 3 linhas que JÁ foram salvas —
    // isso ficaria desatualizado até um reload manual da página.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    areaDo(t.edicao.form()?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(
      problem(
        422,
        'uniplus.configuracao.peso_area_enem.peso_excede_maximo',
        'Peso excede o máximo',
      ),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();

    t.edicao.cancelar();
    await t.propagate();

    expect(t.edicao.emEdicao()).toBeNull();
    expect(
      pesoDe(
        t.store.registros().find((l) => l.id === linhas805[0]?.id),
        'MATEMATICA',
      ),
    ).toBe(3.0);
  });

  it('PesosEnemPage_TrocarResolucaoAposSucessoParcial_AplicaLinhasJaPersistidas', async () => {
    // Regressão: trocar diretamente para outra resolução (via confirmação
    // de descarte) sem passar por cancelarEdicao() deixaria as linhas já
    // persistidas na sessão anterior desatualizadas em registros() até um
    // reload manual — mesmo bug do Cancelar, mas pelo caminho de troca de
    // sessão.
    await t.carregarUmaPagina([...linhas805, ...linhas750]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    areaDo(t.edicao.form()?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    t.edicao.salvar();
    await t.propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(
      problem(
        422,
        'uniplus.configuracao.peso_area_enem.peso_excede_maximo',
        'Peso excede o máximo',
      ),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await t.propagate();

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    t.edicao.pedirEdicao(RES_750);
    await t.propagate();
    confirmSpy.mockRestore();

    expect(t.edicao.emEdicao()).toBe(RES_750);
    expect(
      pesoDe(
        t.store.registros().find((l) => l.id === linhas805[0]?.id),
        'MATEMATICA',
      ),
    ).toBe(3.0);
  });

  it('PesosEnemPage_TrocarResolucaoEmEdicaoSuja_PedeConfirmacao', async () => {
    await t.carregarUmaPagina([...linhas805, ...linhas750]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    areaDo(t.edicao.form()?.controls[0], 'LINGUAGENS').controls.peso.setValue(9);
    areaDo(t.edicao.form()?.controls[0], 'LINGUAGENS').controls.peso.markAsDirty();

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    t.edicao.pedirEdicao(RES_750);
    await t.propagate();

    expect(confirmSpy).toHaveBeenCalled();
    expect(t.edicao.emEdicao()).toBe(RES_805);

    confirmSpy.mockReturnValue(true);
    t.edicao.pedirEdicao(RES_750);
    await t.propagate();
    expect(t.edicao.emEdicao()).toBe(RES_750);

    confirmSpy.mockRestore();
  });

  it('PesosEnemPage_AbrirEdicao_FocaOPrimeiroCampoEditavel', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();
    await t.propagate();

    const focado = document.activeElement as HTMLInputElement | null;
    expect(focado?.id).toBe('pe-res-805-2024-g0-a0-peso');
    expect(focado?.readOnly).toBe(false);
  });

  it('PesosEnemPage_SalvarComSucesso_DevolveOFocoAoBotaoDeEditar', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();
    t.edicao.salvar();
    await t.propagate();
    t.fixture.detectChanges();

    const requests = [0, 1, 2, 3].map((i) =>
      t.controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await t.propagate();
    t.fixture.detectChanges();
    await t.propagate();

    expect(t.edicao.emEdicao()).toBeNull();
    expect(document.activeElement?.id).toBe('pe-editar-res-805-2024');
  });
});
