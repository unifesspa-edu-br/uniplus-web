import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isApiOk, salvarArquivo } from '@uniplus/shared-core/http';
import { NotasDoEnemApi } from '@uniplus/shared-data/selecao';

import { AlertaDeRecusaComponent } from './alerta-de-recusa.component';
import { HistoricoDeEnviosComponent } from './historico-de-envios.component';
import { OrientacoesDoEnemComponent } from './orientacoes-do-enem.component';
import { SeletorDeEdicaoComponent } from './seletor-de-edicao.component';
import { leiauteDaChave } from './leiautes';
import { NotasDoEnemDoProcesso, mesmoEscopo } from './notas-do-enem-do-processo.service';
import { explicarRecusa, falhaIncerta, type RecusaExplicada } from './recusas-do-enem';
import { SeletorDeLeiauteComponent } from './seletor-de-leiaute.component';

/** O arquivo é um CPF por linha; só a contagem sai daqui, o texto não é guardado. */
function totalDeCpfs(arquivo: string): number {
  return arquivo.split('\n').filter((linha) => linha.trim() !== '').length;
}

/**
 * Gera o arquivo de envio ao INEP e o entrega como download. O arquivo é a lista de CPFs, um por
 * linha: a única saída do sistema com CPF. O texto vive só dentro de `baixar`, entre a resposta e
 * o download; não passa por signal, store nem log.
 */
@Component({
  selector: 'sel-envio-ao-inep',
  standalone: true,
  imports: [
    AlertaDeRecusaComponent,
    HistoricoDeEnviosComponent,
    OrientacoesDoEnemComponent,
    SeletorDeEdicaoComponent,
    SeletorDeLeiauteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './envio-ao-inep.component.html',
  styleUrls: ['./compartilhado.css', './acao-do-card.css'],
})
export class EnvioAoInepComponent {
  private readonly api = inject(NotasDoEnemApi);
  private readonly injector = inject(Injector);
  protected readonly notas = inject(NotasDoEnemDoProcesso);

  protected readonly leiaute = new FormControl('', { nonNullable: true });
  protected readonly erroDoLeiaute = signal<string | null>(null);
  protected readonly gerando = signal(false);
  /** Quantos CPFs o último arquivo gerado trouxe; nulo sem geração. */
  protected readonly gerado = signal<number | null>(null);
  protected readonly recusa = signal<RecusaExplicada | null>(null);

  private readonly seletor = viewChild(SeletorDeLeiauteComponent);
  private readonly alerta = viewChild(AlertaDeRecusaComponent);

  constructor() {
    // O que o card mostra é do processo e da edição em que a ação foi pedida: trocar um dos dois
    // descarta a recusa e o aviso de sucesso, que não dizem nada sobre o novo escopo.
    effect(() => {
      this.notas.processoId();
      this.notas.edicaoDeEnvio();
      untracked(() => {
        this.recusa.set(null);
        this.gerado.set(null);
      });
    });
    this.leiaute.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.erroDoLeiaute.set(null));
  }

  protected escolherEdicao(edicao: string): void {
    void this.notas.escolherEdicaoDeEnvio(edicao);
  }

  protected async baixar(): Promise<void> {
    if (this.gerando()) return;
    this.gerado.set(null);
    this.recusa.set(null);

    const escolhido = this.notas.escolhidoDeEnvio();
    const catalogo = this.notas.leiautesDeEnvio();
    const leiaute =
      catalogo.estado === 'lido' ? leiauteDaChave(catalogo.dados, this.leiaute.value) : null;
    if (escolhido === null) return;
    if (leiaute === null) {
      this.erroDoLeiaute.set('Escolha o leiaute do arquivo de envio.');
      this.seletor()?.focar();
      return;
    }
    this.erroDoLeiaute.set(null);

    this.gerando.set(true);
    try {
      const resultado = await firstValueFrom(
        this.api.gerarEnvio(escolhido.processoId, escolhido.etapaId, escolhido.edicao, leiaute),
      );
      if (isApiOk(resultado)) {
        // O arquivo é da edição pedida, e o nome já a leva: baixa mesmo que a tela tenha mudado.
        salvarArquivo(
          new Blob([resultado.data], { type: 'text/plain;charset=utf-8' }),
          this.nomeDoArquivo(escolhido.edicao),
        );
        if (mesmoEscopo(this.notas.escolhidoDeEnvio(), escolhido)) {
          this.gerado.set(totalDeCpfs(resultado.data));
          void this.notas.recarregarEnvios();
        }
      } else if (mesmoEscopo(this.notas.escolhidoDeEnvio(), escolhido)) {
        this.mostrarRecusa(explicarRecusa(resultado.problem, 'envio'));
        // Na falha incerta a geração pode ter sido registrada: o histórico é o que o operador confere.
        if (falhaIncerta(resultado.problem)) void this.notas.recarregarEnvios();
      }
    } finally {
      this.gerando.set(false);
    }
  }

  /** O identificador do processo no início separa os arquivos de processos diferentes na mesma pasta. */
  private nomeDoArquivo(edicao: string): string {
    const processo = this.notas.processo();
    const identificador = processo.estado === 'lido' ? processo.dados.identificadorLegivel : null;
    return `${identificador ?? 'notas-do-enem'}-envio-${edicao}.txt`;
  }

  protected recarregarCatalogo(): void {
    this.leiaute.setValue('');
    void this.notas.recarregarLeiautes('envio');
  }

  private mostrarRecusa(recusa: RecusaExplicada): void {
    this.recusa.set(recusa);
    if (recusa.recarregarCatalogo) this.recarregarCatalogo();
    afterNextRender(() => this.alerta()?.focar(), { injector: this.injector });
  }
}
