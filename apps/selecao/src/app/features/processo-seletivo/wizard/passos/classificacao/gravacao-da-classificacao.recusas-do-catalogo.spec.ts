import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import {
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  componente,
  controller,
  montarEliminacao,
  store,
  prepararClassificacaoLocal,
} from '../eliminacao/eliminacao.testing';
import { recusasDoCorte } from '../eliminacao/recusas-da-eliminacao';
import { GravacaoDaClassificacao } from './gravacao-da-classificacao.service';
import { aceitarGravacao, falharPorRede, recusarGravacao } from './recusa-da-gravacao.testing';

const NAO_ENCONTRADA = 'uniplus.selecao.configuracao_classificacao.regra_nao_encontrada';
const ELIM = 'uniplus.selecao.regra_eliminacao';

interface Erro {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

describe('recusas do catálogo guardadas pela gravação da classificação', () => {
  montarEliminacao();

  async function recusar(errors: readonly Erro[]) {
    const gravacao = componente.persistir();
    recusarGravacao({ title: 'Campos inválidos.', code: 'uniplus.selecao.validacao', errors });
    return gravacao;
  }

  const servico = () => TestBed.inject(GravacaoDaClassificacao);
  const daFormula = (message: string): Erro => ({
    field: 'regraCalculoCodigo',
    code: NAO_ENCONTRADA,
    message,
  });
  const daRegra = (posicao: number, message: string): Erro => ({
    field: `regrasEliminacao[${posicao}].regraCodigo`,
    code: `${ELIM}.regra_tipo_invalido`,
    message,
  });

  /** O servidor responde com `status` e uma lista de causas com campo; no 5xx a tela relê o processo. */
  async function falharComCausas(status: number): Promise<void> {
    const resposta = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        status,
        title: 'Falha.',
        code: 'uniplus.falha',
        errors: [daRegra(0, 'De uma resposta que não é recusa de validação.')],
      },
      { status, statusText: 'Falha', headers: { 'content-type': 'application/problem+json' } },
    );
    if (status >= 500) {
      await aguardarReleitura();
      falharPorRede(ROTA_DETALHE);
    }
    await resposta;
  }

