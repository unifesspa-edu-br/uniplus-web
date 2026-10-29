/**
 * Permissões que a interface da Seleção consulta para o cadastro do certame, por persona
 * fictícia do portal. Leandro configura e publica processos e mantém pesos por área; Fernanda não
 * tem nenhuma concessão.
 */
export const PERMISSOES_DO_LEANDRO = [
  'selecao:processos:configurar',
  'selecao:processos:publicar',
  'configuracao:pesos-area-enem:manter',
] as const;
