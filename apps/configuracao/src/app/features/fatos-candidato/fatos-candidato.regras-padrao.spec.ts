import { By } from '@angular/platform-browser';
import type { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, describe, expect, it, beforeAll } from 'vitest';
import {
  CATALOGO,
  Pagina,
  corRaca,
  montarPagina,
  problema,
  quilombola,
  sucesso,
  urlDoFato,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';

const perfil = {
  ...corRaca,
  codigo: 'PERFIL',
  origem: 'DERIVADO',
  cardinalidade: 'MULTIVALORADO',
  binding: 'REGRA_DERIVACAO:PERFIL',
  valores: [{ codigo: 'A', descricao: null, ordem: 0, ativo: true, orientacao: null }],
};
const booleano = { ...perfil, dominio: 'BOOLEANO', fonteValores: null, valores: [] };
const REGRAS = `${urlDoFato(perfil)}/regras-padrao`;
const completa = { clausula: 1, fato: 'QUILOMBOLA', operador: 'IGUAL', valor: 'true' };
const semValor = { clausula: 1, fato: 'QUILOMBOLA', operador: 'IGUAL', valor: '' };

describe('FatosCandidatoPage — regras padrão do derivado', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const abrir = async (
    fato: FatoCandidatoDto = perfil,
    catalogo: readonly unknown[] = [quilombola],
  ): Promise<void> => {
    p = await montarPagina([fato]);
    await p.abrirEdicao(fato, fato, catalogo);
  };
  /** O editor de condições é um componente de apresentação: a tela o conduz pelas suas saídas. */
  const editarCondicoes = async (indice: number, condicoes: readonly unknown[]): Promise<void> => {
    const editores = p.fixture.debugElement.queryAll(By.css('ui-editor-de-condicoes'));
    editores[indice].triggerEventHandler('condicoesChange', condicoes);
    await p.propagar();
  };
  const acao = async (rotulo: string): Promise<void> => {
    await p.acionar(p.botaoPeloTexto(rotulo, p.drawerDoFato()) as HTMLButtonElement);
  };
  const contribuicao = (indice: number): HTMLSelectElement =>
    p.drawerDoFato().querySelectorAll<HTMLSelectElement>('cfg-fato-regras select')[indice];

  it('a regra incompleta é barrada na tela, e a completa vai à API com o predicado aninhado', async () => {
    await abrir();
    await acao('Acrescentar regra');

    await acao('Salvar regras');
    p.http.expectNone(REGRAS);
    expect(p.texto('#cfg-fato-regra-0-erro')).toBe('Declare ao menos uma condição.');

    contribuicao(0).value = 'A';
    contribuicao(0).dispatchEvent(new Event('change'));
    await editarCondicoes(0, [completa]);
    await acao('Salvar regras');

    const put = p.http.expectOne(REGRAS);
    expect(put.request.headers.has('Idempotency-Key')).toBe(true);
    expect(put.request.body).toEqual({
      regras: [
        { contribui: 'A', quando: [[{ fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true }]] },
      ],
    });
    put.flush(...sucesso());
    await p.recarregarOFato(perfil);
  });

  it('a regra sem o valor que acrescenta é barrada no fato categórico', async () => {
    await abrir();
    await acao('Acrescentar regra');
    await editarCondicoes(0, [completa]);

    await acao('Salvar regras');

    p.http.expectNone(REGRAS);
    expect(contribuicao(0).getAttribute('aria-invalid')).toBe('true');
    expect(contribuicao(0).getAttribute('aria-describedby')).toBe('cfg-fato-regra-0-erro');
  });

  it('acrescentar o valor que falta não apaga a regra que está sendo montada', async () => {
    const semValores = { ...perfil, valores: [] };
    await abrir(semValores);
    await acao('Acrescentar regra');
    p.digitar('#cfg-fato-novo-valor [formcontrolname="codigo"]', 'B');
    p.submeter('#cfg-fato-novo-valor');
    await p.propagar();

    p.http.expectOne(`${urlDoFato(perfil)}/valores`).flush(...sucesso());
    await p.recarregarOFato({
      ...perfil,
      valores: [{ codigo: 'B', descricao: null, ordem: 0, ativo: true, orientacao: null }],
    });

    expect(p.drawerDoFato().querySelectorAll('ui-editor-de-condicoes')).toHaveLength(1);
  });

  it('a regra salva que cita fato desativado não trava o salvamento das demais', async () => {
    const salva = {
      ...booleano,
      regrasPadrao: [
        { contribui: null, quando: [[{ fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true }]] },
      ],
    };
    await abrir(salva, [{ ...quilombola, ativo: false }]);

    await acao('Salvar regras');

    p.http.expectOne(REGRAS).flush(...sucesso());
    await p.recarregarOFato(salva);
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('sem o catálogo de fatos, as regras avisam e, na nova tentativa que dá certo, o foco vai ao título das regras', async () => {
    p = await montarPagina([perfil]);
    await p.acionar(p.editar(perfil));
    p.http.expectOne(urlDoFato(perfil)).flush(structuredClone(perfil));
    p.http
      .expectOne((r) => r.url === CATALOGO)
      .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.texto()).toContain('Catálogo de fatos não carregado');
    await acao('Tentar novamente');
    p.atenderApoios([quilombola]);
    await p.propagar();
    await p.propagar();
    expect(p.texto()).not.toContain('Catálogo de fatos não carregado');
    expect(document.activeElement).toBe(p.elemento('#cfg-fato-regras'));
  });

  it('o erro da condição não passa para outra depois que a regra é editada', async () => {
    await abrir(booleano);
    await acao('Acrescentar regra');
    await editarCondicoes(0, [semValor, completa]);
    await acao('Salvar regras');
    const editor = () =>
      p.fixture.debugElement.query(By.css('ui-editor-de-condicoes')).componentInstance;
    expect(Object.keys(editor().erros())).toEqual(['0']);

    await editarCondicoes(0, [completa]);

    expect(Object.keys(editor().erros())).toEqual([]);
  });

  it('a regra salva que contribui um valor já desativado o mantém na lista, marcado', async () => {
    const comDesativado = {
      ...perfil,
      valores: [
        { codigo: 'A', descricao: null, ordem: 0, ativo: true, orientacao: null },
        { codigo: 'B', descricao: null, ordem: 1, ativo: false, orientacao: null },
      ],
      regrasPadrao: [
        { contribui: 'B', quando: [[{ fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true }]] },
      ],
    };
    await abrir(comDesativado);

    const opcoes = [...contribuicao(0).options].map((o) => o.textContent?.trim());
    expect(opcoes).toEqual(['Selecione…', 'B (desativado)', 'A']);
    expect(contribuicao(0).value).toBe('B');
  });

  describe('a recusa da API ao salvar as regras', () => {
    const salvarComRecusa = async (corpo: object): Promise<void> => {
      await abrir(booleano);
      await acao('Acrescentar regra');
      await editarCondicoes(0, [completa]);
      await acao('Salvar regras');
      p.http
        .expectOne(REGRAS)
        .flush(...problema(422, { code: 'uniplus.validation_failed', ...corpo }));
      await p.propagar();
    };

    it('a recusa de uma regra aparece junto dela e não vira alerta geral', async () => {
      await salvarComRecusa({
        errors: [{ field: 'regras[0].quando[0][0]', code: 'x', message: 'Condição não aceita.' }],
      });

      expect(p.texto('#cfg-fato-regra-0-erro')).toBe('Condição não aceita.');
      expect(p.texto()).not.toContain('Não foi possível salvar');
    });

    it.each([
      ['de um campo que não é de regra', { errors: [{ field: 'outro', code: 'x', message: 'x' }] }],
      ['sem lista de erros', {}],
    ])('a recusa %s cai no alerta geral', async (_nome, corpo) => {
      await salvarComRecusa(corpo);

      expect(p.existe('#cfg-fato-regra-0-erro')).toBe(false);
      expect(p.texto()).toContain('Não foi possível salvar');
    });
  });

  it('a condição que cita fato fora do catálogo escolhível é conferida pela API, não pela tela', async () => {
    const citaForaDoCatalogo = {
      ...booleano,
      regrasPadrao: [
        { contribui: null, quando: [[{ fato: 'DO_PROCESSO', operador: 'IGUAL', valor: true }]] },
      ],
    };
    await abrir(citaForaDoCatalogo, []);

    await acao('Salvar regras');

    p.http.expectOne(REGRAS).flush(...sucesso());
    await p.recarregarOFato(citaForaDoCatalogo);
  });

  it('o fato que não é derivado por regra não mostra a seção de regras', async () => {
    await abrir(corRaca, []);

    expect(p.texto()).not.toContain('Regras padrão');
  });

  it('remover a regra tira só a escolhida e o texto da seção diz como o derivado vale', async () => {
    await abrir(booleano);
    expect(p.texto()).toContain('O fato vale "sim" quando alguma regra se cumpre.');
    await acao('Acrescentar regra');
    await acao('Acrescentar regra');
    expect(p.drawerDoFato().querySelectorAll('ui-editor-de-condicoes')).toHaveLength(2);

    await acao('Remover a regra 1');

    expect(p.drawerDoFato().querySelectorAll('ui-editor-de-condicoes')).toHaveLength(1);
  });

  it('a falha do servidor (5xx) ao salvar avisa por toast e a recusa 422 mostra o erro na tela', async () => {
    await abrir(booleano);
    await acao('Acrescentar regra');
    await editarCondicoes(0, [completa]);
    await acao('Salvar regras');

    p.http.expectOne(REGRAS).flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.texto()).toContain('Não foi possível salvar');
  });
});
