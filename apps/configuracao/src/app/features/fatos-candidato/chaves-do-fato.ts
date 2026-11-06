import { idempotencyKey } from '@uniplus/shared-core/idempotency';

/** As escritas da edição do fato, cada uma com a própria Idempotency-Key. */
export type AcaoComChave =
  | 'descritivo'
  | 'valor'
  | 'regras'
  | 'reativacao'
  | 'correcao'
  | 'ordem'
  | 'definicao';

const ACOES: readonly AcaoComChave[] = [
  'descritivo',
  'valor',
  'regras',
  'reativacao',
  'correcao',
  'ordem',
  'definicao',
];

/**
 * A API identifica a escrita por método, caminho e chave, e reaproveitar a chave entre duas
 * intenções devolveria a resposta guardada da primeira. A repetição exata da tentativa (erro de
 * rede, 5xx) reusa a chave; outro fato, outro alvo ou outro corpo ganha chave nova.
 */
export class ChavesDeIdempotencia {
  private readonly chaves = new Map<AcaoComChave, string>();
  private readonly intencoes = new Map<AcaoComChave, string>();

  constructor() {
    this.rotacionarTodas();
  }

  /** A chave da ação para esta intenção, sobre este fato. */
  de(acao: AcaoComChave, fatoId: string, intencao = ''): string {
    const alvo = `${fatoId}|${intencao}`;
    if (this.intencoes.get(acao) !== alvo) {
      this.chaves.set(acao, idempotencyKey.create());
      this.intencoes.set(acao, alvo);
    }
    return this.chaves.get(acao) as string;
  }

  rotacionar(acao: AcaoComChave): void {
    this.chaves.set(acao, idempotencyKey.create());
    this.intencoes.delete(acao);
  }

  rotacionarTodas(): void {
    for (const acao of ACOES) this.rotacionar(acao);
  }
}
