import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { passoPeloRotulo } from '../../revisao/destino-das-pendencias';
import { umMotivoDoCadastro } from '../../../shared/motivos/motivos.testing';
import {
  escolhidoPeloProcesso,
  FORA_DO_PRAZO_NO_CADASTRO,
  SEM_RESULTADO_NO_CADASTRO,
} from '../motivos/motivos-da-fase.testing';
import { ID_AVALIACAO } from '../fase.testing';
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

const CONDICAO = 'homologacao-alternativas-0-condicoes-0';

describe('HomologacaoDaFaseComponent: edição do exame e motivo desfavorável', () => {
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
  const daCondicao = (controle: string) => `${CONDICAO}-${controle}`;
  const opcoes = (controle: string) =>
    Array.from(elementoDe<HTMLSelectElement>(tela.nativo, daCondicao(controle)).options).map(
      (opcao) => opcao.textContent?.trim(),
    );
  const comUmaCondicao = (edicao: number | null, motivo: string | null = null) =>
    umaFaseQueHomologa({
      regraDeHomologacao: umaRegra({
        alternativas: [
          {
            condicoes: [
              {
                ...aAlternativaDaEdicao(edicao ?? 2025, motivo).condicoes[0],
                edicaoDoExame: edicao,
              },
            ],
          },
        ],
      }),
    });

  describe('tipo da condição', () => {
    it('oferece os tipos que a API aceita, pelo rótulo em português', async () => {
      await abrirAFase(tela, comUmaCondicao(2025));

      expect(opcoes('tipo')).toEqual(['Resultado no retorno do INEP']);
    });

    it('mantém visível, pelo código, o tipo que este cliente não conhece', async () => {
      await abrirAFase(
        tela,
        umaFaseQueHomologa({
          regraDeHomologacao: umaRegra({
            alternativas: [
              { condicoes: [{ ...aAlternativaDaEdicao(2025).condicoes[0], tipo: 'TAXA_PAGA' }] },
            ],
          }),
        }),
      );

      expect(opcoes('tipo')).toEqual(['Resultado no retorno do INEP', 'TAXA_PAGA']);
    });
  });

  describe('edição do exame', () => {
    it('é escolhida entre as edições que o processo declara, pelo nome, na ordem declarada', async () => {
      await abrirAFase(tela, comUmaCondicao(null));

      expect(opcoes('edicaoDoExame')).toEqual([
        'Selecione a edição…',
        'ENEM 2024',
        'ENEM 2025',
        'ENEM 2026',
      ]);
    });

    it('grava o ano escolhido como número na condição', async () => {
      await abrirAFase(tela, comUmaCondicao(null));

      selecionar(elementoDe(tela.nativo, daCondicao('edicaoDoExame')), '2026');

      expect(regraDaFase()?.alternativas[0].condicoes[0].edicaoDoExame).toBe(2026);
    });

    it('volta a edição a não escolhida ao escolher a opção em branco', async () => {
      await abrirAFase(tela, comUmaCondicao(2025));

      selecionar(elementoDe(tela.nativo, daCondicao('edicaoDoExame')), '');

      expect(regraDaFase()?.alternativas[0].condicoes[0].edicaoDoExame).toBeNull();
    });

    it('marca a edição escolhida entre as declaradas', async () => {
      await abrirAFase(tela, comUmaCondicao(2025));

      const campo = elementoDe<HTMLSelectElement>(tela.nativo, daCondicao('edicaoDoExame'));

      expect(campo.selectedOptions[0].textContent?.trim()).toBe('ENEM 2025');
      expect(campo.getAttribute('aria-invalid')).toBeNull();
    });

    describe('que o processo deixou de declarar', () => {
      beforeEach(async () => {
        await abrirAFase(tela, comUmaCondicao(2023));
      });

      it('continua na lista, marcada como não declarada', () => {
        const campo = elementoDe<HTMLSelectElement>(tela.nativo, daCondicao('edicaoDoExame'));

        expect(campo.selectedOptions[0].textContent?.trim()).toBe(
          'ENEM 2023 (não declarada pelo processo)',
        );
      });

      it('explica junto ao campo, ligada a ele por aria-describedby', () => {
        const campo = elementoDe(tela.nativo, daCondicao('edicaoDoExame'));
        const mensagem = elementoDe(tela.nativo, daCondicao('edicaoDoExame') + '-erro');

        expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(mensagem.id);
        expect(campo.getAttribute('aria-invalid')).toBe('true');
        expect(mensagem.textContent).toContain(
          'A edição ENEM 2023 não está entre as que o processo declara',
        );
      });

      it('sai da lista ao trocar por uma edição declarada, e a mensagem some', () => {
        selecionar(elementoDe(tela.nativo, daCondicao('edicaoDoExame')), '2024');
        tela.detectar();

        expect(opcoes('edicaoDoExame')).not.toContain('ENEM 2023 (não declarada pelo processo)');
        expect(
          tela.nativo.querySelector(`#${idDe(daCondicao('edicaoDoExame') + '-erro')}`),
        ).toBeNull();
      });
    });

    describe('quando o processo não declara edição nenhuma', () => {
      beforeEach(async () => {
        await abrirAFase(tela, comUmaCondicao(null), { edicoes: [] });
      });

      it('trava a lista e diz onde declarar as edições', () => {
        const campo = elementoDe<HTMLSelectElement>(tela.nativo, daCondicao('edicaoDoExame'));
        const aviso = elementoDe(tela.nativo, 'homologacao-sem-edicoes');

        expect(campo.disabled).toBe(true);
        expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(aviso.id);
        expect(aviso.textContent).toContain(
          'O processo não declarou edições do ENEM. Declare-as no passo Fórmula e precisão.',
        );
      });

      it('leva ao passo Fórmula pelo botão do aviso', () => {
        elementoDe(tela.nativo, 'homologacao-sem-edicoes')
          .querySelector<HTMLButtonElement>('button')
          ?.click();

        expect(tela.store.passoAtual()).toBe(passoPeloRotulo('Fórmula e precisão').indice);
      });
    });

    it('mantém destravada a lista que já tem uma edição escolhida, para poder limpá-la', async () => {
      await abrirAFase(tela, comUmaCondicao(2023), { edicoes: [] });

      expect(elementoDe<HTMLSelectElement>(tela.nativo, daCondicao('edicaoDoExame')).disabled).toBe(
        false,
      );
    });

    it('não mostra o aviso quando o processo declara edições', async () => {
      await abrirAFase(tela, comUmaCondicao(2025));

      expect(tela.nativo.querySelector(`#${idDe('homologacao-sem-edicoes')}`)).toBeNull();
    });
  });

  describe('motivo desfavorável', () => {
    const OUTRO_MOTIVO = umMotivoDoCadastro({
      id: '01960000-0000-7000-0000-0000000000a9',
      codigo: 'DOCUMENTO_ILEGIVEL',
      descricao: 'Documento ilegível.',
    });

    it('oferece só os motivos desfavoráveis que a fase escolheu', async () => {
      await abrirAFase(tela, comUmaCondicao(2025), {
        cadastro: [SEM_RESULTADO_NO_CADASTRO, FORA_DO_PRAZO_NO_CADASTRO],
        escolhidos: [escolhidoPeloProcesso(SEM_RESULTADO_NO_CADASTRO, ID_AVALIACAO)],
      });

      expect(opcoes('motivoDesfavoravelCodigo')).toEqual([
        'Selecione o motivo…',
        'Sem resultado no retorno do INEP.',
      ]);
    });

    it('não oferece o motivo que a fase escolheu para outra fase', async () => {
      await abrirAFase(tela, comUmaCondicao(2025), {
        cadastro: [SEM_RESULTADO_NO_CADASTRO, OUTRO_MOTIVO],
        escolhidos: [
          escolhidoPeloProcesso(SEM_RESULTADO_NO_CADASTRO, ID_AVALIACAO),
          escolhidoPeloProcesso(OUTRO_MOTIVO, 'fase-canonica-de-outra'),
        ],
      });

      expect(opcoes('motivoDesfavoravelCodigo')).not.toContain('Documento ilegível.');
    });

    it('grava na condição o código do motivo escolhido', async () => {
      await abrirAFase(tela, comUmaCondicao(2025));

      selecionar(
        elementoDe(tela.nativo, daCondicao('motivoDesfavoravelCodigo')),
        'SEM_RESULTADO_INEP',
      );

      expect(regraDaFase()?.alternativas[0].condicoes[0].motivoDesfavoravelCodigo).toBe(
        'SEM_RESULTADO_INEP',
      );
    });

    it('manda escolher os motivos em Motivos de decisão quando a fase não escolheu nenhum', async () => {
      await abrirAFase(tela, comUmaCondicao(2025), { escolhidos: [] });

      const campo = elementoDe(tela.nativo, daCondicao('motivoDesfavoravelCodigo'));
      const ajuda = elementoDe(tela.nativo, daCondicao('motivoDesfavoravelCodigo') + '-ajuda');

      expect(ajuda.textContent).toContain('Escolha os motivos desta fase em Motivos de decisão.');
      expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(ajuda.id);
    });

    it('mantém visível, marcado, o motivo apontado que a fase deixou de escolher', async () => {
      await abrirAFase(tela, comUmaCondicao(2025, 'FORA_DO_PRAZO'), {
        escolhidos: [escolhidoPeloProcesso(SEM_RESULTADO_NO_CADASTRO, ID_AVALIACAO)],
      });

      const campo = elementoDe<HTMLSelectElement>(
        tela.nativo,
        daCondicao('motivoDesfavoravelCodigo'),
      );

      expect(campo.selectedOptions[0].textContent?.trim()).toBe(
        'FORA_DO_PRAZO (não escolhido pela fase)',
      );
    });
  });
});
