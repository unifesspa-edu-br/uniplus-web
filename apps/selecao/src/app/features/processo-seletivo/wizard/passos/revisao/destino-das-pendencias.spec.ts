import { describe, expect, it } from 'vitest';

import { PASSOS, RotuloDePasso } from '../../processo-seletivo.data';
import { nomeDoPasso } from './destino-das-pendencias';
import { agruparPorDimensao, comoGruposDaRevisao, rotuloDaDimensao } from './grupos-da-revisao';

describe('destino de cada pendência no painel', () => {
  /** A pendência como o painel a mostra, pela API pública do módulo. */
  function pendente(codigo: string, dimensao: string) {
    const [grupo] = comoGruposDaRevisao(
      agruparPorDimensao([{ codigo, dimensao, mensagem: 'x', ok: false }]),
    );
    return grupo.itens[0];
  }

  /**
   * O rótulo do passo, e não o índice, é o que se afirma aqui: o índice literal já se
   * desalinhou quando "Locais de prova" saiu do wizard, e um teste escrito contra o índice
   * teria acompanhado o erro em vez de apanhá-lo.
   */
  function rotuloDoItem(codigo: string, dimensao: string): string | null {
    const passo = pendente(codigo, dimensao).passo;
    return passo === null ? null : PASSOS[passo.indice].rotulo;
  }

  function orientacaoDoItem(codigo: string, dimensao: string): string | null {
    return pendente(codigo, dimensao).orientacao?.texto ?? null;
  }

  it('leva cada dimensão ao passo que a grava', () => {
    expect(rotuloDoItem('taxa_inscricao_nao_declarada', 'taxa_inscricao')).toBe('Pagamento');
    expect(rotuloDoItem('distribuicao_vagas_ausente', 'distribuicao_vagas')).toBe('Vagas');
    expect(rotuloDoItem('cascata_pendente', 'cascata_remanejamento')).toBe('Vagas');
    expect(rotuloDoItem('cronograma_fases_ausente', 'cronograma')).toBe('Cronograma');
    expect(rotuloDoItem('algoritmo_contagem_prazo_nao_declarado', 'contagem_de_prazos')).toBe(
      'Cronograma',
    );
    expect(rotuloDoItem('classificacao_ausente', 'classificacao')).toBe('Eliminação');
    expect(rotuloDoItem('atendimento_especializado_ausente', 'atendimento_especializado')).toBe(
      'Atend. especial',
    );
  });

  /** A nota máxima da etapa é declarada na própria etapa, no passo do cronograma. */
  it('leva ao cronograma a falta da nota máxima da etapa com nota', () => {
    expect(rotuloDoItem('etapa_com_nota_sem_nota_maxima', 'etapas')).toBe('Cronograma');
    expect(rotuloDaDimensao('etapas')).toBe('Etapas');
  });

  /** Forma, regra, passo e banca da etapa são declarados na própria etapa. */
  it.each([
    'etapa_com_nota_sem_forma_de_avaliacao',
    'etapa_sem_nota_com_forma_de_avaliacao',
    'etapa_humana_sem_regra_de_consolidacao',
    'etapa_humana_sem_passo_do_lancamento',
    'etapa_humana_sem_banca',
  ])('leva ao cronograma a pendência %s', (codigo) => {
    expect(rotuloDoItem(codigo, 'etapas')).toBe('Cronograma');
  });

  /** A exigência documental é declarada na superfície da fase, dentro do passo do cronograma. */
  it('leva ao cronograma a pendência de exigência documental', () => {
    expect(rotuloDoItem('exigencias_base_legal_nao_resolvida', 'exigencias_documentais')).toBe(
      'Cronograma',
    );
  });

  /**
   * Os fatos coletados, as regras de derivação e a âncora da apuração de idade são declarados
   * no formulário de inscrição — antes de ele existir como passo, esta dimensão inteira ficava
   * sem destino e o operador lia a pendência sem ter para onde ir.
   */
  it('leva ao passo Formulários a pendência de coleta de fatos', () => {
    expect(rotuloDoItem('derivacao_fatos_citados_inexistentes', 'coleta_de_fatos')).toBe(
      'Formulários',
    );
    expect(rotuloDoItem('referencia_temporal_ausente_com_gatilho_etario', 'coleta_de_fatos')).toBe(
      'Formulários',
    );
    expect(rotuloDoItem('grafo_dependencia_com_ciclo', 'coleta_de_fatos')).toBe('Formulários');
  });

  /**
   * A decisão é por item, não por dimensão: escolher QUAL fase ancora a apuração da idade é do
   * formulário, mas dar data à fase escolhida é do cronograma. Mandar quem tem fase sem data
   * para o formulário mostraria a âncora já declarada, sem nada a corrigir ali.
   */
  it('manda ao cronograma o que depende da data da fase, e ao atendimento o que depende da oferta', () => {
    expect(rotuloDoItem('referencia_temporal_extremo_da_fase_ausente', 'coleta_de_fatos')).toBe(
      'Cronograma',
    );
    expect(rotuloDoItem('referencia_temporal_fim_inscricao_indisponivel', 'coleta_de_fatos')).toBe(
      'Cronograma',
    );
    expect(rotuloDoItem('fato_coletavel_sem_valores_ofertados', 'coleta_de_fatos')).toBe(
      'Atend. especial',
    );
  });

  /**
   * Os três itens de contagem de prazos que o cronograma não resolve. Antes da decisão por
   * item eles herdavam o passo da dimensão e ofereciam "Ir para Cronograma", onde não há
   * nada sobre calendário, localidade nem fuso.
   */
  it('não oferece passo para o que se resolve fora do wizard, e diz onde se resolve', () => {
    for (const codigo of [
      'calendario_vigente_ausente',
      'localidade_nao_declarada',
      'fuso_institucional_nao_reconhecido',
    ]) {
      expect(rotuloDoItem(codigo, 'contagem_de_prazos')).toBeNull();
      expect(orientacaoDoItem(codigo, 'contagem_de_prazos')).not.toBeNull();
    }

    expect(orientacaoDoItem('calendario_vigente_ausente', 'contagem_de_prazos')).toContain(
      'Configuração',
    );
  });

  describe('pendências do processo ENEM', () => {
    const RESOLUCAO = 'classificacao_resolucao_peso_area_enem_ausente';
    const FORA_DO_QUADRO = 'classificacao_grupo_area_enem_da_oferta_fora_do_quadro';
    const OFERTA_SEM_GRUPO = 'distribuicao_vagas_oferta_sem_grupo_area_enem';
    const DESEMPATE_SEM_QUADRO = 'desempate_area_enem_sem_quadro';
    const DESEMPATE_FORA_DO_QUADRO = 'desempate_area_enem_fora_do_quadro';

    const FORMULA = nomeDoPasso('Fórmula e precisão');
    const VAGAS = nomeDoPasso('Vagas');
    const GRAVADA_COM_A_CLASSIFICACAO = `é gravada quando a classificação é gravada, no passo ${nomeDoPasso('Eliminação')}, ou na publicação do processo, e até lá esta pendência continua aqui.`;
    const REGRAVAR_VAGAS = `e depois regrave o passo ${VAGAS}: o grupo é copiado para o processo quando a distribuição é gravada, e não se atualiza sozinho.`;

    /**
     * A fórmula não grava, e atualizar o checklist não regrava: sem dizer quando a escolha chega
     * ao processo, a pendência que continua vermelha parece uma correção que falhou.
     */
    it('leva a resolução ao passo da fórmula e diz que a escolha vai com a classificação', () => {
      expect(rotuloDoItem(RESOLUCAO, 'classificacao')).toBe('Fórmula e precisão');
      expect(orientacaoDoItem(RESOLUCAO, 'classificacao')).toBe(
        `Escolha a resolução de Peso por Área. A escolha ${GRAVADA_COM_A_CLASSIFICACAO}`,
      );
    });

    /**
     * O servidor confere a cópia do grupo guardada em cada oferta, refeita só quando a
     * distribuição é gravada: a correção é o curso, e o passo Vagas refaz a cópia.
     */
    it('diz as duas metades da correção do grupo fora do quadro, e leva ao passo Vagas', () => {
      expect(rotuloDoItem(FORA_DO_QUADRO, 'classificacao')).toBe('Vagas');
      expect(orientacaoDoItem(FORA_DO_QUADRO, 'classificacao')).toBe(
        `Corrija o grupo de área do ENEM no cadastro do curso, em Configuração, ${REGRAVAR_VAGAS}`,
      );
    });

    /** O grupo é campo do cadastro de cursos, e o processo guarda uma cópia dele. */
    it('diz as duas metades da correção da oferta sem grupo, e leva ao passo Vagas', () => {
      expect(rotuloDoItem(OFERTA_SEM_GRUPO, 'distribuicao_vagas')).toBe('Vagas');
      expect(orientacaoDoItem(OFERTA_SEM_GRUPO, 'distribuicao_vagas')).toBe(
        `Declare o grupo de área do ENEM no cadastro do curso, em Configuração, ${REGRAVAR_VAGAS}`,
      );
    });

    /** Os critérios são da dimensão da classificação, mas quem os grava é o passo Desempate. */
    it('leva os itens de desempate ao passo Desempate, e não ao que grava a classificação', () => {
      for (const codigo of [
        'criterios_desempate_em_excesso',
        'desempate_area_enem_areas_mal_formadas',
        'desempate_area_enem_citada_por_dois_criterios',
        DESEMPATE_SEM_QUADRO,
        DESEMPATE_FORA_DO_QUADRO,
      ]) {
        expect(rotuloDoItem(codigo, 'classificacao'), codigo).toBe('Desempate');
      }
    });

    /**
     * A causa pode estar no critério ou na classificação escolhida na fórmula: retirar o critério
     * grava ao avançar, e a mudança na fórmula vai junto com a classificação, gravada no passo
     * Eliminação ou na publicação.
     */
    it('orienta o critério por área sem quadro a retirar o critério ou ajustar a fórmula', () => {
      expect(orientacaoDoItem(DESEMPATE_SEM_QUADRO, 'classificacao')).toBe(
        `Retire o critério por área, ou declare no passo ${FORMULA} a classificação baseada em ENEM com média ponderada e escolha a resolução de Peso por Área. A mudança na fórmula ${GRAVADA_COM_A_CLASSIFICACAO}`,
      );
    });

    /** O servidor recusa a área fora do quadro também no campo da resolução. */
    it('orienta a área fora do quadro a sair do critério ou a trocar a resolução', () => {
      expect(orientacaoDoItem(DESEMPATE_FORA_DO_QUADRO, 'classificacao')).toBe(
        `Retire a área do critério, ou escolha no passo ${FORMULA} uma resolução de Peso por Área que tenha a área em todos os grupos. A mudança na fórmula ${GRAVADA_COM_A_CLASSIFICACAO}`,
      );
    });

    /**
     * O divisor só é conferido sob a fórmula local do ENEM, e é a soma dos pesos das etapas que
     * compõem a nota, declaradas no cronograma.
     */
    it('leva o divisor da média ao cronograma, onde se declaram as etapas e os pesos', () => {
      expect(rotuloDoItem('classificacao_divisor_media_invalido', 'classificacao')).toBe(
        'Cronograma',
      );
      expect(orientacaoDoItem('classificacao_divisor_media_invalido', 'classificacao')).toBe(
        'Declare ao menos uma etapa classificatória (ou ambas) com peso maior que zero: a média da nota final divide pela soma desses pesos.',
      );
    });

    it('leva as edições do ENEM não declaradas à Fórmula, onde se acrescentam', () => {
      expect(rotuloDoItem('classificacao_edicao_enem_nao_declarada', 'classificacao')).toBe(
        'Fórmula e precisão',
      );
      expect(orientacaoDoItem('classificacao_edicao_enem_nao_declarada', 'classificacao')).toBe(
        `Acrescente as edições do ENEM aceitas. A lista ${GRAVADA_COM_A_CLASSIFICACAO}`,
      );
    });

    it('leva o formulário de inscrição sem o campo da edição do ENEM aos Formulários', () => {
      expect(rotuloDoItem('formulario_inscricao_sem_edicao_enem', 'coleta_de_fatos')).toBe(
        'Formulários',
      );
      expect(orientacaoDoItem('formulario_inscricao_sem_edicao_enem', 'coleta_de_fatos')).toBe(
        'Inclua no formulário de inscrição o campo da edição do ENEM, obrigatório para todo candidato e fora de seção ou campo condicional.',
      );
    });

    it('leva o fato que decide quem recebe o acréscimo ao passo Bônus', () => {
      expect(rotuloDoItem('bonus_regional_fato_de_elegibilidade', 'bonus_regional')).toBe('Bônus');
      expect(orientacaoDoItem('bonus_regional_fato_de_elegibilidade', 'bonus_regional')).toBe(
        'Escolha quem recebe o acréscimo: um campo de sim ou não do formulário de inscrição, fora de grupo, ou um fato que o processo deriva como sim ou não, conhecido até a inscrição e sem depender do que só o formulário de isenção coleta.',
      );
    });

    /** O botão e a orientação chamam o passo pelo mesmo nome. */
    it('nomeia o passo como o botão do painel', () => {
      expect(pendente(RESOLUCAO, 'classificacao').passo?.nome).toBe(FORMULA);
    });
  });

  it('não dá orientação a item cujo passo resolve sozinho', () => {
    expect(orientacaoDoItem('cronograma_fases_ausente', 'cronograma')).toBeNull();
    expect(
      orientacaoDoItem('algoritmo_contagem_prazo_nao_declarado', 'contagem_de_prazos'),
    ).toBeNull();
  });

  /** O código vem do servidor: uma chave herdada de objeto não pode passar por item conhecido. */
  it('não trata como conhecido um código que coincide com propriedade herdada', () => {
    for (const codigo of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(orientacaoDoItem(codigo, 'cronograma')).toBeNull();
      expect(rotuloDoItem(codigo, 'cronograma')).toBe('Cronograma');
      expect(rotuloDoItem('item_desconhecido', codigo)).toBeNull();
    }
  });

  /** O painel nomeia o passo, não a dimensão — é o nome que o operador reconhece na lista. */
  it('nomeia o passo pelo rótulo de revisão', () => {
    function nomeDoPassoDoItem(codigo: string, dimensao: string): string | null {
      return pendente(codigo, dimensao).passo?.nome ?? null;
    }

    expect(nomeDoPassoDoItem('taxa_inscricao_nao_declarada', 'taxa_inscricao')).toBe(
      'Taxa de inscrição',
    );
    expect(nomeDoPassoDoItem('cronograma_fases_ausente', 'cronograma')).toBe('Cronograma e etapas');
  });

  /** Sem destino, a pendência do identificador apareceria na revisão sem botão que a resolva. */
  it('leva o identificador legível ausente ao passo de identificação', () => {
    expect(pendente('identificador_legivel_nao_declarado', 'identificacao').passo?.nome).toBe(
      'Identificação',
    );
    expect(orientacaoDoItem('identificador_legivel_nao_declarado', 'identificacao')).toBeNull();
  });

  /** O rótulo é tipado; um que escape do tipo é defeito de programação e não vira nome vazio. */
  it('falha alto quando o passo pedido não existe', () => {
    expect(() => nomeDoPasso('Passo que não existe' as RotuloDePasso)).toThrow(
      'O passo "Passo que não existe" não existe no wizard.',
    );
  });
});
