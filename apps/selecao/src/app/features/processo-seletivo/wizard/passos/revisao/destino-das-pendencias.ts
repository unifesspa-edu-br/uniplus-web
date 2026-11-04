import { PASSOS, RotuloDePasso } from '../../processo-seletivo.data';
import { CODIGO_ESCALA_DA_NOTA_FINAL_NAO_DECLARADA } from '../classificacao/escala-da-nota-final';

/**
 * Onde o item se resolve: o passo que o botão abre e, quando o botão não basta, o que fazer e
 * onde. Item sem passo tem sempre orientação — sem ela, a pendência apareceria sem saída.
 */
export type DestinoDoItem =
  | { readonly passo: RotuloDePasso; readonly orientacao?: string }
  | { readonly passo: null; readonly orientacao: string };

/**
 * O passo do wizard dono de cada dimensão estrutural, nomeado pelo RÓTULO do passo e não pelo
 * índice: retirar ou reordenar um passo ou o compilador recusa o mapa, ou ele continua certo
 * sozinho. `Map`, e não objeto literal, porque o código da dimensão vem do servidor.
 *
 * Há dimensões cujos itens não caem todos no mesmo passo (`coleta_de_fatos`,
 * `contagem_de_prazos`, `classificacao`); o destino por item, mais abaixo, tem precedência.
 */
const PASSO_POR_DIMENSAO: ReadonlyMap<string, RotuloDePasso> = new Map<string, RotuloDePasso>([
  ['identificacao', 'Identificação'],
  ['taxa_inscricao', 'Pagamento'],
  ['distribuicao_vagas', 'Vagas'],
  ['cascata_remanejamento', 'Vagas'],
  ['cronograma', 'Cronograma'],
  ['exigencias_documentais', 'Cronograma'],
  ['contagem_de_prazos', 'Cronograma'],
  // A classificação inteira — regra de cálculo, precisão e eliminação — é gravada no passo Eliminação.
  ['classificacao', 'Eliminação'],
  ['atendimento_especializado', 'Atend. especial'],
  ['coleta_de_fatos', 'Formulários'],
  ['bonus_regional', 'Bônus'],
  ['desempate', 'Desempate'],
  ['etapas', 'Cronograma'],
]);

/** Cada passo pelo rótulo, com a posição dele e o nome que o painel mostra. */
const PASSO_POR_ROTULO: ReadonlyMap<
  RotuloDePasso,
  { readonly indice: number; readonly nome: string }
> = new Map(PASSOS.map((passo, indice) => [passo.rotulo, { indice, nome: passo.revisao }]));

/**
 * O passo dado pelo rótulo. O rótulo é tipado pela própria lista de passos, então um passo
 * inexistente é defeito de programação: falha alto em vez de devolver um valor que pareça válido.
 */
export function passoPeloRotulo(rotulo: RotuloDePasso): {
  readonly indice: number;
  readonly nome: string;
} {
  const passo = PASSO_POR_ROTULO.get(rotulo);
  if (passo === undefined) throw new Error(`O passo "${rotulo}" não existe no wizard.`);
  return passo;
}

/** O nome do passo, dado pelo rótulo, como o painel o mostra no botão e na orientação. */
export function nomeDoPasso(rotulo: RotuloDePasso): string {
  return passoPeloRotulo(rotulo).nome;
}

/** A mudança feita na fórmula não é gravada pela fórmula: ela vai junto com a classificação. */
const GRAVADA_COM_A_CLASSIFICACAO = `é gravada quando a classificação é gravada, no passo ${nomeDoPasso('Eliminação')}, ou na publicação do processo, e até lá esta pendência continua aqui`;

const REGRAVAR_VAGAS = `e depois regrave o passo ${nomeDoPasso('Vagas')}: o grupo é copiado para o processo quando a distribuição é gravada, e não se atualiza sozinho`;

/**
 * O destino de um item específico, quando o passo dono da dimensão não basta: o item vai para
 * outro passo, não tem passo nenhum, ou precisa dizer o resto da correção.
 *
 * - O calendário de dias úteis é cadastro de outro módulo, a localidade vem do cadastro inicial e
 *   o fuso não reconhecido é defeito de instalação: mandar esses itens para o cronograma seria
 *   oferecer uma saída que não resolve.
 * - A escolha feita na fórmula chega ao processo só quando a classificação é gravada, e
 *   "Atualizar checklist" não grava nada; por isso a orientação diz quando a pendência some.
 * - O grupo de área da oferta é campo do cadastro de cursos, e o servidor confere a cópia dele
 *   guardada em cada oferta, refeita só quando a distribuição de vagas é gravada.
 * - Os critérios de desempate são da dimensão da classificação, mas quem os grava é o passo
 *   Desempate.
 * - O divisor da média é a soma dos pesos das etapas, declarados no cronograma.
 */
