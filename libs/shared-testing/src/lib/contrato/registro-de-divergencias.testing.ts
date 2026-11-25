import { DivergenciaDoContrato, mensagemDasDivergencias } from './divergencia-do-contrato.testing';

export class RegistroDeDivergencias {
  private divergencias: DivergenciaDoContrato[] = [];
  private pendentes = new Set<Promise<unknown>>();

  registrar(divergencias: readonly DivergenciaDoContrato[]): void {
    this.divergencias.push(...divergencias);
  }

  acompanhar<T>(promessa: Promise<T>): Promise<T | undefined> {
    const segura = promessa.catch(() => {
      this.registrarFalha();
      return undefined;
    });
    this.pendentes.add(segura);
    void segura.then(() => this.pendentes.delete(segura));
    return segura;
  }

  private registrarFalha(): void {
    this.registrar([
      {
        metodo: 'HTTP',
        caminho: '/api/{...}',
        campo: 'conferência',
        regra: 'não foi possível conferir',
      },
    ]);
  }

  ler(): readonly DivergenciaDoContrato[] {
    return [...this.divergencias];
  }

  limpar(): void {
    this.divergencias = [];
  }

  async encerrar(): Promise<void> {
    while (this.pendentes.size) await Promise.all(this.pendentes);
    const mensagem = mensagemDasDivergencias(this.ler());
    this.limpar();
    if (mensagem) throw new Error(mensagem);
  }
}
