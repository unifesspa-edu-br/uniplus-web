import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import {
  ETAPA_PERSISTIDA,
  ROTA_CLASSIFICACAO,
  componente,
  controller,
  escolherNoSeletor,
  fixture,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from './eliminacao.testing';

const ELIM_NOTA_MINIMA_ETAPA = 'ELIMINACAO_NOTA_MINIMA_ETAPA';
const CODIGO = 'uniplus.selecao.regra_eliminacao.regra_tipo_invalido';
const CODIGO_DO_PROBLEMA = 'uniplus.selecao.validacao';
const BASE_DAS_PAGINAS = 'https://erros.exemplo.unifesspa.edu.br/erros/';

describe('recusa do catálogo junto do seletor da regra de eliminação', () => {
  montarEliminacao();

  const regra = (regraCodigo: string) => ({
    regraCodigo,
    regraVersao: 'v1',
    etapaRef: '',
    notaMinima: '',
    minimo: '',
    areaCodigo: '',
  });
  const raiz = () => fixture.nativeElement as HTMLElement;
  const campo = (id: string) => raiz().querySelector(`#${id}`);

  async function recusarARegra(posicao: number, comPagina = false): Promise<void> {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      regrasEliminacao: [regra('REGRA_A'), regra('REGRA_B'), regra('REGRA_C')],
    });
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: comPagina ? `${BASE_DAS_PAGINAS}${CODIGO_DO_PROBLEMA}` : 'about:blank',
        title: 'Campos inválidos.',
        status: 422,
        code: CODIGO_DO_PROBLEMA,
        traceId: 't',
        errors: [
          {
            field: `regrasEliminacao[${posicao}].regraCodigo`,
            code: CODIGO,
            message: 'Mensagem inventada da regra.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await gravacao;
    fixture.detectChanges();
  }

  it('mantém a região viva montada e vazia antes de qualquer recusa', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', { regrasEliminacao: [regra('REGRA_A')] });
    fixture.detectChanges();

    const regiao = campo('elim-regra-erro-0');
    expect(regiao?.getAttribute('aria-live')).toBe('polite');
    expect(regiao?.getAttribute('aria-atomic')).toBe('true');
    expect(regiao?.textContent?.trim()).toBe('');
    expect(campo('elim-regra-0')?.getAttribute('aria-invalid')).toBeNull();
    expect(campo('elim-regra-0')?.getAttribute('aria-describedby')).toBeNull();
  });

  const texto = (id: string) => campo(id)?.textContent?.trim() ?? '';
  const atributo = (id: string, nome: string) => campo(id)?.getAttribute(nome) ?? null;

  it('mostra a recusa só na regra que a API apontou, com mensagem e código', async () => {
    await recusarARegra(1);

    expect(texto('elim-regra-erro-1')).toContain('Mensagem inventada da regra.');
    expect(texto('elim-regra-erro-1')).toContain(CODIGO);
    expect(texto('elim-regra-erro-0')).toBe('');
    expect(texto('elim-regra-erro-2')).toBe('');
    expect(atributo('elim-regra-1', 'aria-invalid')).toBe('true');
    expect(campo('elim-regra-1')?.classList).toContain('is-invalid');
    expect(atributo('elim-regra-1', 'aria-describedby')).toBe('elim-regra-erro-1');
    expect(['elim-regra-0', 'elim-regra-2'].map((id) => atributo(id, 'aria-invalid'))).toEqual([
      null,
      null,
    ]);
    expect(['elim-regra-0', 'elim-regra-2'].map((id) => atributo(id, 'aria-describedby'))).toEqual([
      null,
      null,
    ]);
  });

  it('mostra o link da página quando a API aponta a página', async () => {
    await recusarARegra(1, true);

    const link = campo('elim-regra-erro-1')?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(`${BASE_DAS_PAGINAS}${CODIGO}`);
  });

  it('não mostra link quando a API não aponta a página', async () => {
    await recusarARegra(1);

    expect(campo('elim-regra-erro-1')?.querySelector('a')).toBeNull();
  });

  it('mantém a recusa quando a etapa muda', async () => {
    await recusarARegra(1);
    store.patchObjectSection('classificacao', {
      regrasEliminacao: [
        regra('REGRA_A'),
        { ...regra(ELIM_NOTA_MINIMA_ETAPA), etapaRef: '' },
        regra('REGRA_C'),
      ],
    });
    fixture.detectChanges();
    escolherNoSeletor('elim-etapa-1', ETAPA_PERSISTIDA.id ?? '');

    expect(campo('elim-regra-erro-1')?.textContent).toContain('Mensagem inventada da regra.');
    expect(campo('elim-regra-1')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('retira a recusa quando a regra é trocada, só a dessa posição', async () => {
    await recusarARegra(1);

    escolherNoSeletor('elim-regra-1', '|');

    expect(campo('elim-regra-erro-1')?.textContent?.trim()).toBe('');
    expect(campo('elim-regra-1')?.getAttribute('aria-invalid')).toBeNull();
    expect(campo('elim-regra-1')?.getAttribute('aria-describedby')).toBeNull();
  });

  it('não repete ids entre as regras', async () => {
    await recusarARegra(1);

    const ids = Array.from(raiz().querySelectorAll('[id]')).map((elemento) => elemento.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('não tem violações de acessibilidade com a recusa visível', async () => {
    await recusarARegra(1, true);

    const resultado = await axe.run(raiz(), { rules: { region: { enabled: false } } });
    expect(resultado.violations).toEqual([]);
  });
});