const DESTINO_POR_ITEM: ReadonlyMap<string, DestinoDoItem> = new Map<string, DestinoDoItem>([
  ['referencia_temporal_extremo_da_fase_ausente', { passo: 'Cronograma' }],
  ['referencia_temporal_fim_inscricao_indisponivel', { passo: 'Cronograma' }],
  ['fato_coletavel_sem_valores_ofertados', { passo: 'Atend. especial' }],
  [
    'calendario_vigente_ausente',
    {
      passo: null,
      orientacao: 'Cadastre e marque como vigente um calendário de dias úteis, em Configuração.',
    },
  ],
  [
    'localidade_nao_declarada',
    {
      passo: null,
      orientacao:
        'A localidade que rege os prazos vem do cadastro inicial do processo, que esta jornada não reabre.',
    },
  ],
  [
    'fuso_institucional_nao_reconhecido',
    {
      passo: null,
      orientacao:
        'O fuso institucional não foi reconhecido pelo servidor. Acione o suporte técnico.',
    },
  ],
  [
    'classificacao_resolucao_peso_area_enem_ausente',
    {
      passo: 'Fórmula e precisão',
      orientacao: `Escolha a resolução de Peso por Área. A escolha ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
  [
    CODIGO_ESCALA_DA_NOTA_FINAL_NAO_DECLARADA,
    {
      passo: 'Fórmula e precisão',
      orientacao: `Declare a escala da nota final. A escala ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
  [
    'classificacao_edicao_enem_nao_declarada',
    {
      passo: 'Fórmula e precisão',
      orientacao: `Acrescente as edições do ENEM aceitas. A lista ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
  [
    'bonus_regional_fato_de_elegibilidade',
    {
      passo: 'Bônus',
      orientacao:
        'Escolha quem recebe o acréscimo: um campo de sim ou não do formulário de inscrição, fora de grupo, ou um fato que o processo deriva como sim ou não, conhecido até a inscrição e sem depender do que só o formulário de isenção coleta.',
    },
  ],
  [
    'formulario_inscricao_sem_edicao_enem',
    {
      passo: 'Formulários',
      orientacao:
        'Inclua no formulário de inscrição o campo da edição do ENEM, obrigatório para todo candidato e fora de seção ou campo condicional.',
    },
  ],
  [
    'classificacao_grupo_area_enem_da_oferta_fora_do_quadro',
    {
      passo: 'Vagas',
      orientacao: `Corrija o grupo de área do ENEM no cadastro do curso, em Configuração, ${REGRAVAR_VAGAS}.`,
    },
  ],
  [
    'distribuicao_vagas_oferta_sem_grupo_area_enem',
    {
      passo: 'Vagas',
      orientacao: `Declare o grupo de área do ENEM no cadastro do curso, em Configuração, ${REGRAVAR_VAGAS}.`,
    },
  ],
  [
    'classificacao_divisor_media_invalido',
    {
      passo: 'Cronograma',
      orientacao:
        'Declare ao menos uma etapa classificatória (ou ambas) com peso maior que zero: a média da nota final divide pela soma desses pesos.',
    },
  ],
  ['criterios_desempate_em_excesso', { passo: 'Desempate' }],
  ['desempate_area_enem_areas_mal_formadas', { passo: 'Desempate' }],
  ['desempate_area_enem_citada_por_dois_criterios', { passo: 'Desempate' }],
  [
    'desempate_area_enem_sem_quadro',
    {
      passo: 'Desempate',
      orientacao: `Retire o critério por área, ou declare no passo ${nomeDoPasso('Fórmula e precisão')} a classificação baseada em ENEM com média ponderada e escolha a resolução de Peso por Área. A mudança na fórmula ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
  [
    'desempate_area_enem_fora_do_quadro',
    {
      passo: 'Desempate',
      orientacao: `Retire a área do critério, ou escolha no passo ${nomeDoPasso('Fórmula e precisão')} uma resolução de Peso por Área que tenha a área em todos os grupos. A mudança na fórmula ${GRAVADA_COM_A_CLASSIFICACAO}.`,
    },
  ],
]);

/** O destino do item, ou o do passo dono da dimensão; `null` quando nem a dimensão tem passo. */
export function destinoDoItem(codigo: string, dimensao: string): DestinoDoItem | null {
  const doItem = DESTINO_POR_ITEM.get(codigo);
  if (doItem !== undefined) return doItem;
  const passo = PASSO_POR_DIMENSAO.get(dimensao);
  return passo === undefined ? null : { passo };
}
