import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { atenderHistoricosDoDrawer } from '../../shared/protecao-do-catalogo/historicos-do-drawer.testing';
import { trabalha, emManutencao } from './fatos-candidato.fixtures';
import {
  compilarPaginaUmaVez,
  montarPagina,
  problema,
  TIPOS_DO_DADO,
  urlDoFato,
  type Pagina,
} from './fatos-candidato.testing';

const tipos = [
  { codigo: 'OPCAO', rotulo: 'Rótulo de teste da API' },
  { codigo: 'TEXTO', rotulo: 'Outro rótulo da API' },
  { codigo: 'SIM_OU_NAO', rotulo: 'Terceiro rótulo da API' },
];

describe('tipos de dado dos fatos', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    atenderHistoricosDoDrawer(p.http);
    p.http.verify();
  });

  it('mostra os rótulos na ordem da API e filtra para derivado', async () => {
    p = await montarPagina();
    await p.acionar(p.novo());
    const select = p.elemento<HTMLSelectElement>('#cfg-fato-dominio');
    expect(select.getAttribute('aria-busy')).toBe('true');
    p.http.expectOne(TIPOS_DO_DADO).flush(tipos);
    await p.propagar();
    expect([...select.options].slice(1).map((o) => o.textContent?.trim())).toEqual(
      tipos.map((t) => t.rotulo),
    );
    p.edicao.form.controls.tipo.setValue('DERIVADO');
    await p.propagar();
    expect([...select.options].slice(1).map((o) => o.value)).toEqual(['OPCAO', 'SIM_OU_NAO']);
    expect(select.hasAttribute('aria-busy')).toBe(false);
  });

  it('permite tentar de novo e devolve o foco ao campo', async () => {
    p = await montarPagina();
    await p.acionar(p.novo());
    p.http.expectOne(TIPOS_DO_DADO).flush(...problema(500));
    await p.propagar();
    const campo = p.elemento<HTMLSelectElement>('#cfg-fato-dominio');
    expect(campo.closest('label')?.textContent).toContain(
      'Não foi possível carregar os tipos de dado.',
    );
    const botao = campo.closest('label')?.querySelector('button');
    expect(botao).not.toBeNull();
    if (botao) await p.acionar(botao);
    p.http.expectOne(TIPOS_DO_DADO).flush(tipos);
    await p.propagar();
    expect(document.activeElement).toBe(campo);
  });

  it('não repete a leitura ao abrir o formulário de novo', async () => {
    p = await montarPagina();
    await p.acionar(p.novo());
    p.http.expectOne(TIPOS_DO_DADO).flush(tipos);
    await p.propagar();
    p.edicao.fechar();
    await p.propagar();
    await p.acionar(p.novo());
    p.http.expectNone(TIPOS_DO_DADO);
  });

  it('mostra o valor atual da edição enquanto a lista não chega', async () => {
    p = await montarPagina();
    await p.acionar(p.editar(trabalha));
    p.http.expectOne(urlDoFato(trabalha)).flush(emManutencao(trabalha));
    await p.propagar();
    const campo = p.elemento<HTMLSelectElement>('#cfg-fato-def-dominio');
    expect(campo.value).toBe(trabalha.definicao.dominio.codigo);
    expect(campo.selectedOptions[0]?.textContent?.trim()).toBe(trabalha.definicao.dominio.rotulo);
  });
});
