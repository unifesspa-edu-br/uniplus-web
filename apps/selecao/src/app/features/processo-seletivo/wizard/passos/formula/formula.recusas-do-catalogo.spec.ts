import type { ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ROTA_CLASSIFICACAO,
  componente as eliminacao,
  controller,
  montarEliminacao,
  prepararClassificacaoLocal,
} from '../eliminacao/eliminacao.testing';
import type { FormulaPassoComponent } from './formula.component';
import { montarFormulaNoEditorDaEliminacao } from './formula.gravacao.testing';

const NAO_ENCONTRADA = 'uniplus.selecao.configuracao_classificacao.regra_nao_encontrada';
const CODIGO_DO_PROBLEMA = 'uniplus.selecao.validacao';
const BASE_DAS_PAGINAS = 'https://exemplo.unifesspa.edu.br/erros/';
const PAGINA = `${BASE_DAS_PAGINAS}${NAO_ENCONTRADA}`;

const SELETORES = {
  regraCalculo: 'f-regra-calculo',
  regraArredondamento: 'f-regra-arredondamento',
  regraOrdemAlocacao: 'f-ordem-alocacao',
} as const;

describe('Fórmula e precisão: recusas do catálogo junto dos seletores', () => {
  montarEliminacao();
  let formula: FormulaPassoComponent;
  let fixture: ComponentFixture<FormulaPassoComponent>;

  beforeEach(() => {
    ({ formula, fixture } = montarFormulaNoEditorDaEliminacao());
    prepararClassificacaoLocal();
    fixture.detectChanges();
  });

  const raiz = () => fixture.nativeElement as HTMLElement;
  const seletor = (id: string) => raiz().querySelector<HTMLSelectElement>(`#${id}`);
  const regiao = (id: string) => raiz().querySelector<HTMLElement>(`#${id}-erro`);

  async function recusar(...campos: { campo: string; mensagem: string }[]) {
    const gravacao = eliminacao.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: `${BASE_DAS_PAGINAS}${CODIGO_DO_PROBLEMA}`,
        title: 'Campos inválidos.',
        status: 422,
        code: CODIGO_DO_PROBLEMA,
        traceId: 'trace-1',
        errors: campos.map(({ campo, mensagem }) => ({
          field: campo,
          code: NAO_ENCONTRADA,
          message: mensagem,
        })),
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

  function escolherEm(id: string, valor: string): void {
    const select = seletor(id);
    if (select === null) throw new Error(`seletor ${id} ausente`);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it.each(Object.values(SELETORES))(
    'a região viva de %s está montada e vazia antes da recusa',
    (id) => {
      const area = regiao(id);

      expect(area).not.toBeNull();
      expect(area?.getAttribute('aria-live')).toBe('polite');
      expect(area?.getAttribute('aria-atomic')).toBe('true');
      expect(area?.textContent?.trim()).toBe('');
      expect(seletor(id)?.hasAttribute('aria-describedby')).toBe(false);
      expect(seletor(id)?.hasAttribute('aria-invalid')).toBe(false);
    },
  );

  it('mostra a mensagem e o código da API junto do seletor, e o descreve', async () => {
    await recusar({ campo: 'regraCalculoCodigo', mensagem: 'A regra Alfa não existe.' });

    const select = seletor(SELETORES.regraCalculo);
    expect(regiao(SELETORES.regraCalculo)?.textContent).toContain('A regra Alfa não existe.');
    expect(regiao(SELETORES.regraCalculo)?.textContent).toContain(NAO_ENCONTRADA);
    expect(select?.getAttribute('aria-invalid')).toBe('true');
    expect(select?.getAttribute('aria-describedby')).toBe(`${SELETORES.regraCalculo}-erro`);
    expect(select?.classList).toContain('is-invalid');
  });

  it('mostra o link da página quando a API a deu', async () => {
    await recusar({ campo: 'regraArredondamentoCodigo', mensagem: 'Recusa Beta.' });

    const link = regiao(SELETORES.regraArredondamento)?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(PAGINA);
    expect(link?.textContent).toContain('Entenda a recusa');
  });

  it('a recusa de um campo não aparece nos outros seletores', async () => {
    await recusar({ campo: 'regraOrdemAlocacaoCodigo', mensagem: 'Recusa Gama.' });

    expect(regiao(SELETORES.regraOrdemAlocacao)?.textContent).toContain('Recusa Gama.');
    for (const id of [SELETORES.regraCalculo, SELETORES.regraArredondamento]) {
      expect(regiao(id)?.textContent?.trim()).toBe('');
      expect(seletor(id)?.hasAttribute('aria-describedby')).toBe(false);
      expect(seletor(id)?.getAttribute('aria-invalid')).toBeNull();
    }
  });

  it('trocar um seletor retira só a recusa dele', async () => {
    await recusar(
      { campo: 'regraArredondamentoCodigo', mensagem: 'Recusa Delta.' },
      { campo: 'regraOrdemAlocacaoCodigo', mensagem: 'Recusa Épsilon.' },
    );

    escolherEm(SELETORES.regraOrdemAlocacao, '|');

    expect(regiao(SELETORES.regraOrdemAlocacao)?.textContent?.trim()).toBe('');
    expect(seletor(SELETORES.regraOrdemAlocacao)?.hasAttribute('aria-describedby')).toBe(false);
    expect(regiao(SELETORES.regraArredondamento)?.textContent).toContain('Recusa Delta.');
  });

  it('trocar a regra de arredondamento mantém a recusa da ordem de alocação', async () => {
    await recusar(
      { campo: 'regraArredondamentoCodigo', mensagem: 'Recusa Delta.' },
      { campo: 'regraOrdemAlocacaoCodigo', mensagem: 'Recusa Épsilon.' },
    );

    escolherEm(SELETORES.regraArredondamento, '|');

    expect(regiao(SELETORES.regraArredondamento)?.textContent?.trim()).toBe('');
    expect(regiao(SELETORES.regraOrdemAlocacao)?.textContent).toContain('Recusa Épsilon.');
  });

  it('trocar a regra de cálculo retira a recusa dela e mantém a da ordem de alocação', async () => {
    await recusar(
      { campo: 'regraCalculoCodigo', mensagem: 'Recusa Zeta.' },
      { campo: 'regraOrdemAlocacaoCodigo', mensagem: 'Recusa Épsilon.' },
    );

    escolherEm(SELETORES.regraCalculo, '|');

    expect(regiao(SELETORES.regraCalculo)?.textContent?.trim()).toBe('');
    expect(regiao(SELETORES.regraOrdemAlocacao)?.textContent).toContain('Recusa Épsilon.');
  });

  it('a troca para a classificação importada retira também a recusa do arredondamento', async () => {
    await recusar(
      { campo: 'regraCalculoCodigo', mensagem: 'Recusa Zeta.' },
      { campo: 'regraArredondamentoCodigo', mensagem: 'Recusa Delta.' },
    );

    formula.escolherRegraCalculo('CLASSIFICACAO_IMPORTADA|1.0');
    formula.escolherRegraCalculo('FORMULA_MEDIA_PONDERADA|1.0');
    fixture.detectChanges();

    expect(regiao(SELETORES.regraArredondamento)?.textContent?.trim()).toBe('');
  });

  it('não tem violações de acessibilidade com as recusas visíveis', async () => {
    await recusar(
      { campo: 'regraCalculoCodigo', mensagem: 'Recusa Zeta.' },
      { campo: 'regraArredondamentoCodigo', mensagem: 'Recusa Delta.' },
      { campo: 'regraOrdemAlocacaoCodigo', mensagem: 'Recusa Épsilon.' },
    );
    document.body.appendChild(raiz());

    const resultado = await axe.run(raiz(), { rules: { region: { enabled: false } } });

    expect(resultado.violations).toEqual([]);
    raiz().remove();
  });
});
