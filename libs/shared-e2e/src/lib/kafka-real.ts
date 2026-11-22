import { randomUUID } from 'node:crypto';
import { Kafka, logLevel, type Consumer } from 'kafkajs';
import {
  buscarEsquemaNoRegistro,
  DecodificadorAvro,
  type MensagemDecodificada,
} from './decodificar-avro';

const decodificador = new DecodificadorAvro(buscarEsquemaNoRegistro);

/** Lê desde o início até esgotar o tempo sem mensagem nova. */
export async function lerTopicoDoKafka(
  topico: string,
  esperaMs = 10_000,
): Promise<MensagemDecodificada[]> {
  const brokers = (process.env['E2E_KAFKA_BOOTSTRAP'] ?? 'localhost:9092').split(',');
  const kafka = new Kafka({ clientId: 'uniplus-e2e', brokers, logLevel: logLevel.NOTHING });
  const consumidor = kafka.consumer({ groupId: `e2e-leitura-${randomUUID()}` });
  const mensagens = await new LeituraDoTopico(consumidor, esperaMs).ler(topico);
  const resultado: MensagemDecodificada[] = [];
  for (const bytes of mensagens) resultado.push(await decodificador.decodificar(bytes));
  return resultado;
}

class LeituraDoTopico {
  private readonly mensagens: Buffer[] = [];
  private prazo: ReturnType<typeof setTimeout> | undefined;
  private concluir: (mensagens: Buffer[]) => void = () => undefined;
  private falhar: (erro: Error) => void = () => undefined;

  constructor(
    private readonly consumidor: Consumer,
    private readonly esperaMs: number,
  ) {}

  async ler(topico: string): Promise<Buffer[]> {
    try {
      await this.consumidor.connect();
      await this.consumidor.subscribe({ topic: topico, fromBeginning: true });
      return await this.aguardar();
    } finally {
      await this.consumidor.disconnect();
    }
  }

  private aguardar(): Promise<Buffer[]> {
    return new Promise((resolve, reject) => {
      this.concluir = resolve;
      this.falhar = reject;
      this.consumidor.on(this.consumidor.events.GROUP_JOIN, () => this.reiniciarPrazo());
      this.consumidor.on(this.consumidor.events.CRASH, ({ payload }) =>
        this.encerrarComErro(payload.error),
      );
      this.consumidor
        .run({ eachMessage: ({ message }) => this.receber(message.value) })
        .catch((erro: Error) => this.encerrarComErro(erro));
    });
  }

  private receber(valor: Buffer | null): Promise<void> {
    if (valor === null) {
      this.encerrarComErro(new Error('Mensagem do Kafka sem valor.'));
      return Promise.resolve();
    }
    this.mensagens.push(valor);
    this.reiniciarPrazo();
    return Promise.resolve();
  }

  private reiniciarPrazo(): void {
    clearTimeout(this.prazo);
    this.prazo = setTimeout(() => this.concluir(this.mensagens), this.esperaMs);
  }

  private encerrarComErro(erro: Error): void {
    clearTimeout(this.prazo);
    this.falhar(erro);
  }
}
