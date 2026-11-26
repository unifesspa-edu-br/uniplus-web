import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { descricaoDaRegraDeHomologacao } from '../../../shared/homologacao/descricao-da-regra-de-homologacao';
import { fase } from '../fase.testing';
import { usarFase, type ContextoDaFase } from '../fase-passo.testing';
import {
  abrirAFase,
  aAlternativaDaEdicao,
  elementoDe,
  idDe,
  selecionar,
  umaFaseQueHomologa,
  umaRegra,
} from './homologacao-da-fase.testing';

describe('HomologacaoDaFaseComponent', () => {
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

  const secao = () => tela.nativo.querySelector('sel-homologacao-da-fase');
  const regraDaFase = () => tela.store.draft().cronograma.fases[0].regraDeHomologacao;
  const clicar = (sufixo: string) => {
    elementoDe(tela.nativo, sufixo).click();
    tela.detectar();
  };

  /** O botão de remover a regra, ativado como o teclado o faz: foco no botão e acionamento dele. */
  const removerARegraPeloTeclado = () => {
    const botao = secao()?.querySelectorAll<HTMLButtonElement>('.acoes .btn').item(1);
    botao?.focus();
    botao?.click();
    tela.detectar();
  };

  describe('quando a seção aparece', () => {
    it('não aparece na fase que não declara a decisão nem tem a regra', async () => {
      await abrirAFase(tela, fase({}));

      expect(secao()).toBeNull();
    });

    it('aparece na fase que declara a decisão, com o botão de declarar a regra', async () => {
      await abrirAFase(tela, umaFaseQueHomologa());

      expect(secao()?.querySelector('h3')?.textContent).toContain('Homologação das inscrições');
      expect(elementoDe(tela.nativo, 'homologacao-declarar').textContent).toContain(
        'Declarar a regra de homologação das inscrições',
      );
    });

    it('aparece na fase que tem a regra mesmo sem a decisão, com o aviso que leva às decisões', async () => {
      await abrirAFase(tela, fase({ regraDeHomologacao: umaRegra() }));

      expect(secao()?.querySelector('.alert')?.textContent).toContain('não declara essa decisão');
      expect(secao()?.textContent).toContain('Ir para Decisões que esta fase toma');
    });

    it('não depende do código da fase: a decisão declarada basta', async () => {
      await abrirAFase(tela, umaFaseQueHomologa({ codigo: 'AVALIACAO' }));

      expect(secao()).not.toBeNull();
    });

    it('leva o foco do aviso à caixa que declara a decisão', async () => {
      await abrirAFase(tela, fase({ regraDeHomologacao: umaRegra() }));

      secao()?.querySelector<HTMLButtonElement>('.alert button')?.click();

      expect(document.activeElement?.id).toBe(idDe('tipos-de-decisao-HOMOLOGACAO_DAS_INSCRICOES'));
    });
  });

  describe('declarar e remover a regra', () => {
    it('declara a regra sem resultado e sem alternativa, e leva o foco ao resultado', async () => {
      await abrirAFase(tela, umaFaseQueHomologa());

      clicar('homologacao-declarar');

      expect(regraDaFase()).toEqual({ resultadoAtoCodigo: null, alternativas: [] });
      expect(document.activeElement?.id).toBe(idDe('homologacao-resultado'));
    });

    it('remove a regra e leva o foco ao botão de declarar', async () => {
      await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: umaRegra() }));

      removerARegraPeloTeclado();

      expect(regraDaFase()).toBeNull();
      expect(document.activeElement?.id).toBe(idDe('homologacao-declarar'));
    });

    it('leva o foco à caixa da decisão quando a regra era o único motivo de a seção aparecer', async () => {
      await abrirAFase(tela, fase({ regraDeHomologacao: umaRegra() }));

      removerARegraPeloTeclado();

      expect(secao()).toBeNull();
      expect(document.activeElement?.id).toBe(idDe('tipos-de-decisao-HOMOLOGACAO_DAS_INSCRICOES'));
    });
  });

  describe('resultado que publica a lista', () => {
    it('oferece só as publicações da própria fase que têm papel, pelo nome do ato', async () => {
      await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: umaRegra() }));

      const opcoes = elementoDe<HTMLSelectElement>(tela.nativo, 'homologacao-resultado').options;

      expect(Array.from(opcoes).map((opcao) => opcao.textContent?.trim())).toEqual([
        'Selecione o resultado…',
        'Resultado preliminar',
        'Resultado final',
      ]);
    });

    it('aponta o resultado escolhido na regra', async () => {
      await abrirAFase(
        tela,
        umaFaseQueHomologa({ regraDeHomologacao: umaRegra({ resultadoAtoCodigo: null }) }),
      );

      selecionar(elementoDe(tela.nativo, 'homologacao-resultado'), 'RESULTADO_FINAL');

      expect(regraDaFase()?.resultadoAtoCodigo).toBe('RESULTADO_FINAL');
    });

    it('volta o resultado a não apontado ao escolher a opção em branco', async () => {
      await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: umaRegra() }));

      selecionar(elementoDe(tela.nativo, 'homologacao-resultado'), '');

      expect(regraDaFase()?.resultadoAtoCodigo).toBeNull();
    });

    it('mantém visível, marcado, o resultado que a fase deixou de publicar', async () => {
      await abrirAFase(
        tela,
        umaFaseQueHomologa({
          produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
          regraDeHomologacao: umaRegra({ resultadoAtoCodigo: 'RESULTADO_PRELIMINAR' }),
        }),
      );

      const resultado = elementoDe<HTMLSelectElement>(tela.nativo, 'homologacao-resultado');

      expect(resultado.selectedOptions[0].textContent?.trim()).toBe(
        'Resultado preliminar (não publicado por esta fase)',
      );
    });

    it('trava o seletor e explica quando a fase não publica nenhum resultado', async () => {
      await abrirAFase(
        tela,
        umaFaseQueHomologa({
          produtos: [],
          regraDeHomologacao: umaRegra({ resultadoAtoCodigo: null }),
        }),
      );

      const resultado = elementoDe<HTMLSelectElement>(tela.nativo, 'homologacao-resultado');

      expect(resultado.disabled).toBe(true);
      expect(elementoDe(tela.nativo, 'homologacao-resultado-ajuda').textContent).toContain(
        'Esta fase não publica nenhum resultado com papel',
      );
    });
  });

  describe('a regra em texto', () => {
    it('explica a regra vazia: a fase homologa toda inscrição enviada', async () => {
      await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: umaRegra() }));

      expect(elementoDe(tela.nativo, 'homologacao-texto').textContent).toContain(
        'A fase homologa toda inscrição enviada',
      );
    });

    it('lê a regra com "e" entre as condições e "ou" entre as alternativas', async () => {
      const regra = umaRegra({
        alternativas: [aAlternativaDaEdicao(2024), aAlternativaDaEdicao(2025)],
      });
      await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: regra }));

      const texto = elementoDe(tela.nativo, 'homologacao-texto').textContent ?? '';

      expect(texto).toContain(
        'resultado no retorno do INEP na edição ENEM 2024 (para quem Edição do ENEM é 2024), ou resultado no retorno do INEP na edição ENEM 2025',
      );
      expect(descricaoDaRegraDeHomologacao(regra, new Map(), (ano) => `ENEM ${ano}`)).toContain(
        ', ou ',
      );
    });
  });

  describe('em consulta', () => {
    it('só lê: sem campos nem botões, com o resultado, a regra e as condições', async () => {
      const regra = umaRegra({
        alternativas: [aAlternativaDaEdicao(2025, 'SEM_RESULTADO_INEP')],
      });
      await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: regra }), {
        emConsulta: true,
      });

      const leitura = secao()?.textContent ?? '';

      expect(leitura).toContain('Resultado preliminar');
      expect(leitura).toContain('Alternativa 1, condição 1: resultado no retorno do INEP');
      expect(leitura).toContain('Motivo desfavorável: Sem resultado no retorno do INEP.');
      expect(secao()?.querySelector('select, button, input')).toBeNull();
    });

    it('diz que a fase não declara a regra quando ela não existe', async () => {
      await abrirAFase(tela, umaFaseQueHomologa(), { emConsulta: true });

      expect(secao()?.textContent).toContain(
        'A fase não declara a regra de homologação das inscrições',
      );
      expect(secao()?.querySelector('button')).toBeNull();
    });
  });
});
