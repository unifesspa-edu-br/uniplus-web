import type { AtoForm } from './tipo-ato-form';

interface Sinalizador {
  readonly controle: keyof AtoForm;
  readonly rotulo: string;
  readonly ajuda: string;
}

interface Declaracao {
  readonly controle: keyof AtoForm;
  readonly legenda: string;
  readonly ajuda: string;
}

export const SINALIZADORES = [
  {
    controle: 'ehResultado',
    rotulo: 'Determina a situação do candidato',
    ajuda:
      'Habilita o ciclo recursal: só um ato assim pode ser publicação preliminar, e sem uma ' +
      'preliminar a etapa não admite recurso.',
  },
  {
    controle: 'congelaConfiguracao',
    rotulo: 'Congela a configuração',
    ajuda: 'O ato produz nova versão congelada. Publicar e retificar exigem um tipo congelante.',
  },
  {
    controle: 'unicoPorObjeto',
    rotulo: 'Único por objeto',
    ajuda: 'O objeto admite um só ato vivo deste tipo.',
  },
  {
    controle: 'efeitoIrreversivel',
    rotulo: 'Efeito irreversível',
    ajuda: 'A publicação não pode ser desfeita.',
  },
] as const satisfies readonly Sinalizador[];

/**
 * Atributos que a API exige declarados: sem valor padrão, o operador responde sim ou não em vez
 * de herdar um "não" que apagaria em silêncio o que o tipo é.
 */
export const DECLARACOES_DE_PUBLICACAO = [
  {
    controle: 'publicavelComoAvulso',
    legenda: 'Pode ser publicado como documento avulso do processo',
    ajuda:
      'Sim para aviso, comunicado e errata. Não para convocação, chamada e resultado, que só ' +
      'são publicados dentro do seu fluxo.',
  },
  {
    controle: 'exigeAtoCorrigido',
    legenda: 'Corrige sempre outro ato',
    ajuda:
      'Sim para a errata: ao publicar, é preciso indicar o ato corrigido e o motivo. Não para ' +
      'os demais tipos.',
  },
] as const satisfies readonly Declaracao[];
