import { By } from '@angular/platform-browser';
import { EditorDeCondicoesComponent } from '@uniplus/shared-inscricao/formulario';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usarFase, type ContextoDaFase } from '../fase-passo.testing';
import {
  aAlternativaDaEdicao,
  abrirAFase,
  elementoDe,
  idDe,
  selecionar,
  umaFaseQueHomologa,
  umaRegra,
} from './homologacao-da-fase.testing';

const INEP = 'RESULTADO_NO_RETORNO_DO_INEP';

describe('HomologacaoDaFaseComponent: alternativas e condições', () => {
  let tela: ContextoDaFase;

  usarFase((contexto) => {
    tela = contexto;
  });

  beforeEach(() => {
    document.body.appendChild(tela.nativo);
  });

  afterEach(() => {
    tela.nativo.remove();
  });

  const regraDaFase = () => tela.store.draft().cronograma.fases[0].regraDeHomologacao;
  const clicar = (sufixo: string) => {
    elementoDe(tela.nativo, sufixo).click();
    tela.detectar();
  };
  const editores = () => tela.elementoDaTela.queryAll(By.directive(EditorDeCondicoesComponent));
  const emFoco = () => document.activeElement?.id;
  const comAsAlternativas = (...edicoes: readonly number[]) =>
    umaFaseQueHomologa({
      regraDeHomologacao: umaRegra({
        alternativas: edicoes.map((ano) => aAlternativaDaEdicao(ano)),
      }),
    });
  const removerPeloRotulo = (rotulo: string) => {
    tela.nativo.querySelector<HTMLButtonElement>(`[aria-label="${rotulo}"]`)?.click();
    tela.detectar();
  };

  /** O que o editor do enquadramento devolve quando a pessoa cita a edição do exame. */
  const citarAEdicao = (posicao: number, ano: number) => {
    editores()[posicao].triggerEventHandler('condicoesChange', [
      { clausula: 1, fato: 'EDICAO_ENEM', operador: 'IGUAL', valor: `"${ano}"` },
    ]);
    tela.detectar();
  };

  /** A condição da edição em foco, o motivo e o enquadramento: o que a pessoa preenche em cada alternativa. */
  const preencherAAlternativaEmFoco = (posicao: number, ano: number) => {
    selecionar(document.activeElement as HTMLSelectElement, String(ano));
    selecionar(
      elementoDe(
        tela.nativo,
        `homologacao-alternativas-${posicao}-condicoes-0-motivoDesfavoravelCodigo`,
      ),
      'SEM_RESULTADO_INEP',
    );
    citarAEdicao(posicao, ano);
  };

  it('monta as três alternativas da Medicina, uma por edição, sem sair do teclado entre uma e outra', async () => {
    const edicoes = [2024, 2025, 2026];
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: umaRegra() }));

    edicoes.forEach((ano, posicao) => {
      clicar('homologacao-incluir-alternativa');
      expect(emFoco()).toBe(idDe(`homologacao-alternativas-${posicao}-condicoes-0-edicaoDoExame`));
      preencherAAlternativaEmFoco(posicao, ano);
    });

    expect(regraDaFase()?.alternativas).toEqual(
      edicoes.map((ano) => aAlternativaDaEdicao(ano, 'SEM_RESULTADO_INEP')),
    );
  });

  it('lê as três alternativas da Medicina em texto, ligadas por "ou"', async () => {
    await abrirAFase(tela, comAsAlternativas(2024, 2025, 2026));

    const texto = elementoDe(tela.nativo, 'homologacao-texto').textContent ?? '';

    expect(texto.split(', ou ')).toHaveLength(3);
    expect(texto).toContain('edição ENEM 2026');
  });

  it('nomeia cada alternativa e separa as seguintes da anterior com "ou"', async () => {
    await abrirAFase(tela, comAsAlternativas(2024, 2025));

    const legendas = Array.from(
      tela.nativo.querySelectorAll('sel-alternativa-de-homologacao > fieldset > legend'),
    );

    expect(legendas.map((legenda) => legenda.textContent?.trim())).toEqual([
      'Alternativa 1',
      'Alternativa 2',
    ]);
    expect(
      tela.nativo.querySelector('sel-alternativa-de-homologacao:nth-of-type(2) > .field__hint'),
    ).not.toBeNull();
  });

  it('inclui condição na alternativa e leva o foco à edição dela', async () => {
    await abrirAFase(tela, comAsAlternativas(2025));

    clicar('homologacao-alternativas-0-incluir-condicao');

    expect(regraDaFase()?.alternativas[0].condicoes).toHaveLength(2);
    expect(regraDaFase()?.alternativas[0].condicoes[1]).toEqual({
      tipo: INEP,
      edicaoDoExame: null,
      motivoDesfavoravelCodigo: null,
      enquadramento: [],
    });
    expect(emFoco()).toBe(idDe('homologacao-alternativas-0-condicoes-1-edicaoDoExame'));
  });

  it('remove a condição e leva o foco ao botão de incluir condição da alternativa', async () => {
    const duasCondicoes = [
      ...aAlternativaDaEdicao(2024).condicoes,
      ...aAlternativaDaEdicao(2025).condicoes,
    ];
    const regra = umaRegra({ alternativas: [{ condicoes: duasCondicoes }] });
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: regra }));

    removerPeloRotulo('Remover a condição 2 da alternativa 1');

    expect(regraDaFase()?.alternativas[0].condicoes.map((c) => c.edicaoDoExame)).toEqual([2024]);
    expect(emFoco()).toBe(idDe('homologacao-alternativas-0-incluir-condicao'));
  });

  it('faz a alternativa sumir ao perder a última condição e leva o foco ao botão de incluir alternativa', async () => {
    await abrirAFase(tela, comAsAlternativas(2024, 2025));

    removerPeloRotulo('Remover a condição 1 da alternativa 2');

    expect(regraDaFase()?.alternativas).toHaveLength(1);
    expect(emFoco()).toBe(idDe('homologacao-incluir-alternativa'));
  });

  it('remove a alternativa e leva o foco ao botão de incluir alternativa', async () => {
    await abrirAFase(tela, comAsAlternativas(2024, 2025));

    removerPeloRotulo('Remover a alternativa 1');

    expect(regraDaFase()?.alternativas.map((a) => a.condicoes[0].edicaoDoExame)).toEqual([2025]);
    expect(emFoco()).toBe(idDe('homologacao-incluir-alternativa'));
  });

  it('passa ao editor o enquadramento da condição e grava o que ele devolve', async () => {
    await abrirAFase(tela, comAsAlternativas(2024));
    const fatosDoEditor = editores()[0].componentInstance.fatos() as { codigo: string }[];

    expect(editores()[0].componentInstance.condicoes()).toHaveLength(1);
    expect(fatosDoEditor.map((fato) => fato.codigo)).toEqual(['EDICAO_ENEM']);

    editores()[0].triggerEventHandler('condicoesChange', []);

    expect(regraDaFase()?.alternativas[0].condicoes[0].enquadramento).toEqual([]);
  });

  it('oferece como valores do fato da edição as edições que o processo declara', async () => {
    await abrirAFase(tela, comAsAlternativas(2024), { edicoes: ['2024', '2027'] });

    const [fato] = editores()[0].componentInstance.fatos();

    expect(fato.valores).toEqual(['2024', '2027']);
  });

  it('trava a inclusão e a remoção quando o cronograma não aceita edição', async () => {
    await abrirAFase(tela, comAsAlternativas(2024));
    tela.componente.formulario()?.disable();
    tela.store.salvando.set(true);
    tela.detectar();

    const botoes = Array.from(
      tela.nativo.querySelectorAll<HTMLButtonElement>('sel-homologacao-da-fase button'),
    );

    expect(botoes.length).toBeGreaterThan(0);
    expect(
      botoes.filter((botao) => !botao.disabled && !botao.closest('insc-editor-de-condicoes')),
    ).toEqual([]);
  });
});
