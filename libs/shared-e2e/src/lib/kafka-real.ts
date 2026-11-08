import { execFileSync } from 'node:child_process';

/**
 * Container do Kafka: `E2E_KAFKA_CONTAINER` ou o único em execução com "kafka" no nome. Zero ou
 * mais de um é erro, porque escolher um deles leria o tópico de outra stack.
 */
function containerDoKafka(): string {
  const informado = process.env['E2E_KAFKA_CONTAINER'];
  if (informado !== undefined && informado !== '') {
    return informado;
  }
  const nomes = execFileSync('docker', ['ps', '--filter', 'name=kafka', '--format', '{{.Names}}'], { encoding: 'utf-8' })
    .split('\n')
    .filter((nome) => nome.trim() !== '');
  if (nomes.length !== 1) {
    throw new Error(
      `Esperava um container do Kafka em execução e achei ${nomes.length}${nomes.length > 0 ? ` (${nomes.join(', ')})` : ''}. Informe E2E_KAFKA_CONTAINER.`,
    );
  }
  return nomes[0];
}

/**
 * Mensagens do tópico lidas com o consumidor do próprio container do Kafka, do início até
 * esgotar o tempo sem mensagem nova. O servidor padrão é o listener do próprio broker, acessível
 * de dentro do container em qualquer stack; `E2E_KAFKA_BOOTSTRAP` o substitui.
 */
export function lerTopicoDoKafka(topico: string, esperaMs = 10_000): string[] {
  const saida = execFileSync(
    'docker',
    [
      'exec',
      containerDoKafka(),
      process.env['E2E_KAFKA_CONSUMER'] ?? '/opt/kafka/bin/kafka-console-consumer.sh',
      '--bootstrap-server',
      process.env['E2E_KAFKA_BOOTSTRAP'] ?? 'localhost:9092',
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
