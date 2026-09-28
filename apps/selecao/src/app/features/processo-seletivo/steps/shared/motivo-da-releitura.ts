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
