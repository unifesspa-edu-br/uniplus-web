export const RECUSAS_DA_COMPROVACAO: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.selecao.regra_de_comprovacao.grupo_sem_itens',
    'O grupo não contém itens. Acrescente ao menos um item.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.regra_contem_a_si_mesma',
    'Uma regra contém a si mesma. Informe a equipe responsável para corrigir a configuração.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.grupo_com_fases_diferentes',
    'Os itens do grupo pertencem a fases diferentes. Escolha a mesma fase para todos.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.quantidade_minima_proibida_quando_exige_todos',
    'O grupo exige todos os itens. Retire a quantidade mínima do grupo.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.consequencia_proibida_quando_exige_todos',
    'O grupo exige todos os itens. Retire a consequência do grupo.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.base_legal_proibida_quando_exige_todos',
    'O grupo exige todos os itens. Retire a base legal do grupo.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.quantidade_minima_de_itens_fora_dos_limites',
    'A quantidade mínima deve estar entre um e o número de itens do grupo.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.consequencia_invalida',
    'A consequência do grupo não é reconhecida. Escolha uma consequência válida.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.base_legal_sem_consequencia',
    'O grupo tem base legal sem consequência. Informe a consequência ou retire a base legal.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.documento_obrigatorio',
    'A regra de documento não informa o documento exigido. Escolha o documento no catálogo.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.forma_invalida',
    'A forma da regra de comprovação não é reconhecida. Escolha uma forma válida.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.quantidade_minima_de_apresentacoes_invalida',
    'A quantidade mínima de apresentações deve estar entre 1 e 366.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.data_referencia_indevida_para_criterio',
    'A data de referência só se aplica à distinção por mês ou ano. Retire a data ou altere o critério.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.ocorrencias_esperadas_indevidas_para_criterio',
    'As ocorrências esperadas exigem distinção por ocorrência. Retire a lista ou altere o critério.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.data_referencia_obrigatoria_para_calendario',
    'Informe a data de referência para distinguir apresentações por mês ou ano.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.ocorrencias_esperadas_vazias',
    'Informe ao menos uma ocorrência esperada ou retire a lista.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.ocorrencia_sem_identificador',
    'Uma ocorrência esperada não tem identificador. Informe todos os identificadores.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.ocorrencia_com_identificador_repetido',
    'Há ocorrências com identificador repetido. Informe identificadores distintos.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.quantidade_minima_diferente_das_ocorrencias',
    'A quantidade mínima difere do número de ocorrências esperadas. Ajuste a quantidade ou a lista.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.criterio_de_distincao_invalido',
    'O critério de distinção não é reconhecido. Escolha um critério válido.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.quantidade_minima_excede_calendario',
    'A quantidade mínima alcança datas anteriores ao calendário. Reduza a quantidade ou escolha outra data.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.remove_vantagem_sem_vantagem_configurada',
    'O grupo remove uma vantagem que não foi configurada. Configure o bônus regional ou escolha outra consequência.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.consequencia_incoerente_com_acao_da_vaga',
    'A consequência do grupo difere da ação da modalidade. Alinhe a consequência ou revise a ação da modalidade.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.documento_proibido_em_grupo',
    'O grupo informa um documento no próprio grupo. Inclua o documento como item separado.',
  ],
  [
    'uniplus.selecao.regra_de_comprovacao.itens_proibidos_em_regra_de_documento',
    'Uma regra de documento contém outros itens. Retire os itens ou escolha um grupo.',
  ],
  [
    'uniplus.selecao.base_legal_da_comprovacao.referencia_obrigatoria',
    'Informe a referência da norma.',
  ],
  [
    'uniplus.selecao.base_legal_da_comprovacao.abrangencia_obrigatoria',
    'Informe a abrangência da base legal.',
  ],
  [
    'uniplus.selecao.base_legal_da_comprovacao.situacao_obrigatoria',
    'Informe a situação da base legal.',
  ],
  [
    'uniplus.selecao.avaliacao_da_comprovacao.documento_referenciado_mais_de_uma_vez',
    'Uma exigência aparece em mais de uma regra. Associe cada exigência a uma única regra de documento.',
  ],
  [
    'uniplus.selecao.avaliacao_da_comprovacao.ocorrencia_do_grupo_invalida',
    'Um registro do grupo não tem identificador válido ou o repete. Corrija os identificadores.',
  ],
  [
    'uniplus.selecao.avaliacao_da_comprovacao.regra_sem_documento',
    'Associe uma exigência documental à regra de documento.',
  ],
]);
