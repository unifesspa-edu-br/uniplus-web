import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, type Observable } from 'rxjs';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import { type ApiFailure, type ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  type AvaliacaoDaInscricaoRequest,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import { isValidCpf } from '@uniplus/shared-data/utils';
import {
  AlertComponent,
  derivadosDoSistema,
  type EnvioDasRespostas,
  type ErroDoServidor,
  FormularioDoCandidatoComponent,
  PageHeaderComponent,
  type RespostaFixa,
  type SimulacaoDoFormulario,
  SpinnerComponent,
  type ValorJson,
} from '@uniplus/shared-ui/components';
import {
  cpfRevelavel,
  deslocarDia,
  diaNoFuso,
  instanteDaHoraDeParede,
  mascararCpf,
} from '@uniplus/shared-utils';

import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import {
  InscricaoDoCandidatoService,
  type OfertaDaInscricao,
} from './inscricao-do-candidato.service';
import { mensagemDaRecusa } from './recusas-da-inscricao';

type Estado = 'carregando' | 'erro' | 'pronto';

/** As recusas de quem gravou sobre uma revisão que outra janela já mudou. */
// A inscrição enviada noutra janela também é mudança que esta tela não viu: relê-la troca o rascunho
// pela correção por novo envio.
const CONFLITOS: ReadonlySet<string> = new Set([
  'uniplus.selecao.inscricao.precondicao_falhou',
  'uniplus.selecao.inscricao.conflito_de_concorrencia',
  'uniplus.selecao.inscricao.rascunho_so_antes_do_envio',
]);

/** O campo em que o servidor devolve a recusa da oferta de curso. */
const CAMPO_DA_OFERTA = 'ofertaCursoId';

/**
 * A inscrição do candidato num processo: o formulário que a inscrição fixou ao nascer, preenchido em
 * passos, salvo como rascunho ou enviado. O rascunho fica só na memória da página e no servidor.
 */
@Component({
  selector: 'ptl-inscricao-do-candidato-page',
  standalone: true,
  imports: [
    AlertComponent,
    FormularioDoCandidatoComponent,
    PageHeaderComponent,
    RouterLink,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AvaliacaoDaInscricaoEstado],
  templateUrl: './inscricao-do-candidato.page.html',
  styleUrl: './inscricao-do-candidato.page.css',
})
export class InscricaoDoCandidatoPage implements OnInit {
  private readonly servico = inject(InscricaoDoCandidatoService);
  private readonly usuario = inject(UserContextService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);

  readonly processoId = input.required<string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erroAoCarregar = signal<string | null>(null);
  protected readonly formulario = signal<FormularioRenderizavelDto | null>(null);
  protected readonly ofertas = signal<readonly OfertaDaInscricao[]>([]);
  private readonly relogio = inject(RELOGIO);
  private readonly documento = inject(DOCUMENT);
  /**
   * O instante contra o qual a tela confere os limites de data. Só muda quando o dia do envio vira, para
   * as regras não se reavaliarem a cada tique do relógio.
   */
  private readonly instanteDoEnvio = signal(this.relogio());
  /**
   * O envio que a tela supõe para os limites de data: o dia de agora, no fuso que o formulário publica.
   * O servidor confere de novo com o instante real de cada gravação.
   */
  protected readonly envio = computed<EnvioDasRespostas | null>(() => {
    const fuso = this.formulario()?.fusoDoEnvio;
    return fuso ? { instante: this.instanteDoEnvio().toISOString(), fuso } : null;
  });
  private viradaDoDia: ReturnType<typeof setTimeout> | null = null;
  /** O aviso do bloco de documentos quando as respostas não pedem nada nesta fase. */
  protected readonly semDocumentos =
    'Você não envia documentos nesta etapa. Os documentos que comprovam o que você declarou podem ser ' +
    'pedidos em outras etapas do processo seletivo, conforme o edital.';
  /** A inscrição como o servidor a tem: a última lida, salva ou enviada. */
  private readonly inscricao = signal<InscricaoDto | null>(null);
  /** A partida do formulário: as respostas e os aceites da inscrição como chegaram ao abrir a página. */
  protected readonly inicial = signal<SimulacaoDoFormulario | null>(null);
  protected readonly termosAceitosIniciais = signal<readonly string[]>([]);

  private readonly simulacao = signal<SimulacaoDoFormulario>({});
  /** A escolha do candidato: parte da gravada ao carregar e só ele a muda, nem a releitura do ETag. */
  protected readonly ofertaEscolhida = signal<string | null>(null);
  protected readonly erroDaOferta = signal<string | null>(null);
  private readonly selectDaOferta = viewChild<ElementRef<HTMLSelectElement>>('selectDaOferta');
  private readonly formularioDoCandidato = viewChild(FormularioDoCandidatoComponent);

  protected readonly ocupada = signal(false);
  /**
   * O envio deu certo, mas a releitura da inscrição falhou: o ETag da tela é o velho. Enquanto a página
   * não for recarregada, nada mais é gravado a partir dela.
   */
  protected readonly precisaRecarregar = signal(false);
  protected readonly bloqueada = computed(() => this.ocupada() || this.precisaRecarregar());
  protected readonly errosDoServidor = signal<readonly ErroDoServidor[]>([]);
  protected readonly recusaGeral = signal<string | null>(null);
  protected readonly conflito = signal<string | null>(null);
  protected readonly aviso = signal('');
  protected readonly comprovante = signal<ComprovanteInscricaoDto | null>(null);

  /** A inscrição enviada só muda por novo envio, que emite novo comprovante: não há rascunho dela. */
  protected readonly enviada = computed(
    () => this.comprovante() !== null || this.inscricao()?.situacao === SituacaoInscricao.submetida,
  );

  /**
   * O CPF vem da conta e não se altera aqui: entra na resposta do formulário que o coleta e aparece
   * mascarado, e o titular o revela a partir do próprio login, sem consulta.
   */
  protected readonly respostasFixas = computed<Readonly<Record<string, RespostaFixa>>>(() => {
    const cpf = this.usuario.user()?.cpf.replace(/\D/g, '') ?? '';
    const coletaCpf = this.formulario()?.fatosColetados.some((c) => c.fatoCodigo === 'CPF');
    const fixas: Record<string, RespostaFixa> = {};
    if (coletaCpf && isValidCpf(cpf)) {
      fixas['CPF'] = { valor: cpf, exibicao: mascararCpf(cpf), revelavel: cpfRevelavel(cpf) };
    }
    return fixas;
  });

  /**
   * Os fatos que o sistema calcula das respostas e que o formulário cita, com o rótulo de lá. Voltam ao
   * formulário como pressupostos, então só mudam quando o valor muda: senão cada simulação emitida
   * geraria outra.
   */
  protected readonly derivados = computed(
    () => {
      const formulario = this.formulario();
      if (!formulario) return [];
      const citados = new Map(formulario.pressupostos.map((p) => [p.fatoCodigo, p]));
      return derivadosDoSistema(this.simulacao().respostas ?? {}, formulario.dataReferenciaFatos)
        .filter((d) => citados.has(d.fatoCodigo))
        .map((d) => ({ ...d, rotulo: citados.get(d.fatoCodigo)?.rotulo ?? d.fatoCodigo }));
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly pressupostos = computed<Readonly<Record<string, ValorJson>>>(() =>
    Object.fromEntries(this.derivados().map((d) => [d.fatoCodigo, d.valor])),
  );

  ngOnInit(): void {
    const conferirODia = (): void => this.acompanharODiaDoEnvio();
    const janela = this.documento.defaultView;
    this.documento.addEventListener('visibilitychange', conferirODia);
    janela?.addEventListener('focus', conferirODia);
    this.destroyRef.onDestroy(() => {
      this.documento.removeEventListener('visibilitychange', conferirODia);
      janela?.removeEventListener('focus', conferirODia);
      if (this.viradaDoDia !== null) clearTimeout(this.viradaDoDia);
    });
    this.carregar();
  }

  /** Inicia a inscrição e, com ela, lê o formulário da versão fixada e as ofertas do processo. */
  protected carregar(): void {
    this.estado.set('carregando');
    const processoId = this.processoId();
    this.servico
      .iniciar(processoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((inscricao) => {
        if (!inscricao.ok) {
          this.falharAoCarregar(inscricao);
          return;
        }
        forkJoin({
          formulario: this.servico.obterFormulario(processoId),
          ofertas: this.servico.obterOfertas(processoId),
        })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(({ formulario, ofertas }) => {
            if (!formulario.ok) return this.falharAoCarregar(formulario);
            if (!ofertas.ok) return this.falharAoCarregar(ofertas);
            this.inscricao.set(inscricao.data);
            // As respostas chegam em JSON: são os valores que o formulário lê.
            const inicial: SimulacaoDoFormulario = {
              respostas: inscricao.data.respostas as Readonly<Record<string, ValorJson>>,
              grupos: inscricao.data.grupos as SimulacaoDoFormulario['grupos'],
            };
            this.inicial.set(inicial);
            this.avaliacao.iniciar(
              processoId,
              inscricao.data.avaliacao,
              formulario.data.dependenciasDaAvaliacao,
              inicial,
            );
            this.termosAceitosIniciais.set(inscricao.data.aceites.map((a) => a.codigo));
            this.instanteDoEnvio.set(this.relogio());
            this.formulario.set(formulario.data);
            this.acompanharODiaDoEnvio();
            this.ofertas.set(ofertas.data);
            this.ofertaEscolhida.set(
              inscricao.data.ofertaCursoId ??
                (ofertas.data.length === 1 ? ofertas.data[0].id : null),
            );
            this.estado.set('pronto');
          });
      });
  }

  /**
   * Mantém o dia do envio em dia: troca o instante quando o dia virou no fuso do envio e agenda a
   * próxima virada. A aba em segundo plano pode atrasar o timer, então a volta dela também confere.
   */
  private acompanharODiaDoEnvio(): void {
    const fuso = this.formulario()?.fusoDoEnvio;
    if (!fuso) return;
    const agora = this.relogio();
    if (diaNoFuso(agora, fuso) !== diaNoFuso(this.instanteDoEnvio(), fuso))
      this.instanteDoEnvio.set(agora);
    this.agendarAViradaDoDia(agora, fuso);
  }

  private agendarAViradaDoDia(agora: Date, fuso: string): void {
    if (this.viradaDoDia !== null) clearTimeout(this.viradaDoDia);
    this.viradaDoDia = null;
    const amanha = deslocarDia(diaNoFuso(agora, fuso), 0, 1);
    if (amanha === null) return;
    const [ano, mes, dia] = amanha.split('-').map(Number);
    const meiaNoite = instanteDaHoraDeParede(
      { ano, mes, dia, hora: 0, minuto: 0, segundo: 0 },
      fuso,
    );
    this.viradaDoDia = setTimeout(
      () => this.acompanharODiaDoEnvio(),
      Math.max(0, meiaNoite.getTime() - agora.getTime()),
    );
  }

  private falharAoCarregar(falha: ApiFailure): void {
    this.erroAoCarregar.set(this.problemas.resolve(falha.problem).title);
    this.estado.set('erro');
  }

  protected responder(simulacao: SimulacaoDoFormulario): void {
    this.simulacao.set(simulacao);
    const inscricao = this.inscricao();
    if (inscricao)
      this.avaliacao.respostasMudaram(simulacao, () => this.respostasDoCorpo(inscricao, simulacao));
  }

  protected escolherOferta(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.ofertaEscolhida.set(valor === '' ? null : valor);
    this.erroDaOferta.set(null);
  }

  protected salvar(): void {
    const revisao = this.avaliacao.revisao();
    this.gravar(
      (request, eTag) => this.servico.salvar(this.processoId(), request, eTag),
      (inscricao) => {
        this.inscricao.set(inscricao);
        this.avaliacao.aplicarDaGravacao(inscricao.avaliacao, revisao);
        this.aviso.set('Rascunho salvo.');
        this.ocupada.set(false);
      },
    );
  }

  protected enviar(): void {
    // O envio conclui todas as seções: com pendência, o formulário leva à primeira e nada é enviado.
    if ((this.formularioDoCandidato()?.concluirTodas() ?? 0) > 0) return;
    this.gravar(
      (request, eTag) => this.servico.submeter(this.processoId(), request, eTag),
      (comprovante) => {
        this.comprovante.set(comprovante);
        this.aviso.set(`Inscrição enviada. Número ${comprovante.numeroInscricao}.`);
        // O formulário só se libera com o ETag novo: antes disso, uma correção sairia com o velho.
        this.relerAGravada((lida) => {
          this.ocupada.set(false);
          if (!lida) this.precisaRecarregar.set(true);
        });
      },
    );
  }

  /**
   * O envio devolve o comprovante, não a inscrição: sem reler, a próxima correção sairia com o ETag velho.
   * `aoTerminar` diz se a releitura trouxe a inscrição.
   */
  private relerAGravada(aoTerminar?: (lida: boolean) => void): void {
    const revisao = this.avaliacao.revisao();
    this.servico
      .obter(this.processoId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok) {
          this.inscricao.set(resultado.data);
          this.avaliacao.aplicarDaGravacao(resultado.data.avaliacao, revisao);
        }
        aoTerminar?.(resultado.ok);
      });
  }

  private gravar<T>(
    chamada: (request: InscricaoRequest, eTag: string) => Observable<ApiResult<T>>,
    sucesso: (dado: T) => void,
  ): void {
    const inscricao = this.inscricao();
    const formulario = this.formularioDoCandidato();
    if (!inscricao || !formulario || this.bloqueada()) return;
    this.ocupada.set(true);
    this.conflito.set(null);
    this.recusaGeral.set(null);
    this.errosDoServidor.set([]);
    this.erroDaOferta.set(null);
    this.aviso.set('');
    // Lido do formulário no clique: a emissão das mudanças só chega no ciclo seguinte.
    chamada(
      this.request(inscricao, formulario.simulacao(), formulario.termosAceitos()),
      inscricao.eTag,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok) {
          // Quem trata o sucesso libera o formulário: o envio espera a releitura do ETag.
          sucesso(resultado.data);
          return;
        }
        this.ocupada.set(false);
        this.tratarRecusa(resultado);
      });
  }

  /** O corpo do salvar e do envio: as respostas, a oferta escolhida e os termos aceitos. */
  private request(
    inscricao: InscricaoDto,
    simulacao: SimulacaoDoFormulario,
    termosAceitos: readonly string[],
  ): InscricaoRequest {
    const termos = new Map((this.formulario()?.termos ?? []).map((t) => [t.codigo, t]));
    return {
      ofertaCursoId: this.ofertaEscolhida(),
      ...this.respostasDoCorpo(inscricao, simulacao),
      aceites: termosAceitos.flatMap((codigo) => {
        const termo = termos.get(codigo);
        return termo ? [{ codigo, versaoId: termo.versaoId, hashVersao: termo.hashVersao }] : [];
      }),
    };
  }

  /**
   * As respostas e as ocorrências como o servidor as mescla ao gravado. A resposta que o candidato
   * apagou vai como `null`: ausente do corpo, o servidor manteria a gravada. O grupo que o candidato
   * removeu vai como lista vazia, pelo mesmo motivo: ausente do corpo, o servidor manteria as
   * ocorrências gravadas; enviado, ele as substitui.
   */
  private respostasDoCorpo(
    inscricao: InscricaoDto,
    simulacao: SimulacaoDoFormulario,
  ): AvaliacaoDaInscricaoRequest {
    const respostas: Record<string, unknown> = { ...(simulacao.respostas ?? {}) };
    for (const fato of Object.keys(inscricao.respostas)) {
      if (!(fato in respostas)) respostas[fato] = null;
    }
    const grupos: Record<string, { id: string; respostas: Record<string, unknown> }[]> =
      Object.fromEntries(
        Object.entries(simulacao.grupos ?? {}).map(([codigo, ocorrencias]) => [
          codigo,
          (ocorrencias ?? []).map((o) => ({ id: o.id, respostas: o.respostas ?? {} })),
        ]),
      );
    for (const codigo of Object.keys(inscricao.grupos)) {
      if (simulacao.grupos?.[codigo] == null) grupos[codigo] = [];
    }
    return { respostas, grupos };
  }

  private tratarRecusa(falha: ApiFailure): void {
    if (CONFLITOS.has(falha.problem.code)) {
      this.conflito.set(
        'Recarregamos a versão gravada mais recente para você não sobrescrever o que mudou. Revise e grave de novo.',
      );
      this.carregar();
      return;
    }
    if (falha.status === 0 || falha.status >= 500) {
      // A gravação pode ter acontecido sem a resposta chegar: o ETag relido é o que vale para tentar de novo.
      this.relerAGravada();
    }
    const recusas = falha.problem.errors ?? [];
    const daOferta = recusas.find((e) => e.field === CAMPO_DA_OFERTA);
    const porCampo = recusas
      .filter((e) => e.field !== CAMPO_DA_OFERTA)
      .map((e) => ({ campo: e.field, mensagem: mensagemDaRecusa(e.code) }));
    if (daOferta) this.recusarOferta(mensagemDaRecusa(daOferta.code));
    if (porCampo.length > 0) this.errosDoServidor.set(porCampo);
    const total = porCampo.length + (daOferta ? 1 : 0);
    if (total > 0) {
      this.aviso.set(
        total === 1
          ? 'Uma resposta foi recusada. Corrija e tente de novo.'
          : `${total} respostas foram recusadas. Corrija e tente de novo.`,
      );
      return;
    }
    const mensagem = this.problemas.resolve(falha.problem);
    this.recusaGeral.set(mensagem.detail ?? mensagem.title);
  }

  /** Sem seletor na tela, a recusa da oferta só pode aparecer como recusa geral. */
  private recusarOferta(mensagem: string): void {
    if (this.ofertas().length <= 1) {
      this.recusaGeral.set(mensagem);
      return;
    }
    this.erroDaOferta.set(mensagem);
    afterNextRender(() => this.selectDaOferta()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
