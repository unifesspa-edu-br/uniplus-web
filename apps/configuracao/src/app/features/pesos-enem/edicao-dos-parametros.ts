import { FormArray, FormGroup } from '@angular/forms';
import {
  DestroyRef,
  Injectable,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { ApiResult, ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import { ChavesDeIdempotencia } from './chaves-de-idempotencia';
import { GravacaoDosPesosEnem } from './gravacao-dos-pesos-enem';
import {
  FormularioDeEdicao,
  PesoEdicaoGrupoForm,
  comandoDeAtualizacao,
  criarGrupoDeEdicao,
} from './pesos-enem-form';
import { aplicarRecusaDoGrupo } from './pesos-enem-recusas';
import { idCampo, idDoBotaoDeEdicao, rotuloDoGrupo } from './pesos-enem-rotulos';
import { PesosEnemStore } from './pesos-enem.store';
import { descartarRecusasDoServidor } from '../../shared/formulario';

export type EstadoOperacao = 'ok' | 'erro';

interface Envio {
  readonly grupo: FormGroup<PesoEdicaoGrupoForm>;
  readonly id: string;
  readonly chave: string;
  readonly corpoSerializado: string;
  readonly result: ApiResult<void>;
}

/**
 * A edição em linha dos pesos de uma resolução: uma linha por grupo de curso, salva com uma
 * chamada por linha. Só uma resolução fica em edição por vez. Pede a trava de gravação ao
 * enviar; a leitura da tela não conhece esta classe.
 */
@Injectable()
export class EdicaoDosParametros {
  private readonly api = inject(PesosEnemApi);
  private readonly store = inject(PesosEnemStore);
  private readonly gravacao = inject(GravacaoDosPesosEnem);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly chaves = new ChavesDeIdempotencia<string>();

  readonly emEdicao = signal<string | null>(null);
  readonly form = signal<FormularioDeEdicao | null>(null);
  readonly erro = signal<string | null>(null);
  readonly estadoLinhas = signal<ReadonlyMap<string, EstadoOperacao>>(new Map());

  constructor() {
    effect(() => {
      const editando = this.emEdicao() !== null;
      untracked(() => this.store.congelarOrdemDosGrupos(editando));
    });
  }

  /** Abre a edição da resolução; havendo outra aberta, a fecha antes, pedindo confirmação se
   *  ela tem alterações não salvas. */
  pedirEdicao(resolucao: string): void {
    if (this.gravacao.gravando() || this.emEdicao() === resolucao) {
      return;
    }
    if (this.emEdicao() !== null && !this.podeDeixarAEdicaoAberta()) {
      return;
    }
    // Fecha a sessão atual pelo mesmo caminho do Cancelar: se ela teve sucesso parcial, as
    // linhas já gravadas vão para a leitura antes da troca.
    this.encerrar();
    this.abrir(resolucao);
  }

  cancelar(): void {
    if (!this.gravacao.gravando()) {
      this.encerrar();
    }
  }

  /** Fecha a edição sem aplicar nada: as linhas dela estão prestes a deixar de existir. */
  descartar(resolucao: string): void {
    if (this.emEdicao() === resolucao) {
      this.limpar();
    }
  }

  salvar(): void {
    const form = this.form();
    const resolucao = this.emEdicao();
    if (form === null || resolucao === null) {
      return;
    }
    this.erro.set(null);
    descartarRecusasDoServidor(form);
    form.markAllAsTouched();
    if (form.invalid) {
      return;
    }
    const pendentes = form.controls.filter(
      (grupo) => this.estadoLinhas().get(grupo.controls.id.value) !== 'ok',
    );
    if (pendentes.length > 0) {
      this.enviar(resolucao, pendentes);
    }
  }

  private podeDeixarAEdicaoAberta(): boolean {
    return (
      !(this.form()?.dirty ?? false) ||
      globalThis.confirm(
        'Há alterações não salvas nesta resolução. Deseja descartá-las e editar outra?',
      )
    );
  }

  private abrir(resolucao: string): void {
    const linhas = this.store.porResolucao().get(resolucao) ?? [];
    this.form.set(
      new FormArray(linhas.map((linha) => criarGrupoDeEdicao(linha, this.store.areas()))),
    );
    this.erro.set(null);
    this.estadoLinhas.set(new Map());
    this.chaves.reiniciar(linhas.map((linha) => linha.id));
    this.emEdicao.set(resolucao);
    // Depois da renderização: antes dela o bloco de edição ainda não existe na tela.
    afterNextRender(() => document.getElementById(idCampo(resolucao, 0, 0, 'peso'))?.focus(), {
      injector: this.injector,
    });
  }

  /** Fecha a sessão levando para a leitura o que ela já gravou e devolve o foco ao botão que a abriu. */
  private encerrar(): void {
    const resolucao = this.emEdicao();
    const form = this.form();
    if (form !== null) {
      this.store.aplicarEdicao(
        form.controls
          .filter((grupo) => this.estadoLinhas().get(grupo.controls.id.value) === 'ok')
          .map((grupo) => grupo.getRawValue()),
      );
    }
    this.limpar();
    if (resolucao !== null) {
      // Depois da renderização: antes dela o botão ainda pode estar indisponível pelo envio que
      // acabou de terminar, e o foco se perderia.
      afterNextRender(() => document.getElementById(idDoBotaoDeEdicao(resolucao))?.focus(), {
        injector: this.injector,
      });
    }
  }

  private limpar(): void {
    this.emEdicao.set(null);
    this.form.set(null);
    this.erro.set(null);
    this.estadoLinhas.set(new Map());
  }

  private enviar(resolucao: string, pendentes: readonly FormGroup<PesoEdicaoGrupoForm>[]): void {
    if (!this.gravacao.tentar('editando')) {
      return;
    }
    this.erro.set(null);
    this.gravacao.anunciar(`Salvando os pesos da resolução ${resolucao}.`);
    forkJoin(pendentes.map((grupo) => this.chamar(grupo)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((envios) => {
        this.gravacao.liberar();
        this.concluir(resolucao, envios);
      });
  }

  private chamar(grupo: FormGroup<PesoEdicaoGrupoForm>) {
    const valores = grupo.getRawValue();
    const comando = comandoDeAtualizacao(valores);
    const { chave, corpoSerializado } = this.chaves.paraEnviar(valores.id, comando);
    return this.api
      .atualizar(valores.id, comando, withIdempotencyKey(chave))
      .pipe(map((result): Envio => ({ grupo, id: valores.id, chave, corpoSerializado, result })));
  }

  private concluir(resolucao: string, envios: readonly Envio[]): void {
    const { semCampo, ultimoProblema } = this.registrar(envios);
    const falhas = envios.filter((envio) => !envio.result.ok).length;
    if (falhas === 0) {
      this.notifications.success('Pesos salvos', resolucao);
      this.gravacao.anunciar(`Pesos da resolução ${resolucao} salvos.`);
      this.encerrar();
      return;
    }
    this.erro.set(
      [
        `${falhas} de ${envios.length} grupo(s) não foram salvos. Corrija e tente novamente.`,
        ...semCampo,
      ].join(' '),
    );
    this.gravacao.anunciar(`Não foi possível salvar todos os grupos da resolução ${resolucao}.`);
    if (ultimoProblema !== null && ultimoProblema.status >= 500) {
      this.notifications.errorFromProblem(ultimoProblema);
    }
  }

  /** Guarda o desfecho de cada linha, trava as salvas e leva as recusas aos campos. */
  private registrar(envios: readonly Envio[]): {
    semCampo: string[];
    ultimoProblema: ProblemDetails | null;
  } {
    const novoEstado = new Map(this.estadoLinhas());
    const semCampo: string[] = [];
    let ultimoProblema: ProblemDetails | null = null;
    for (const envio of envios) {
      this.chaves.lembrar(envio.id, envio, envio.result);
      novoEstado.set(envio.id, envio.result.ok ? 'ok' : 'erro');
      if (envio.result.ok) {
        // Trava a linha salva: sem isso ela poderia ser editada de novo sem reenviar (não
        // entra em `pendentes` no próximo Salvar), e a leitura mostraria um valor nunca gravado.
        envio.grupo.disable();
      } else {
        ultimoProblema = envio.result.problem;
        semCampo.push(...this.recusar(envio.grupo, envio.result.problem));
      }
    }
    this.estadoLinhas.set(novoEstado);
    return { semCampo, ultimoProblema };
  }

  /** A edição em linha só permite corrigir as áreas: resolução, grupo e base legal não aparecem
   *  nela, e o erro deles vai para o banner, nomeando o grupo. */
  private recusar(grupo: FormGroup<PesoEdicaoGrupoForm>, problem: ProblemDetails): string[] {
    const nome = rotuloDoGrupo(grupo.controls.grupoCurso.value);
    return aplicarRecusaDoGrupo(
      grupo.controls.areas,
      problem,
      {},
      (p) => this.problemI18n.resolve(p).title,
    ).map((mensagem) => `${nome}: ${mensagem}`);
  }
}
