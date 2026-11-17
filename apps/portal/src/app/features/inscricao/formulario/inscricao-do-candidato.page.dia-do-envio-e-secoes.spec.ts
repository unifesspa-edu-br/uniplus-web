import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FormularioRenderizavelDto } from '@uniplus/shared-data/selecao';
import { passarOTempo } from '@uniplus/shared-testing';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import {
  inscricao,
  RESPONDIDA,
  botao,
  indisponivel,
  campoDe,
  CenarioDaInscricao,
} from './inscricao-do-candidato.page.testing';

/** De 23h50 à meia-noite no fuso do envio. */
const ATE_A_MEIA_NOITE_MS = 10 * 60 * 1_000;

describe('InscricaoDoCandidatoPage', () => {
  let cenario: CenarioDaInscricao;

  beforeEach(() => {
    cenario = CenarioDaInscricao.preparar();
  });

  afterEach(() => {
    cenario.encerrar();
  });

  /** A data de nascimento até o dia do envio, como o conjunto básico a declara. */
  const comNascimentoAteOEnvio = (): FormularioRenderizavelDto => ({
    ...FORMULARIO_DE_INSCRICAO_MOCK,
    regras: {
      ...FORMULARIO_DE_INSCRICAO_MOCK.regras,
      etapas: FORMULARIO_DE_INSCRICAO_MOCK.regras.etapas.map((etapa) => ({
        ...etapa,
        itens: etapa.itens.map((item) =>
          item.fatoCodigo === 'DATA_NASCIMENTO'
            ? {
                ...item,
                restricoes: [
                  {
                    tipo: 'FAIXA_DE_DATA',
                    minimo: null,
                    maximo: null,
                    entradas: null,
                    fatos: null,
                    dataMinima: null,
                    dataMaxima: { ancora: 'ENVIO', data: null, anos: 0, dias: 0 },
                  },
                ],
              }
            : item,
        ),
      })),
    },
  });

  it('o limite contado do envio anda um dia quando a meia-noite do fuso do envio passa', async () => {
    cenario.agora = new Date('2026-12-12T02:50:00Z'); // 23h50 de 11/12 em Belém
    cenario.servico.formulario = comNascimentoAteOEnvio();
    const tela = await cenario.abrir();
    expect(campoDe(tela, 'DATA_NASCIMENTO').getAttribute('max')).toBe('2026-12-11');

    cenario.agora = new Date('2026-12-12T03:00:01Z'); // 00h00 de 12/12 em Belém
    await passarOTempo(ATE_A_MEIA_NOITE_MS);
    cenario.fixture.detectChanges();

    expect(campoDe(tela, 'DATA_NASCIMENTO').getAttribute('max')).toBe('2026-12-12');
  });

  it('a aba que volta ao primeiro plano confere o dia, mesmo com o timer atrasado', async () => {
    cenario.agora = new Date('2026-12-12T02:50:00Z');
    cenario.servico.formulario = comNascimentoAteOEnvio();
    const tela = await cenario.abrir();

    cenario.agora = new Date('2026-12-12T09:00:00Z');
    document.dispatchEvent(new Event('visibilitychange'));
    cenario.fixture.detectChanges();

    expect(campoDe(tela, 'DATA_NASCIMENTO').getAttribute('max')).toBe('2026-12-12');
  });

  it('a última seção não oferece concluir: a ação final é enviar a inscrição', async () => {
    const tela = await cenario.abrir();
    const secoes = tela.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Seções do formulário"] button',
    );

    await cenario.clicar(secoes[secoes.length - 1]);

    expect(botao(tela, 'Concluir a seção')).toBeUndefined();
    expect(botao(tela, 'Seção anterior')).toBeDefined();
    expect(botao(tela, 'Enviar inscrição')).toBeDefined();
  });

  it('o link da seção pendente leva ao primeiro campo a corrigir, sem dar nenhuma seção como concluída', async () => {
    cenario.servico.inscricao = inscricao({ ...RESPONDIDA, respostas: {} });
    const tela = await cenario.abrir();
    const pendente = tela.querySelector('#inscricao-motivo-envio li button') as HTMLElement;

    await cenario.clicar(pendente);
    await passarOTempo(0);

    expect(document.activeElement).toBe(campoDe(tela, 'NOME'));
    expect(
      tela.querySelectorAll('nav[aria-label="Passos da inscrição"] li.is-done, nav li.is-done'),
    ).toHaveLength(0);
    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(true);
  });
});
