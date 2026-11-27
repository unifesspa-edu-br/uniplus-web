import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormGroup } from '@angular/forms';
import { forkJoin, map } from 'rxjs';
import { ApiResult, ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import { ChavesDeIdempotencia } from './chaves-de-idempotencia';
import { GravacaoDosPesosEnem } from './gravacao-dos-pesos-enem';
import {
  PesoGrupoForm,
  comandoDeCriacao,
  criarFormularioDeResolucao,
  criarGrupoDeCriacao,
} from './pesos-enem-form';
import {
  type DesfechoDasRecusasDosGrupos,
  type FalhaDoGrupo,
  PAR_JA_EXISTE_CODE,
  recusarGrupos,
} from './pesos-enem-recusas';
import { PesosEnemStore } from './pesos-enem.store';
import type { EstadoOperacao } from './edicao-dos-parametros';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../shared/formulario';

const MENSAGEM_DE_DUPLICIDADE = 'Resolução já cadastrada. Informe um identificador diferente.';
const MENSAGEM_DE_DUPLICIDADE_PARCIAL =
  'Um dos grupos pendentes já existe com esse identificador. Os grupos já criados foram salvos — confira os dados existentes antes de tentar novamente.';

interface Envio {
  readonly indice: number;
  readonly grupo: FormGroup<PesoGrupoForm>;
  readonly chave: string;
  readonly corpoSerializado: string;
  readonly result: ApiResult<string>;
}

interface GrupoPendente {
  readonly grupo: FormGroup<PesoGrupoForm>;
  readonly indice: number;
}

/**
 * O cadastro de uma nova resolução: um POST por grupo de curso, sem endpoint de lote. Os
 * grupos já criados ficam travados e presos ao identificador da resolução; só os pendentes são
 * reenviados. Pede a trava de gravação ao enviar.
 */
@Injectable()
export class CriacaoDeResolucao {
  private readonly api = inject(PesosEnemApi);
  private readonly store = inject(PesosEnemStore);
  private readonly gravacao = inject(GravacaoDosPesosEnem);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly chaves = new ChavesDeIdempotencia<number>();
  private readonly tituloDaRecusa = (problem: ProblemDetails) =>
    this.problemI18n.resolve(problem).title;

  readonly form = criarFormularioDeResolucao();
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly estadoGrupos = signal<ReadonlyMap<number, EstadoOperacao>>(new Map());
  private readonly recusa = signal('');
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncio = computed(() =>
    this.gravacao.criando() ? 'Criando a resolução.' : this.recusa(),
  );

  constructor() {
    this.form.controls.baseLegalGlobal.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => this.propagarBaseLegal(valor));
  }

  abrir(): void {
    if (this.gravacao.gravando() || !this.store.podeCadastrar()) {
      return;
    }
    this.prepararFormulario();
    this.limparMensagens();
    this.estadoGrupos.set(new Map());
    this.chaves.reiniciar(this.store.grupos().map((_, indice) => indice));
    this.aberto.set(true);
  }

  private prepararFormulario(): void {
    this.form.controls.resolucao.enable();
    this.form.setControl(
      'grupos',
      new FormArray(
        this.store.grupos().map((grupo) => criarGrupoDeCriacao(grupo, this.store.areas())),
      ),
    );
    this.form.reset({ resolucao: '', baseLegalGlobal: '' });
  }

  private limparMensagens(): void {
    this.erro.set(null);
    this.recusa.set('');
  }

  fechar(): void {
    this.aberto.set(false);
  }

  /**
   * Ligado a `(closed)` do drawer, que dispara em qualquer caminho de fechamento. Sem recarregar
   * aqui, fechar depois de um sucesso parcial deixaria os grupos já criados invisíveis até um
   * reload manual. Com um envio em voo, quem recarrega é a resposta dele: recarregar aqui veria
   * só o estado de antes do envio e a recarga legítima seria descartada.
   */
  aoFechar(): void {
    if (!this.gravacao.criando() && this.algumGrupoCriado()) {
      this.gravacao.recarregar();
    }
  }

  criar(): void {
    this.limparMensagens();
    descartarRecusasDoServidor(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const pendentes = this.gruposPendentes();
    if (pendentes.length > 0) {
      this.enviar(this.form.controls.resolucao.value.trim(), pendentes);
    }
  }

  private gruposPendentes(): GrupoPendente[] {
    return this.form.controls.grupos.controls
      .map((grupo, indice) => ({ grupo, indice }))
      .filter(({ indice }) => this.estadoGrupos().get(indice) !== 'ok');
  }

  private algumGrupoCriado(): boolean {
    return [...this.estadoGrupos().values()].some((estado) => estado === 'ok');
  }

  /** O valor global é o pré-preenchimento dos grupos ainda intocados e não criados: propagá-lo a
   *  um grupo já criado mostraria uma base legal que nunca foi enviada. */
  private propagarBaseLegal(valor: string): void {
    this.form.controls.grupos.controls.forEach((grupo, indice) => {
      if (this.estadoGrupos().get(indice) !== 'ok' && grupo.controls.baseLegal.pristine) {
        grupo.controls.baseLegal.setValue(valor, { emitEvent: false });
      }
    });
  }

  private enviar(resolucao: string, pendentes: readonly GrupoPendente[]): void {
    if (!this.gravacao.tentar('criando')) {
      return;
    }
    this.limparMensagens();
    forkJoin(pendentes.map(({ grupo, indice }) => this.chamar(grupo, indice, resolucao)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((envios) => {
        this.gravacao.liberar();
        this.concluir(resolucao, envios);
      });
  }

  private chamar(grupo: FormGroup<PesoGrupoForm>, indice: number, resolucao: string) {
    const comando = comandoDeCriacao(grupo.getRawValue(), resolucao);
    const { chave, corpoSerializado } = this.chaves.paraEnviar(indice, comando);
    return this.api
      .criar(comando, withIdempotencyKey(chave))
      .pipe(map((result): Envio => ({ indice, grupo, chave, corpoSerializado, result })));
  }

  private concluir(resolucao: string, envios: readonly Envio[]): void {
    // Algum grupo já criado, neste envio ou num anterior: a resolução fica travada, e travar
    // limpa o erro do campo; por isso, nesse caso, o erro de resolução vai para o banner.
    const algumSucesso = this.algumGrupoCriado() || envios.some((envio) => envio.result.ok);
    this.registrarEnvios(envios);
    if (envios.every((envio) => envio.result.ok)) {
      this.concluirComSucesso(resolucao);
      return;
    }
    this.concluirComFalhas(envios, algumSucesso);
  }

  private registrarEnvios(envios: readonly Envio[]): void {
    const novoEstado = new Map(this.estadoGrupos());
    for (const envio of envios) {
      this.chaves.lembrar(envio.indice, envio, envio.result);
      novoEstado.set(envio.indice, envio.result.ok ? 'ok' : 'erro');
    }
    this.estadoGrupos.set(novoEstado);
  }

  private concluirComSucesso(resolucao: string): void {
    this.notifications.success('Resolução criada', resolucao);
    this.gravacao.anunciar(`Resolução ${resolucao} criada.`);
    // Zera o estado antes de fechar: `aoFechar` também checa sucesso parcial, e recarregaria de
    // novo se ainda visse grupos criados aqui.
    this.estadoGrupos.set(new Map());
    this.aberto.set(false);
    this.gravacao.recarregar();
  }

  private concluirComFalhas(envios: readonly Envio[], algumSucesso: boolean): void {
    const falhas = falhasDosEnvios(envios);
    const desfecho = this.recusarFalhas(falhas, algumSucesso);
    // Se o drawer foi fechado com os envios em voo, `aoFechar` rodou antes de qualquer
    // resultado e não viu sucesso: recarregar agora é a única forma de mostrar o que foi criado.
    if (!this.aberto() && algumSucesso) {
      this.gravacao.recarregar();
    }
    this.erro.set(mensagemDoBanner(falhas.length, envios.length, desfecho, algumSucesso));
    this.avisarRecusa(desfecho.ultimoProblema);
  }

  private recusarFalhas(
    falhas: readonly FalhaDoGrupo[],
    algumSucesso: boolean,
  ): DesfechoDasRecusasDosGrupos {
    const resolucao = algumSucesso ? undefined : this.form.controls.resolucao;
    const desfecho = recusarGrupos(falhas, resolucao, this.tituloDaRecusa);
    // Trava a resolução assim que QUALQUER grupo for criado: os já criados ficam presos a esse
    // identificador no backend, e mudá-lo recriaria os pendentes sob outra resolução.
    if (algumSucesso) {
      this.form.controls.resolucao.disable();
    } else if (desfecho.duplicidade) {
      this.marcarResolucaoDuplicada();
    }
    return desfecho;
  }

  private avisarRecusa(ultimoProblema: ProblemDetails | null): void {
    this.recusa.set(this.erro() ? '' : 'Revise os campos indicados.');
    if (ultimoProblema !== null && ultimoProblema.status >= 500) {
      this.notifications.errorFromProblem(ultimoProblema);
    }
  }

  /** "Informe um identificador diferente" só é uma instrução que o operador consegue seguir
   *  com o campo da resolução ainda editável; com sucesso parcial ele está travado, e o aviso
   *  vai só ao banner. */
  private marcarResolucaoDuplicada(): void {
    const control = this.form.controls.resolucao;
    marcarRecusaDoServidor(control, PAR_JA_EXISTE_CODE, MENSAGEM_DE_DUPLICIDADE);
  }
}

function falhasDosEnvios(envios: readonly Envio[]): FalhaDoGrupo[] {
  return envios.flatMap(({ grupo, result }) =>
    result.ok ? [] : [{ grupo, problem: result.problem }],
  );
}

/** Com resolução duplicada e nada criado, o aviso fica no campo da resolução e o banner leva só
 *  as mensagens dos outros grupos, que não têm campo. */
function mensagemDoBanner(
  falhas: number,
  total: number,
  { duplicidade, semCampo }: DesfechoDasRecusasDosGrupos,
  algumSucesso: boolean,
): string | null {
  const partes: string[] = [];
  if (duplicidade && algumSucesso) {
    partes.push(MENSAGEM_DE_DUPLICIDADE_PARCIAL);
  } else if (!duplicidade) {
    partes.push(`${falhas} de ${total} grupo(s) não foram criados. Corrija e tente novamente.`);
  }
  partes.push(...semCampo);
  return partes.length > 0 ? partes.join(' ') : null;
}
