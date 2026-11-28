import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { tick } from './identificacao-identificador.testing';
import {
  type CenarioDeRecusas,
  montarCenarioDeRecusas,
  BASE_DAS_PAGINAS,
  EM_USO,
  NOME,
  ORIGEM,
  URL_DA_CRIACAO,
  type Causa,
} from './identificacao-recusas.testing';

describe('Código e página das recusas da criação do processo', () => {
  let cenario: CenarioDeRecusas;

  beforeEach(async () => {
    cenario = await montarCenarioDeRecusas();
  });

  afterEach(() => cenario.controller.verify());

  const campo = (id: string) => cenario.campo(id);
  const recusaDoCampo = (id: string) => cenario.recusaDoCampo(id);
  const codigosDoCampo = (id: string) => cenario.codigosDoCampo(id);
  const paginasDoCampo = (id: string) => cenario.paginasDoCampo(id);
  const criarRecusado = (...args: Parameters<CenarioDeRecusas['criarRecusado']>) =>
    cenario.criarRecusado(...args);

  it('mostra junto do campo o código e o link da página quando a API aponta a página', async () => {
    const tipo = `${BASE_DAS_PAGINAS}${NOME.code}`;
    const repetida: Causa = { ...ORIGEM, code: 'validacao.regra' };
    await criarRecusado(422, [NOME, repetida], undefined, tipo);

    expect(codigosDoCampo('f-nome')).toEqual([NOME.code]);
    expect(paginasDoCampo('f-nome')).toEqual([tipo]);
    expect(codigosDoCampo('f-origem')).toEqual([repetida.code]);
    expect(paginasDoCampo('f-origem')).toEqual([`${BASE_DAS_PAGINAS}${repetida.code}`]);
    expect(campo('f-nome-erro').textContent).toContain(`Código: ${NOME.code}`);
  });

  it('mostra o código sem link quando a API não aponta página', async () => {
    await criarRecusado(422, [NOME]);

    expect(codigosDoCampo('f-nome')).toEqual([NOME.code]);
    expect(paginasDoCampo('f-nome')).toEqual([]);
  });

  it('mostra o código do problema e o link na recusa de causa única sem lista', async () => {
    const tipo = `${BASE_DAS_PAGINAS}${EM_USO}`;
    const resultado = cenario.componente.persistir();
    cenario.controller
      .expectOne(URL_DA_CRIACAO)
      .flush(
        { type: tipo, title: 'Identificador em uso', status: 409, code: EM_USO, traceId: 't' },
        { status: 409, statusText: 'x', headers: { 'Content-Type': 'application/problem+json' } },
      );
    await tick();
    await resultado;
    cenario.fixture.detectChanges();

    expect(recusaDoCampo('f-identificador')).toBe('Identificador em uso');
    expect(codigosDoCampo('f-identificador')).toEqual([EM_USO]);
    expect(paginasDoCampo('f-identificador')).toEqual([tipo]);
  });

  it('mostra o código e a página da causa do identificador que vem sem campo', async () => {
    const semCampo: Causa = { code: EM_USO, message: 'O identificador legível já é usado.' };
    await criarRecusado(422, [NOME, semCampo], undefined, `${BASE_DAS_PAGINAS}${NOME.code}`);

    expect(codigosDoCampo('f-identificador')).toEqual([EM_USO]);
    expect(paginasDoCampo('f-identificador')).toEqual([`${BASE_DAS_PAGINAS}${EM_USO}`]);
  });

  it('mostra o erro da conferência local só como texto, sem código nem link', () => {
    cenario.store.patchObjectSection('identificacao', { identificadorLegivel: 'PSIQ 2026' });

    expect(cenario.componente.validar().valid).toBe(false);
    cenario.fixture.detectChanges();

    const regiao = campo('f-identificador-erro');
    expect(regiao.textContent).toMatch(/^\s*O identificador legível deve começar/);
    expect(regiao.querySelector('code')).toBeNull();
    expect(regiao.querySelector('a')).toBeNull();
    expect(regiao.textContent).not.toContain('Código:');
  });

  it('não tem violações de acessibilidade com as recusas visíveis', async () => {
    const tipo = `${BASE_DAS_PAGINAS}${NOME.code}`;
    await criarRecusado(422, [NOME, ORIGEM], undefined, tipo);

    const resultado = await axe.run(cenario.host, { rules: { region: { enabled: false } } });

    expect(resultado.violations).toEqual([]);
  });
});
