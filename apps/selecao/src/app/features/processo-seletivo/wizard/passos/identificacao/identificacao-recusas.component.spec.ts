import {
  type ProcessoSeletivoDto,
  SituacaoDoProcessoSeletivoCodigo,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { tick } from './identificacao-identificador.testing';
import {
  type CenarioDeRecusas,
  montarCenarioDeRecusas,
  EM_USO,
  IDENTIFICADOR,
  IDENTIFICADOR_DE_MARLENE,
  LOCALIDADE,
  MENSAGEM_DA_LOCALIDADE,
  MENSAGEM_DA_ORIGEM,
  MENSAGEM_DA_UNIDADE,
  MENSAGEM_DO_IDENTIFICADOR,
  MENSAGEM_DO_NOME,
  MENSAGEM_DO_TIPO,
  NOME,
  NOME_DE_MARLENE,
  ORIGEM,
  TIPO,
  UNIDADE,
  URL_DA_CRIACAO,
  recusa,
  type Causa,
} from './identificacao-recusas.testing';

describe('Recusas da criação do processo junto de cada campo', () => {
  let cenario: CenarioDeRecusas;

  beforeEach(async () => {
    cenario = await montarCenarioDeRecusas();
  });

  afterEach(() => cenario.controller.verify());

  const campo = (id: string) => cenario.campo(id);
  const recusaDoCampo = (id: string) => cenario.recusaDoCampo(id);
  const ligadoAoCampo = (id: string) => cenario.ligadoAoCampo(id);
  const criarRecusado = (...args: Parameters<CenarioDeRecusas['criarRecusado']>) =>
    cenario.criarRecusado(...args);

  it('mostra duas recusas cada uma junto do seu campo e as duas no resumo', async () => {
    const resultado = await criarRecusado(422, [NOME, ORIGEM]);

    expect(recusaDoCampo('f-nome')).toBe(MENSAGEM_DO_NOME);
    expect(recusaDoCampo('f-origem')).toBe(MENSAGEM_DA_ORIGEM);
    expect(campo('f-nome').getAttribute('aria-invalid')).toBe('true');
    expect(campo('f-origem').getAttribute('aria-invalid')).toBe('true');
    expect(ligadoAoCampo('f-nome')).toBe(true);
    expect(ligadoAoCampo('f-origem')).toBe(true);
    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toEqual([MENSAGEM_DO_NOME, MENSAGEM_DA_ORIGEM]);
    expect(campo('f-unidade').getAttribute('aria-invalid')).toBeNull();
  });

  it('mostra o identificador junto do campo mesmo em terceiro lugar da lista', async () => {
    await criarRecusado(422, [NOME, ORIGEM, IDENTIFICADOR]);

    expect(recusaDoCampo('f-identificador')).toBe(MENSAGEM_DO_IDENTIFICADOR);
    expect(campo('f-identificador').getAttribute('aria-invalid')).toBe('true');
    expect(ligadoAoCampo('f-identificador')).toBe(true);
    expect(recusaDoCampo('f-nome')).toBe(MENSAGEM_DO_NOME);
  });

  it('mostra cada recusa da ordem da API junto do seu campo e a do tipo só no resumo', async () => {
    const lista = [NOME, ORIGEM, IDENTIFICADOR, UNIDADE, LOCALIDADE, TIPO];
    const resultado = await criarRecusado(422, lista);

    expect(recusaDoCampo('f-unidade')).toBe(MENSAGEM_DA_UNIDADE);
    expect(recusaDoCampo('f-localidade')).toBe(MENSAGEM_DA_LOCALIDADE);
    expect(ligadoAoCampo('f-localidade')).toBe(true);
    expect(campo('f-localidade').getAttribute('aria-invalid')).toBe('true');
    expect(campo('f-localidade').classList).toContain('is-invalid');
    expect(resultado.messages).toEqual(lista.map((c) => c.message));
    expect(cenario.gravacao.camposInvalidos().has('tipoProcessoOrigemId')).toBe(false);
    expect([...cenario.gravacao.camposInvalidos()].sort()).toEqual(
      [
        'identificadorLegivel',
        'localidade',
        'nome',
        'origemCandidatos',
        'unidadeAdministradoraId',
      ].sort(),
    );
  });

  it('mostra a recusa de um dado de outro passo só no resumo', async () => {
    const resultado = await criarRecusado(422, [TIPO]);

    expect(resultado.messages).toEqual([MENSAGEM_DO_TIPO]);
    expect(cenario.gravacao.camposInvalidos().size).toBe(0);
    expect(cenario.gravacao.errosDosCampos().size).toBe(0);
    expect(cenario.host.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it('mantém a recusa de uma só causa em um campo e uma mensagem', async () => {
    const resultado = await criarRecusado(422, [NOME]);

    expect(recusaDoCampo('f-nome')).toBe(MENSAGEM_DO_NOME);
    expect(resultado.messages).toEqual([MENSAGEM_DO_NOME]);
  });

  it('mostra o uso do identificador, como única recusa, junto do campo dele', async () => {
    const uso = { code: EM_USO, message: 'O identificador legível já é usado.' };
    const resultado = await criarRecusado(409, [{ field: 'identificadorLegivel', ...uso }]);

    expect(recusaDoCampo('f-identificador')).toBe(uso.message);
    expect(campo('f-identificador').getAttribute('aria-invalid')).toBe('true');
    expect(resultado.messages).toEqual([uso.message]);
  });

  it('mostra junto do campo cada código da mesma mensagem e no resumo a mensagem uma só vez', async () => {
    const repetida: Causa = { ...NOME, code: 'validacao.tamanho' };
    const resultado = await criarRecusado(422, [NOME, repetida, ORIGEM]);

    expect(resultado.messages).toEqual([MENSAGEM_DO_NOME, MENSAGEM_DA_ORIGEM]);
    expect(recusaDoCampo('f-nome')).toBe(`${MENSAGEM_DO_NOME} ${MENSAGEM_DO_NOME}`);
    expect(cenario.codigosDoCampo('f-nome')).toEqual([NOME.code, repetida.code]);
  });

  it('não repete junto do campo a causa de mesma mensagem e mesmo código', async () => {
    const resultado = await criarRecusado(422, [NOME, { ...NOME }]);

    expect(cenario.codigosDoCampo('f-nome')).toEqual([NOME.code]);
    expect(resultado.messages).toEqual([MENSAGEM_DO_NOME]);
  });

  it('lista no resumo, na ordem recebida, a causa geral intercalada e a mensagem repetida uma só vez', async () => {
    const geral: Causa = { code: 'validacao.geral', message: 'Revise os dados do processo.' };
    const repetidaDoNome: Causa = { code: 'validacao.geral', message: MENSAGEM_DO_NOME };
    const resultado = await criarRecusado(422, [NOME, geral, ORIGEM, repetidaDoNome]);

    expect(resultado.messages).toEqual([MENSAGEM_DO_NOME, geral.message, MENSAGEM_DA_ORIGEM]);
    expect(recusaDoCampo('f-nome')).toBe(MENSAGEM_DO_NOME);
  });

  it('mostra junto do campo a causa do identificador que vem sem campo apontado', async () => {
    const semCampo: Causa = { code: EM_USO, message: 'O identificador legível já é usado.' };
    const resultado = await criarRecusado(422, [NOME, semCampo]);

    expect(recusaDoCampo('f-identificador')).toBe(semCampo.message);
    expect(campo('f-identificador').getAttribute('aria-invalid')).toBe('true');
    expect(ligadoAoCampo('f-identificador')).toBe(true);
    expect(recusaDoCampo('f-nome')).toBe(MENSAGEM_DO_NOME);
    expect(resultado.messages).toEqual([MENSAGEM_DO_NOME, semCampo.message]);
  });

  it('leva o foco ao identificador quando a causa sem campo é a única do passo', async () => {
    await criarRecusado(422, [{ code: EM_USO, message: 'O identificador legível já é usado.' }]);

    expect(document.activeElement).toBe(campo('f-identificador'));
  });

  it('anuncia a recusa na região viva que já estava montada', async () => {
    const regiao = campo('f-nome-erro');
    expect(regiao.getAttribute('role')).toBe('alert');
    expect(regiao.textContent?.trim()).toBe('');

    await criarRecusado(422, [NOME, ORIGEM]);

    expect(campo('f-nome-erro')).toBe(regiao);
    expect(regiao.textContent).toContain(MENSAGEM_DO_NOME);
  });

  it('leva o foco ao primeiro campo recusado na ordem da tela', async () => {
    await criarRecusado(422, [ORIGEM, NOME]);

    expect(document.activeElement).toBe(campo('f-nome'));
  });

  it('corrigir o nome retira só a recusa dele', async () => {
    await criarRecusado(422, [NOME, ORIGEM]);

    cenario.componente.form.controls.nome.setValue('Seleção da Marlene 2028');
    cenario.fixture.detectChanges();

    expect(recusaDoCampo('f-nome')).toBe('');
    expect(campo('f-nome').getAttribute('aria-invalid')).toBeNull();
    expect(ligadoAoCampo('f-nome')).toBe(false);
    expect(recusaDoCampo('f-origem')).toBe(MENSAGEM_DA_ORIGEM);
    expect(campo('f-origem').getAttribute('aria-invalid')).toBe('true');
  });

  it('mantém a recusa da origem quando a conferência local passa depois de corrigir só o nome', async () => {
    await criarRecusado(422, [NOME, ORIGEM]);
    cenario.componente.form.controls.nome.setValue('Seleção da Marlene 2028');

    expect(cenario.componente.validar().valid).toBe(true);
    cenario.fixture.detectChanges();

    expect(recusaDoCampo('f-nome')).toBe('');
    expect(recusaDoCampo('f-origem')).toBe(MENSAGEM_DA_ORIGEM);
    expect(campo('f-origem').getAttribute('aria-invalid')).toBe('true');
    expect(ligadoAoCampo('f-origem')).toBe(true);
  });

  it('substitui todo o conjunto de recusas pela resposta da nova gravação', async () => {
    await criarRecusado(422, [NOME, ORIGEM]);
    cenario.componente.form.controls.nome.setValue('Seleção da Marlene 2028');
    cenario.componente.validar();

    const resultado = await criarRecusado(422, [UNIDADE]);

    expect(recusaDoCampo('f-unidade')).toBe(MENSAGEM_DA_UNIDADE);
    expect(recusaDoCampo('f-origem')).toBe('');
    expect(campo('f-origem').getAttribute('aria-invalid')).toBeNull();
    expect(resultado.messages).toEqual([MENSAGEM_DA_UNIDADE]);
  });

  it('retira a recusa do servidor quando a repetição é aceita sem editar o campo', async () => {
    await criarRecusado(422, [ORIGEM]);
    expect(recusaDoCampo('f-origem')).toBe(MENSAGEM_DA_ORIGEM);

    const aceita = cenario.componente.persistir();
    cenario.controller
      .expectOne(URL_DA_CRIACAO)
      .flush('01960000-0000-7000-0000-0000000005aa', { status: 201, statusText: 'Created' });
    await tick();
    expect((await aceita).valid).toBe(true);
    cenario.fixture.detectChanges();

    expect(recusaDoCampo('f-origem')).toBe('');
    expect(cenario.gravacao.camposInvalidos().size).toBe(0);
  });

  it('retira a recusa do identificador quando o PUT repetido é aceito sem editar o campo', async () => {
    const processoId = '01960000-0000-7000-0000-0000000005aa';
    cenario.store.processoSeletivoId.set(processoId);
    cenario.store.remoteSnapshot.set({
      id: processoId,
      situacao: { codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO, rotulo: 'Rascunho' },
      identificadorLegivel: null,
    } as unknown as ProcessoSeletivoDto);
    cenario.fixture.detectChanges();
    const url = `${URL_DA_CRIACAO}/${processoId}/identificador-legivel`;
    const uso = { code: EM_USO, message: 'O identificador legível já é usado.' };

    const recusada = cenario.componente.persistir();
    const { body, opts } = recusa(409, [{ field: 'identificadorLegivel', ...uso }]);
    cenario.controller.expectOne(url).flush(body, opts);
    await tick();
    expect((await recusada).valid).toBe(false);
    expect(
      cenario.gravacao.erroDoCampo('identificadorLegivel')?.recusas.map((r) => r.mensagem),
    ).toEqual([uso.message]);

    const aceita = cenario.componente.persistir();
    cenario.controller.expectOne(url).flush(null, { status: 204, statusText: 'No Content' });
    await tick();

    expect((await aceita).valid).toBe(true);
    expect(cenario.gravacao.erroDoCampo('identificadorLegivel')).toBeNull();
    expect(cenario.gravacao.camposInvalidos().size).toBe(0);
  });

  it('não traz o valor digitado nem o nome interno do campo na mensagem', async () => {
    const resultado = await criarRecusado(422, [NOME, IDENTIFICADOR]);

    const exibido = [recusaDoCampo('f-nome'), recusaDoCampo('f-identificador')];
    const textos = [...exibido, ...(resultado.messages ?? [])].join(' ');
    expect(textos).not.toContain(NOME_DE_MARLENE);
    expect(textos).not.toContain(IDENTIFICADOR_DE_MARLENE);
    expect(textos).not.toContain('identificadorLegivel');
  });

  it('mostra o título quando a recusa não traz lista nem aponta o identificador', async () => {
    const resultado = cenario.componente.persistir();
    cenario.controller
      .expectOne(URL_DA_CRIACAO)
      .flush(
        { type: 'about:blank', title: 'Falha de validação', status: 422, code: 'x', traceId: 't' },
        { status: 422, statusText: 'x', headers: { 'Content-Type': 'application/problem+json' } },
      );
    await tick();

    expect((await resultado).valid ? [] : (await resultado).messages).toEqual([
      'Falha de validação',
    ]);
    expect(cenario.gravacao.errosDosCampos().size).toBe(0);
  });
});
