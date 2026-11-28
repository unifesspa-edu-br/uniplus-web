/**
 * Por que só uma releitura do processo diz o que a classificação gravada tem, na frase que todo
 * aviso sobre isso começa — sem o ponto, para cada aviso dizer em seguida o que depende dela.
 */
export const MOTIVO_DA_RELEITURA = {
  desconhecida:
    'Não se sabe o que a classificação gravada tem agora, porque a última gravação ficou sem resposta ou a releitura do processo falhou',
  'por-confirmar':
    'O quadro de Peso por Área que a última gravação da classificação congelou no processo ainda não foi confirmado por uma releitura',
} as const;

export type MotivoDaReleitura = keyof typeof MOTIVO_DA_RELEITURA;

const RELEITURA_NA_PUBLICACAO =
  'Não é preciso reler antes de publicar: o sistema relê o processo ao publicar. Se essa leitura falhar e houver critério de desempate por área, a publicação para.';

const O_QUE_FICA_IMPEDIDO =
  'Enquanto o processo não for relido, não é possível confirmar, no passo Desempate, um critério de desempate por área.';

const O_QUE_FAZER =
  'Use "Reler o processo" para conferir agora; este aviso some quando a releitura confirmar o que foi gravado.';

const RELEITURA_QUE_FALHOU =
  'Não foi possível reler o processo agora. Use "Reler o processo" para tentar de novo.';

/**
 * O aviso do quadro ainda não relido, o mesmo na Fórmula e no Desempate: o motivo, o que não fica
 * impedido, o que fica e o que fazer. Com a última releitura falha, ela vem à frente.
 */
export function avisoDaReleitura(motivo: MotivoDaReleitura, releituraFalhou: boolean): string {
  const aviso = [
    `${MOTIVO_DA_RELEITURA[motivo]}.`,
    RELEITURA_NA_PUBLICACAO,
    O_QUE_FICA_IMPEDIDO,
    O_QUE_FAZER,
  ].join(' ');
  return releituraFalhou ? `${RELEITURA_QUE_FALHOU} ${aviso}` : aviso;
}