  it('guarda a recusa no controle e a resposta recusada seguinte a substitui', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Primeira recusa.'), daRegra(1, 'Regra um.')]);
    expect(
      servico()
        .recusasDoControle('regraCalculo')
        .map((r) => r.mensagem),
    ).toEqual(['Primeira recusa.']);
    expect(servico().recusasDoControle('regraEliminacao.1')).toHaveLength(1);

    await recusar([{ ...daFormula('Segunda recusa.'), field: 'regraOrdemAlocacaoCodigo' }]);

    expect(servico().recusasDoControle('regraCalculo')).toEqual([]);
    expect(servico().recusasDoControle('regraEliminacao.1')).toEqual([]);
    expect(servico().recusasDoControle('regraOrdemAlocacao')[0].mensagem).toBe('Segunda recusa.');
  });

  it('a gravação aceita limpa todas as recusas do catálogo', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Recusa.'), daRegra(0, 'Da regra.')]);

    const aceita = componente.persistir();
    aceitarGravacao();
    await aceita;

    expect(servico().recusasDoControle('regraCalculo')).toEqual([]);
    expect(servico().recusasDoControle('regraEliminacao.0')).toEqual([]);
  });

  it('esquecer o controle retira só a recusa dele', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Da fórmula.'), daRegra(0, 'Da regra.')]);

    servico().esquecerRecusasDoControle('regraEliminacao.0');

    expect(servico().recusasDoControle('regraEliminacao.0')).toEqual([]);
    expect(servico().recusasDoControle('regraCalculo')).toHaveLength(1);
  });

  it('remover a regra reindexa as recusas das regras seguintes e mantém as da fórmula', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Da fórmula.'), daRegra(0, 'Da zero.'), daRegra(2, 'Da dois.')]);

    servico().removerRecusasDaRegraDeEliminacao(1);

    expect(servico().recusasDoControle('regraEliminacao.0')[0].mensagem).toBe('Da zero.');
    expect(servico().recusasDoControle('regraEliminacao.1')[0].mensagem).toBe('Da dois.');
    expect(servico().recusasDoControle('regraEliminacao.2')).toEqual([]);
    expect(servico().recusasDoControle('regraCalculo')[0].mensagem).toBe('Da fórmula.');
  });

  it('remover a primeira regra apaga a recusa dela e a da terceira vira a da segunda', async () => {
    prepararClassificacaoLocal();
    await recusar([daRegra(0, 'Da zero.'), daRegra(2, 'Da dois.')]);

    servico().removerRecusasDaRegraDeEliminacao(0);

    expect(servico().recusasDoControle('regraEliminacao.0')).toEqual([]);
    expect(servico().recusasDoControle('regraEliminacao.1')[0].mensagem).toBe('Da dois.');
    expect(servico().recusasDoControle('regraEliminacao.2')).toEqual([]);
  });

  it('a falha que não é recusa de validação não apaga a recusa, mesmo com causas; a recusa de validação nova a substitui', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Da fórmula.')]);

    await falharComCausas(403);
    expect(servico().recusasDoControle('regraCalculo')).toHaveLength(1);
    expect(servico().recusasDoControle('regraEliminacao.0')).toEqual([]);

    await recusar([daRegra(0, 'Nova.')]);
    expect(servico().recusasDoControle('regraCalculo')).toEqual([]);
    expect(servico().recusasDoControle('regraEliminacao.0')).toHaveLength(1);
  });

  it('o erro 500 com causas não apaga a recusa', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Da fórmula.')]);

    await falharComCausas(500);

    expect(servico().recusasDoControle('regraCalculo')).toHaveLength(1);
    expect(servico().recusasDoControle('regraEliminacao.0')).toEqual([]);
  });

  it('a falha de rede, sem resposta do servidor, não apaga a recusa', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Da fórmula.')]);

    const pelaRede = componente.persistir();
    falharPorRede(ROTA_CLASSIFICACAO);
    await aguardarReleitura();
    falharPorRede(ROTA_DETALHE);
    await pelaRede;

    expect(servico().recusasDoControle('regraCalculo')).toHaveLength(1);
  });

  it('o campo com caminho prefixado vai ao controle e ao resumo com a posição da regra', async () => {
    prepararClassificacaoLocal();
    const prefixada = {
      ...daRegra(3, 'Mensagem inventada.'),
      field: '$.regrasEliminacao[3].regraCodigo',
    };

    const resultado = await recusar([prefixada]);

    expect(servico().recusasDoControle('regraEliminacao.3')[0].mensagem).toBe(
      'Mensagem inventada.',
    );
    expect(resultado.messages).toEqual(['Regra de eliminação 4: Mensagem inventada.']);
  });

  it('a troca de processo esquece as recusas do catálogo', async () => {
    prepararClassificacaoLocal();
    await recusar([daFormula('Do processo anterior.'), daRegra(0, 'Da regra anterior.')]);

    store.reset();

    expect(servico().recusasDoControle('regraCalculo')).toEqual([]);
    expect(servico().recusasDoControle('regraEliminacao.0')).toEqual([]);
  });

  it('o campo do corte com o sufixo em maiúsculas chega ao controle da área', () => {
    const corte = 'uniplus.selecao.configuracao_classificacao.corte_em_area_fora_do_quadro';

    const recusas = recusasDoCorte([{ field: '$.RegrasEliminacao[2].AreaCodigo', code: corte }]);

    expect([...recusas.keys()]).toEqual(['2.area']);
  });

  it('a recusa com controle continua no resumo, com a mensagem da API e o rótulo do passo', async () => {
    prepararClassificacaoLocal();

    const resultado = await recusar([
      daFormula('Mensagem inventada da regra.'),
      daRegra(1, 'Mensagem inventada da eliminação.'),
    ]);

    expect(resultado.messages).toEqual([
      `Regra de cálculo, no passo ${NOME_DO_PASSO_DA_FORMULA}: Mensagem inventada da regra.`,
      'Regra de eliminação 2: Mensagem inventada da eliminação.',
    ]);
  });

  it.each([
    'etapa_ref_e_nota_minima_obrigatorios',
    'area_e_minimo_obrigatorios',
    'etapa_ref_obrigatorio',
    'parametros_incompativeis_com_regra',
  ])('o parâmetro %s mostra a mensagem que a API deu', async (sufixo) => {
    prepararClassificacaoLocal();

    const resultado = await recusar([
      { field: 'regrasEliminacao[2]', code: `${ELIM}.${sufixo}`, message: 'Texto da API.' },
    ]);

    expect(resultado.messages).toEqual(['Regra de eliminação 3: Texto da API.']);
  });
});
