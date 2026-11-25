import { DecidirProtecaoDoCatalogoRequestDecisao } from '@uniplus/shared-data/configuracao';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  Pagina,
  diploma,
  laudo,
  montarPagina,
  pendencia,
  rg,
} from './tipos-documento.testing';
import { apoioDaProtecao, DETALHE } from './tipos-documento.protecao.testing';

const ATOS = (id: string): string => `${ESCRITA}/${id}/protecao/atos`;

describe('TiposDocumentoPage — detalhe e aprovação da proteção de dados', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  const { texto, painel, rodape, botao, abrirDetalhe, ajuste } = apoioDaProtecao(() => p);
  const ato = (extra: object) => ({
    ato: 'SOLICITACAO',
    instante: '2026-10-30T15:00:00Z',
    atorNome: 'Isabella Moura',
    classificacaoProtecao: 'PESSOAL',
    hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    finalidadeTratamento: 'Conferir o documento do candidato.',
    classificacaoRecomendada: null,
    justificativa: null,
    ...extra,
  });

  describe('detalhe', () => {
    it('o nome da linha é um botão nativo com nome acessível, e a linha não é clicável', async () => {
      p = await montarPagina([rg]);
      const alvo = p.nomeDaLinha(rg);

      expect(alvo.tagName).toBe('BUTTON');
      expect(alvo.type).toBe('button');
      expect(alvo.getAttribute('aria-label')).toBe('Ver o detalhe de Registro Geral');
      expect(p.fixture.nativeElement.querySelector('tbody tr').hasAttribute('onclick')).toBe(false);
    });

    it('abre o drawer só de leitura com todos os campos que a consulta devolve', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'SOLICITADA' })] });
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([]);
      await p.propagar();

      expect(p.store.detalheAberto()).toBe(true);
      expect(p.elemento(`${DETALHE} .uni-drawer__title`).textContent?.trim()).toBe(
        'Registro Geral',
      );
      for (const esperado of [
        'RG',
        'Documento de identificação civil.',
        'Identificação',
        'CIN',
        'pdf,jpg',
        '10 MB',
        'Pessoal',
        'Execução de políticas públicas',
        'Conferir o documento do candidato.',
        'Em análise',
        'Cadastrado em',
        '10/06/2026',
      ]) {
        expect(painel(), esperado).toContain(esperado);
      }
      expect(
        p.fixture.nativeElement.querySelector(`${DETALHE} input, ${DETALHE} textarea`),
      ).toBeNull();
    });

    it('"Editar" fecha o detalhe e abre a edição do mesmo tipo', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'APROVADA' })] });
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([]);
      expect(rodape()).toEqual(['Fechar', 'Editar']);

      botao('Editar', `${DETALHE} .form-drawer__footer button`)?.click();
      await p.propagar();

      expect(p.store.detalheAberto()).toBe(false);
      expect(p.edicao.aberto()).toBe(true);
      expect(p.edicao.modo()).toBe('editar');
      expect(p.edicao.form.controls.codigo.value).toBe('RG');
    });

    it('oferece "Aceitar recomendação" só com a recomendação do tipo negado', async () => {
      p = await montarPagina([rg, laudo], { pendencias: [ajuste()] });
      await abrirDetalhe(rg);
      expect(rodape()).toEqual(['Fechar', 'Editar']);
      p.store.detalheAberto.set(false);
      await p.propagar();

      await abrirDetalhe(laudo);
      expect(rodape()).toEqual(['Fechar', 'Aceitar recomendação', 'Editar']);
      expect(painel()).toContain('Classificação recomendada: Pessoal sensível');
      expect(painel()).toContain('Ajuste recomendado');
    });

    it('no tipo devolvido mostra a justificativa e oferece "Editar", sem "Aceitar recomendação"', async () => {
      p = await montarPagina([laudo], {
        pendencias: [
          pendencia(laudo, { situacao: 'DEVOLVIDA', justificativa: 'O laudo traz dado de saúde.' }),
        ],
      });
      await abrirDetalhe(laudo);

      expect(rodape()).toEqual(['Fechar', 'Editar']);
      expect(painel()).toContain('Devolvida');
      expect(painel()).toContain('Justificativa: O laudo traz dado de saúde.');
      expect(painel()).not.toContain('Classificação recomendada');
    });

    it('o tipo sem tamanho máximo, descrição e equivalente mostra o travessão', async () => {
      p = await montarPagina([laudo], { pendencias: [pendencia(laudo, { situacao: 'APROVADA' })] });
      await abrirDetalhe(laudo);
      p.http.expectOne(ATOS(laudo.id)).flush([]);
      await p.propagar();

      const linhas = [...p.fixture.nativeElement.querySelectorAll(`${DETALHE} dl div`)].map(
        (d: HTMLElement) => d.textContent?.replace(/\s+/gu, ''),
      );
      expect(linhas).toContain('Tamanhomáximo—');
      expect(linhas).toContain('Tipoequivalente—');
    });

    it('ao editar o tipo devolvido, o formulário explica a decisão e não oferece o aceite', async () => {
      p = await montarPagina([laudo], {
        pendencias: [
          pendencia(laudo, { situacao: 'DEVOLVIDA', justificativa: 'O laudo traz dado de saúde.' }),
        ],
      });
      await p.abrirEdicao(laudo);

      const aviso = p.elemento('cfg-tipo-documento-avisos').textContent ?? '';
      expect(aviso).toContain('Devolvido pela proteção de dados');
      expect(aviso).toContain('Justificativa: O laudo traz dado de saúde.');
      expect(aviso).not.toContain('Aceitar recomendação');
    });

    it('ao editar o tipo com ajuste recomendado, o formulário cita a classificação e o caminho do aceite', async () => {
      p = await montarPagina([laudo], { pendencias: [ajuste()] });
      await p.abrirEdicao(laudo);

      const aviso = p.elemento('cfg-tipo-documento-avisos').textContent ?? '';
      expect(aviso).toContain('Ajuste recomendado pela proteção de dados');
      expect(aviso).toContain('Pessoal sensível');
      expect(aviso).toContain('use "Aceitar recomendação" no detalhe');
    });

    it('sem a permissão de manter, só consulta e fecha, sem ler o histórico', async () => {
      p = await montarPagina([laudo], { concedidas: [], pendencias: [ajuste()] });
      await abrirDetalhe(laudo);

      p.http.expectNone(ATOS(laudo.id));
      expect(rodape()).toEqual(['Fechar']);
      expect(painel()).not.toContain('Histórico da proteção');
    });

    it('lê os atos só ao abrir o drawer e os mostra em ordem', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'APROVADA' })] });
      p.http.expectNone(ATOS(rg.id));
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([
        ato({}),
        ato({
          ato: DecidirProtecaoDoCatalogoRequestDecisao.AJUSTE_RECOMENDADO,
          atorNome: 'Caroline Ribeiro',
          classificacaoRecomendada: 'SENSIVEL',
          justificativa: 'Há dado de saúde.',
        }),
        ato({ ato: 'ACEITE' }),
      ]);
      await p.propagar();

      const t = painel();
      expect(t).toContain('Histórico da proteção');
      expect(t.indexOf('Solicitação')).toBeLessThan(t.indexOf('Ajuste recomendado'));
      expect(t.indexOf('Ajuste recomendado')).toBeLessThan(t.indexOf('Aceite da recomendação'));
      expect(t).toContain('Caroline Ribeiro');
      expect(t).toContain('Justificativa: Há dado de saúde.');
    });

    it('sem atos diz que o item ainda não passou pela proteção de dados', async () => {
      p = await montarPagina([rg], { pendencias: [pendencia(rg, { situacao: 'PENDENTE' })] });
      await abrirDetalhe();
      p.http.expectOne(ATOS(rg.id)).flush([]);
      await p.propagar();

      expect(painel()).toContain('Este item ainda não passou pela proteção de dados.');
    });
  });

  describe('situação na lista', () => {
    it('diz a situação como texto, e a negativa não traz a classificação na linha', async () => {
      p = await montarPagina([rg, laudo, diploma], {
        pendencias: [ajuste(), pendencia(diploma, { situacao: 'SOLICITADA' })],
      });

      expect(texto()).toContain('Aprovada');
      expect(texto()).toContain('Ajuste recomendado');
      expect(texto()).not.toContain('Classificação recomendada');
      expect(texto()).toContain('Em análise');
    });

    it('quando a leitura da situação falha, não diz "Aprovada" e avisa que não leu', async () => {
      p = await montarPagina([rg], { pendencias: 'falha' });

      expect(texto()).not.toContain('Aprovada');
      expect(texto()).toContain('Não foi possível ler a situação');
    });

    it('releitura que falha depois de uma boa não devolve "Aprovada" ao tipo', async () => {
      p = await montarPagina([laudo], {
        pendencias: [pendencia(laudo, { situacao: 'SOLICITADA' })],
      });
      expect(texto()).toContain('Em análise');

      p.store.aprovacao.carregar();
      p.atenderProtecao('falha');
      await p.propagar();

      expect(texto()).not.toContain('Aprovada');
      expect(p.store.aprovacao.aprovacaoDe(laudo.id)).toBeNull();
      expect(p.store.aprovacao.solicitaveis()).toEqual([]);
    });
  });
});
