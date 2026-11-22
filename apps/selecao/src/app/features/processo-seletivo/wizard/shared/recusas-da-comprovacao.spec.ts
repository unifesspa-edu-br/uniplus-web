import { describe, expect, it } from 'vitest';

import { recusaDaExigenciaDoServidor } from './orientacao-da-recusa-do-fato';

const casos = [
  ['grupo_sem_itens', 'Acrescente ao menos um item'],
  ['regra_contem_a_si_mesma', 'Informe a equipe responsável'],
  ['grupo_com_fases_diferentes', 'mesma fase'],
  ['quantidade_minima_proibida_quando_exige_todos', 'Retire a quantidade mínima'],
  ['consequencia_proibida_quando_exige_todos', 'Retire a consequência'],
  ['base_legal_proibida_quando_exige_todos', 'Retire a base legal'],
  ['quantidade_minima_de_itens_fora_dos_limites', 'número de itens'],
  ['consequencia_invalida', 'Escolha uma consequência válida'],
  ['base_legal_sem_consequencia', 'Informe a consequência ou retire a base legal'],
  ['documento_obrigatorio', 'Escolha o documento no catálogo'],
  ['forma_invalida', 'Escolha uma forma válida'],
  ['quantidade_minima_de_apresentacoes_invalida', 'entre 1 e 366'],
  ['data_referencia_indevida_para_criterio', 'Retire a data ou altere o critério'],
  ['ocorrencias_esperadas_indevidas_para_criterio', 'Retire a lista ou altere o critério'],
  ['data_referencia_obrigatoria_para_calendario', 'Informe a data de referência'],
  ['ocorrencias_esperadas_vazias', 'ao menos uma ocorrência esperada'],
  ['ocorrencia_sem_identificador', 'Informe todos os identificadores'],
  ['ocorrencia_com_identificador_repetido', 'identificadores distintos'],
  ['quantidade_minima_diferente_das_ocorrencias', 'Ajuste a quantidade ou a lista'],
  ['criterio_de_distincao_invalido', 'Escolha um critério válido'],
  ['quantidade_minima_excede_calendario', 'Reduza a quantidade'],
  ['remove_vantagem_sem_vantagem_configurada', 'Configure o bônus regional'],
  ['consequencia_incoerente_com_acao_da_vaga', 'Alinhe a consequência'],
  ['documento_proibido_em_grupo', 'item separado'],
  ['itens_proibidos_em_regra_de_documento', 'Retire os itens'],
  ['grupo_para_repeticao_nao_declarado', 'campo “Repetir por”'],
  ['repeticao_dentro_de_repeticao', 'Escolha “Não repete”'],
  ['grupo_com_formularios_diferentes', 'mesmo formulário'],
] as const;

describe('orientação das recusas da comprovação', () => {
  it.each(casos)('orienta a recusa %s', (sufixo, orientacao) => {
    const code = `uniplus.selecao.regra_de_comprovacao.${sufixo}`;
    expect(recusaDaExigenciaDoServidor({ code, errors: [] })).toContain(orientacao);
  });

  it('usa a primeira recusa reconhecida na ordem recebida', () => {
    const errors = [
      { field: 'regrasDeComprovacao[0]', code: 'desconhecido', message: '' },
      {
        field: 'regrasDeComprovacao[1]',
        code: 'uniplus.selecao.regra_de_comprovacao.grupo_sem_itens',
        message: '',
      },
      {
        field: 'regrasDeComprovacao[2]',
        code: 'uniplus.selecao.regra_de_comprovacao.documento_obrigatorio',
        message: '',
      },
    ];
    expect(recusaDaExigenciaDoServidor({ code: 'uniplus.validacao', errors })).toContain(
      'Acrescente ao menos um item',
    );
  });
});

const outrasRecusas = [
  ['base_legal_da_comprovacao.referencia_obrigatoria', 'referência da norma'],
  ['base_legal_da_comprovacao.abrangencia_obrigatoria', 'abrangência da base legal'],
  ['base_legal_da_comprovacao.situacao_obrigatoria', 'situação da base legal'],
  ['avaliacao_da_comprovacao.documento_referenciado_mais_de_uma_vez', 'única regra'],
  ['avaliacao_da_comprovacao.ocorrencia_do_grupo_invalida', 'Corrija os identificadores'],
  ['avaliacao_da_comprovacao.regra_sem_documento', 'Associe uma exigência documental'],
] as const;

it.each(outrasRecusas)('orienta a recusa %s', (sufixo, orientacao) => {
  expect(recusaDaExigenciaDoServidor({ code: `uniplus.selecao.${sufixo}`, errors: [] })).toContain(
    orientacao,
  );
});
