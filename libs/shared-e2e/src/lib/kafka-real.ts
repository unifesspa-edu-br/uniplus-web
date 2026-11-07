import { execFileSync } from 'node:child_process';

/**
 * Mensagens do tópico lidas com o consumidor do próprio container do Kafka, do início até
 * esgotar o tempo sem mensagem nova.
 */
export function lerTopicoDoKafka(topico: string, esperaMs = 10_000): string[] {
  const saida = execFileSync(
    'docker',
    [
      'exec',
      process.env['E2E_KAFKA_CONTAINER'] ?? 'uniplus-inscricao-kafka-1',
      process.env['E2E_KAFKA_CONSUMER'] ?? '/opt/kafka/bin/kafka-console-consumer.sh',
      '--bootstrap-server',
      process.env['E2E_KAFKA_BOOTSTRAP'] ?? 'kafka:29092',
      '--topic',
      topico,
      '--from-beginning',
      '--timeout-ms',
      String(esperaMs),
    ],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  );
  return saida.split('\n').filter((linha) => linha.trim() !== '');
}
