import {
  Injectable,
  Injector,
  type Signal,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import type { StepItem } from '@uniplus/shared-ui/components';
import type {
  ErroDoServidor,
  FormularioDoCandidatoComponent,
  PendenciaDaSecao,
  SimulacaoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';

import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { EscolhaDoCurso } from './escolha-do-curso';
import { juntarSimulacoes, tituloDoFormulario } from './formularios-da-inscricao';
import { GravacaoDaInscricao, type FormularioParaGravar } from './gravacao-da-inscricao';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import { type RecusaNoFormulario, recusasPorFormulario } from './recusas-por-formulario';
import type { FormularioParaReavaliar } from './reavaliacao-da-inscricao';

type Instancia = FormularioDoCandidatoComponent;

/** Uma pendência de seção, com o formulário a que a seção pertence. */
export interface PendenciaDoFormulario extends PendenciaDaSecao {
  readonly formularioCodigo: string;
  readonly formularioTitulo: string;
}

/** Uma recusa do envio com o formulário dela, para o resumo de erros. */
export interface RecusaDoResumo extends RecusaNoFormulario {
  readonly formularioTitulo: string;
}

const SEM_RECUSAS: readonly ErroDoServidor[] = [];

/**
 * O que o candidato já fez em cada formulário e onde ele está: o formulário atual, as pendências e as
 * recusas por formulário. Todos os formulários da lista ficam montados ao mesmo tempo, cada um numa
 * instância do componente, que guarda o rascunho dele; a junção das respostas é calculada a cada leitura,
 * nunca guardada. Cada instância é identificada pelo código do formulário no processo. Provido pela página.
 */
@Injectable()
export class PreenchimentoDosFormularios implements FormularioParaGravar, FormularioParaReavaliar {
  private readonly leitura = inject(LeituraDaInscricao);
  private readonly gravacao = inject(GravacaoDaInscricao);
  private readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);
  private readonly escolhaDoCurso = inject(EscolhaDoCurso);
  private readonly injector = inject(Injector);
  private readonly fonte = signal<Signal<readonly Instancia[]> | null>(null);

  /** As instâncias na ordem da lista da API; só as que já estão na tela. */
  private readonly instancias = computed(() => {
    const porCodigo = new Map(
      (this.fonte()?.() ?? []).flatMap((i) => {
        const codigo = i.noProcesso()?.codigo;
        return codigo ? [[codigo, i] as const] : [];
      }),
    );
    return this.leitura.formularios().flatMap((f) => porCodigo.get(f.formulario.codigo) ?? []);
  });

  /** O código do formulário aberto; ao recarregar a inscrição, volta ao primeiro. */
  readonly ativo = linkedSignal<string | null>(
    () => this.leitura.formularios()[0]?.formulario.codigo ?? null,
  );

  /** Todos os formulários da lista já estão na tela. */
  readonly pronto = computed(
    () =>
      this.instancias().length > 0 &&
      this.instancias().length === this.leitura.formularios().length,
  );

  readonly simulacao = computed<SimulacaoDoFormulario>(() =>
    juntarSimulacoes(this.instancias().map((i) => i.simulacao())),
  );

  readonly termosAceitosPorFormulario = computed<ReadonlyMap<string, readonly string[]>>(
    () => new Map(this.instancias().map((i) => [codigoDe(i), i.termosAceitos()])),
  );

  readonly pendencias = computed<readonly PendenciaDoFormulario[]>(() =>
    this.instancias().flatMap((i) =>
      i.pendenciasPorSecao().map((p) => ({ ...p, ...this.identificacaoDe(i) })),
    ),
  );

  private readonly recusas = computed(() =>
    recusasPorFormulario(this.gravacao.errosDoServidor(), {
      formularios: this.leitura.formularios().map((f) => f.formulario),
      documentos: (this.avaliacao.naTela()?.documentos?.fases ?? []).flatMap((f) => f.documentos),
    }),
  );
  /** O formulário da recusa foi escolhido e ainda não apareceu: quem pede ação nele espera a tela. */
  private abrindoPorRecusa = false;
  /** As recusas que já podem chegar aos formulários: só depois de o formulário da primeira aparecer. */
  private readonly recusasLiberadas = signal<readonly unknown[]>([]);
  /** Os formulários já abertos desde as recusas: só eles as recebem, e o foco não vai a formulário oculto. */
  private readonly abertosComRecusas = signal<ReadonlySet<string>>(new Set());

  /**
   * As recusas que ainda valem, na ordem da API. Quem diz se uma recusa vale é a instância do formulário
   * dela, que a descarta quando a resposta muda; aqui só se confere, sem guardar cópia.
   */
  private readonly recusasVigentes = computed(() => {
    if (!this.recusasEntregues()) return [];
    const vigentesPorFormulario = new Map(
      this.instancias().map((i) => [codigoDe(i), i.errosVigentes()]),
    );
    return this.recusas().itens.filter((r) =>
      !this.abertosComRecusas().has(r.formularioCodigo) && r.formularioCodigo !== this.ativo()
        ? true
        : (vigentesPorFormulario.get(r.formularioCodigo) ?? []).some(
            (e) => e.campo === r.campo && e.mensagem === r.mensagem,
          ),
    );
  });

  /** As recusas do envio que ainda valem, com o formulário e o nome do campo, para o resumo de erros. */
  readonly resumoDasRecusas = computed<readonly RecusaDoResumo[]>(() => {
    const titulos = this.titulosDosFormularios();
    return this.recusasVigentes().map((r) => ({
      ...r,
      formularioTitulo: titulos.get(r.formularioCodigo) ?? '',
    }));
  });

  private readonly titulosDosFormularios = computed(
    () =>
      new Map(
        this.leitura
          .formularios()
          .map((f) => [f.formulario.codigo, tituloDoFormulario(f.formulario)]),
      ),
  );

  constructor() {
    effect(() => {
      const erros = this.gravacao.errosDoServidor();
      untracked(() => this.liberarAsRecusas(erros));
    });
    effect(() => {
      const aberto = this.ativo();
      if (!this.recusasEntregues() || aberto === null) return;
      untracked(() => this.abertosComRecusas.update((abertos) => new Set(abertos).add(aberto)));
    });
  }

  /**
   * A escolha do formulário: cada um com a posição entre os formulários, a pendência e a recusa, sem
   * depender só de cor. Sem pendência, o formulário conta como concluído.
   */
  readonly escolha = computed<readonly StepItem[]>(() => {
    const formularios = this.leitura.formularios();
    return formularios.map((f, indice) => {
      const codigo = f.formulario.codigo;
      const pendente = this.pendencias().some((p) => p.formularioCodigo === codigo);
      return {
        chave: codigo,
        rotulo: `Formulário ${indice + 1} de ${formularios.length}: ${tituloDoFormulario(f.formulario)}`,
        status: codigo === this.ativo() ? 'active' : pendente ? 'pending' : 'done',
        concluido: !pendente,
        comErro: this.recusasVigentes().some((r) => r.formularioCodigo === codigo),
      };
    });
  });

  /** Passa a acompanhar as instâncias da página, que só existem depois de a inscrição carregar. */
  acompanhar(instancias: Signal<readonly Instancia[]>): void {
    this.fonte.set(instancias);
  }

  haArquivoEmVerificacao(): boolean {
    return this.instancias().some((i) => i.haArquivoEmVerificacao());
  }

  aguardaVerificacaoDosDocumentos(): boolean {
    return this.instancias().some((i) => i.aguardaVerificacaoDosDocumentos());
  }

  /**
   * Como no envio: sem pendência em nenhum formulário, conclui as seções de todos. Com pendência, não
   * conclui nenhuma e leva ao primeiro formulário que a tem. Devolve quantas pendências há.
   */
  concluirTodas(): number {
    const pendencias = this.pendencias();
    if (pendencias.length === 0) {
      this.instancias().forEach((i) => i.conferencia.concluirTodas());
      return 0;
    }
    this.irAoFormulario(pendencias[0].formularioCodigo);
    return pendencias.reduce((soma, p) => soma + p.quantidade, 0);
  }

  private recusasEntregues(): boolean {
    return this.recusasLiberadas() === this.gravacao.errosDoServidor();
  }

  /** As recusas que o formulário de código dado mostra, depois de ele ser aberto. */
  recusasDe(codigo: string): readonly ErroDoServidor[] {
    if (!this.recusasEntregues()) return SEM_RECUSAS;
    if (codigo !== this.ativo() && !this.abertosComRecusas().has(codigo)) return SEM_RECUSAS;
    return this.recusas().porFormulario.get(codigo) ?? SEM_RECUSAS;
  }

  /**
   * A primeira recusa decide o formulário aberto. As recusas só chegam aos formulários depois de ele
   * aparecer, para o componente levar o foco ao campo num formulário à vista.
   */
  private liberarAsRecusas(erros: readonly ErroDoServidor[]): void {
    this.abertosComRecusas.set(new Set());
    const primeiro = this.formularioDaPrimeiraRecusa();
    const liberar = (): void => {
      this.abrindoPorRecusa = false;
      this.recusasLiberadas.set(erros);
    };
    if (primeiro === null || primeiro === this.ativo()) {
      liberar();
      return;
    }
    this.abrindoPorRecusa = true;
    this.ativo.set(primeiro);
    afterNextRender(liberar, { injector: this.injector });
  }

  /**
   * O formulário que a primeira recusa abre. A recusa do curso vem antes de qualquer outra, e o passo do
   * curso é do primeiro formulário; sem ela, vale a primeira recusa de campo, na ordem da API.
   */
  private formularioDaPrimeiraRecusa(): string | null {
    const { erroDaOferta, erroDaSegundaOferta } = this.escolhaDoCurso;
    if (erroDaOferta() !== null || erroDaSegundaOferta() !== null) {
      return this.leitura.formularios()[0]?.formulario.codigo ?? null;
    }
    return this.recusas().primeiro;
  }

  private identificacaoDe(
    instancia: Instancia,
  ): Pick<PendenciaDoFormulario, 'formularioCodigo' | 'formularioTitulo'> {
    const formularioCodigo = codigoDe(instancia);
    return {
      formularioCodigo,
      formularioTitulo: this.titulosDosFormularios().get(formularioCodigo) ?? '',
    };
  }

  /**
   * Abre o formulário e, depois de ele aparecer, deixa quem chamou agir sobre a instância dele: o foco e
   * a navegação só valem num formulário à vista.
   */
  irAoFormulario(codigo: string, depois?: (instancia: Instancia) => void): void {
    const jaAberto = this.ativo() === codigo && !this.abrindoPorRecusa;
    this.ativo.set(codigo);
    if (!depois) return;
    const agir = (): void => {
      const instancia = this.instancias().find((i) => codigoDe(i) === codigo);
      if (instancia) depois(instancia);
    };
    if (jaAberto) agir();
    else afterNextRender(agir, { injector: this.injector });
  }
}

function codigoDe(instancia: Instancia): string {
  return instancia.noProcesso()?.codigo ?? '';
}
