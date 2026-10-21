import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  type OnInit,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';
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
  type AvaliacaoNaTela,
  derivadosDoSistema,
  type EnvioDasRespostas,
  type ErroDoServidor,
  FormularioDoCandidatoComponent,
  PageHeaderComponent,
  type PassoPrefixado,
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

import {
  numeroDeOpcoesDeCurso,
  type OfertaDaInscricao,
  ofertasDaInscricao,
} from '../oferta-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import { mensagemDaRecusa, mensagemDaRecusaDaSegundaOpcao } from './recusas-da-inscricao';

type Estado = 'carregando' | 'erro' | 'pronto';

/** As recusas de quem gravou sobre uma revisão defasada: outra janela gravou, ou a retificação trocou a versão do formulário. */
// A inscrição enviada noutra janela também é mudança que esta tela não viu: relê-la troca o rascunho
// pela correção por novo envio.
const CONFLITOS: ReadonlySet<string> = new Set([
  'uniplus.selecao.inscricao.precondicao_falhou',
  'uniplus.selecao.inscricao.conflito_de_concorrencia',
  'uniplus.selecao.inscricao.rascunho_so_antes_do_envio',
]);

/** O campo em que o servidor devolve a recusa da oferta de curso. */
const CAMPO_DA_OFERTA = 'ofertaCursoId';
/** O campo em que o servidor devolve a recusa da 2ª opção de curso. */
const CAMPO_DA_SEGUNDA_OPCAO = 'ofertaCursoSegundaOpcaoId';
/** Recusas da 2ª opção que nascem da 1ª: trocar a 1ª as desfaz; as demais ficam até a 2ª mudar. */
const RECUSAS_DA_SEGUNDA_QUE_VEM_DA_PRIMEIRA = new Set([
  'uniplus.selecao.inscricao.segunda_opcao_igual_a_primeira',
  'uniplus.selecao.inscricao.segunda_opcao_sem_primeira',
]);
/** A chave do passo em que o candidato escolhe o curso, quando o processo oferece mais de um. */
const PASSO_DO_CURSO = 'curso';
/** O que o leitor de tela ouve quando a releitura mostra que a gravação aconteceu. */
function confirmacaoDaGravacao(inscricao: InscricaoDto): string {
  if (inscricao.situacao !== SituacaoInscricao.submetida) return 'Rascunho salvo.';
  return inscricao.numeroInscricao
    ? `Inscrição enviada. Número ${inscricao.numeroInscricao}.`
    : 'Inscrição enviada.';
}

/** Se o formulário coleta o fato. */
function coletaO(formulario: FormularioRenderizavelDto, fato: string): boolean {
  return formulario.fatosColetados.some((c) => c.fatoCodigo === fato);
}

const TITULO_DA_RECUSA = 'A inscrição não foi gravada';

/**
 * A inscrição do candidato num processo: o formulário da versão em que está a inscrição, preenchido em
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
  private readonly documentos = inject(EnvioDeDocumentosDaInscricao);
  private readonly usuario = inject(UserContextService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);

  readonly processoId = input.required<string>();
  /** As ocorrências de grupo já gravadas: a API só aceita arquivo de uma ocorrência que a inscrição tem. */
  protected readonly ocorrenciasGravadas = computed(
    () =>
      new Set(
        Object.values(this.inscricao()?.grupos ?? {}).flatMap((ocorrencias) =>
          ocorrencias.map((ocorrencia) => ocorrencia.id),
        ),
      ),
  );
  /** O envio dos arquivos dos documentos exigidos, no processo desta tela. */
  protected readonly envioDeDocumentos = computed(() =>
    this.documentos.paraOProcesso(this.processoId()),
  );

  /** Quantas mudanças do envio a avaliação já levou em conta; o envio nasce sem nenhuma. */
  private mudancasVistas = 0;

  constructor() {
    // Enviar ou remover um arquivo muda a situação dos documentos, que só a API calcula. O envio fica
    // fora do componente do passo, então a reavaliação vem dele, mesmo que a tela tenha mudado de passo.
    effect(() => {
      const mudancas = this.envioDeDocumentos().mudancas();
      untracked(() => {
        if (mudancas === this.mudancasVistas) return;
        this.mudancasVistas = mudancas;
        this.atualizarARevisaoEReavaliar();
      });
    });
  }

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erroAoCarregar = signal<string | null>(null);
  protected readonly formulario = signal<FormularioRenderizavelDto | null>(null);
  /** As ofertas da versão em que está a inscrição, não as do certame ao vivo. */
  protected readonly ofertas = signal<readonly OfertaDaInscricao[]>([]);
  /** Quantas opções de curso a versão da inscrição admite. */
  private readonly numeroDeOpcoes = signal<1 | 2>(1);
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
  /** A 2ª opção escolhida pelo candidato; só vale com a 1ª escolhida e diferente dela. */
  protected readonly segundaOfertaEscolhida = signal<string | null>(null);
  protected readonly erroDaSegundaOferta = signal<string | null>(null);
  private codigoDaRecusaDaSegunda: string | null = null;
  /** Por que a 2ª opção foi limpa, até o candidato escolher de novo. */
  protected readonly avisoDaSegundaLimpa = signal<string | null>(null);
  protected readonly PASSO_DO_CURSO = PASSO_DO_CURSO;
  /** A oferta escolhida, se ainda é uma das do processo: um id gravado que saiu da lista não vale. */
  protected readonly ofertaEscolhidaValida = computed(
    () => this.ofertas().find((o) => o.id === this.ofertaEscolhida()) ?? null,
  );
  /** O processo admite 2 opções e há de onde escolher a 2ª. */
  protected readonly comSegundaOpcao = computed(
    () => this.numeroDeOpcoes() === 2 && this.ofertas().length > 1,
  );
  /** A 2ª opção escolhida, se ainda vale: há 2 opções, a 1ª está escolhida e a 2ª é outra oferta. */
  private readonly segundaOfertaValida = computed(() => {
    const primeira = this.ofertaEscolhidaValida();
    if (!this.comSegundaOpcao() || primeira === null) return null;
    return (
      this.ofertas().find((o) => o.id === this.segundaOfertaEscolhida() && o.id !== primeira.id) ??
      null
    );
  });
  /** As ofertas da 2ª opção: todas, menos a escolhida na 1ª. */
  protected readonly ofertasDaSegunda = computed(() =>
    this.ofertas().filter((o) => o.id !== this.ofertaEscolhidaValida()?.id),
  );
  /** Os ids que descrevem o campo da 2ª opção: a ajuda, o aviso de que foi limpa e o erro. */
  protected readonly descricaoDaSegunda = computed(() =>
    [
      'inscricao-segunda-oferta-ajuda',
      this.avisoDaSegundaLimpa() ? 'inscricao-segunda-oferta-aviso' : null,
      this.erroDaSegundaOferta() ? 'inscricao-segunda-oferta-erro' : null,
    ]
      .filter((id) => id !== null)
      .join(' '),
  );
  /** Os nomes dos cursos escolhidos, para as modalidades de cada opção terem título. */
  private readonly opcoesDeCurso = computed(() => ({
    primeira: this.ofertaEscolhidaValida()?.nome ?? null,
    segunda: this.segundaOfertaValida()?.nome ?? null,
  }));
  /** A avaliação da tela, com o curso de cada opção quando o processo admite 2. */
  protected readonly avaliacaoNaTela = computed<AvaliacaoNaTela | null>(() => {
    const avaliacao = this.avaliacao.naTela();
    return avaliacao && this.comSegundaOpcao()
      ? { ...avaliacao, opcoesDeCurso: this.opcoesDeCurso() }
      : avaliacao;
  });
  /**
   * O curso é o primeiro passo quando há mais de uma oferta; com uma só, ela é escolhida sozinha e
   * aparece no cabeçalho. Com 2 opções, o passo escolhe a 1ª e a 2ª (opcional).
   */
  protected readonly passosPrefixados = computed<readonly PassoPrefixado[]>(() => {
    const ofertas = this.ofertas();
    if (ofertas.length <= 1) return [];
    const nome = this.ofertaEscolhidaValida()?.nome ?? null;
    const comSegunda = this.comSegundaOpcao();
    return [
      {
        chave: PASSO_DO_CURSO,
        titulo: 'Curso',
        descricao: comSegunda
          ? 'Escolha o curso da 1ª opção e, se quiser, o da 2ª opção neste processo seletivo.'
          : 'Escolha o curso em que você quer se inscrever neste processo seletivo.',
        concluido: nome !== null,
        comErro: this.erroDaOferta() !== null || this.erroDaSegundaOferta() !== null,
        resumo: comSegunda
          ? [
              { rotulo: '1ª opção', valor: nome ?? 'Ainda não escolhida' },
              { rotulo: '2ª opção', valor: this.segundaOfertaValida()?.nome ?? 'Não declarada' },
            ]
          : [{ rotulo: 'Curso', valor: nome ?? 'Ainda não escolhido' }],
      },
    ];
  });
  private readonly selectDaOferta = viewChild<ElementRef<HTMLSelectElement>>('selectDaOferta');
  private readonly selectDaSegundaOferta =
    viewChild<ElementRef<HTMLSelectElement>>('selectDaSegundaOferta');
  private readonly formularioDoCandidato = viewChild(FormularioDoCandidatoComponent);

  protected readonly ocupada = signal(false);
  /**
   * Por que a página precisa ser recarregada, quando precisa: `envio` — o envio deu certo, mas a
   * releitura da inscrição falhou; `incerta` — a gravação falhou sem resposta ou com erro do servidor e a
   * releitura também falhou, então não se sabe se ela aconteceu. Nos dois casos o ETag da tela é o velho
   * e nada mais é gravado a partir dela.
   */
  protected readonly motivoDoRecarregar = signal<'envio' | 'incerta' | null>(null);
  protected readonly precisaRecarregar = computed(() => this.motivoDoRecarregar() !== null);
  /** O ETag está sendo relido depois de uma chamada de documento: gravar agora sairia com o velho. */
  private readonly relendoARevisao = signal(false);
  protected readonly bloqueada = computed(
    () => this.ocupada() || this.relendoARevisao() || this.precisaRecarregar(),
  );
  protected readonly errosDoServidor = signal<readonly ErroDoServidor[]>([]);
  /** A recusa sem campo para apontar: o título diz o que aconteceu e o texto, o que fazer. */
  protected readonly recusaGeral = signal<{ titulo: string; texto: string } | null>(null);
  protected readonly conflito = signal<string | null>(null);
  protected readonly aviso = signal('');
  protected readonly comprovante = signal<ComprovanteInscricaoDto | null>(null);

  /** A inscrição enviada só muda por novo envio, que emite novo comprovante: não há rascunho dela. */
  protected readonly enviada = computed(
    () => this.comprovante() !== null || this.inscricao()?.situacao === SituacaoInscricao.submetida,
  );

  /**
   * O nome civil, o nome social e o CPF vêm da conta e não se alteram aqui: entram na resposta do
   * formulário que os coleta. Quem muda o nome social é o titular, em Meu perfil; sem nome social na
   * conta o campo fica vazio e travado, e a resposta vai como nula para não manter um nome gravado que
   * a conta não tem. Só o CPF aparece mascarado, e o titular o revela a partir do próprio login.
   */
  protected readonly respostasFixas = computed<Readonly<Record<string, RespostaFixa>>>(() => {
    const cpf = this.usuario.user()?.cpf.replace(/\D/g, '') ?? '';
    const formulario = this.formulario();
    const coleta = (fato: string): boolean => formulario !== null && coletaO(formulario, fato);
    const fixas: Record<string, RespostaFixa> = {};
    const nome = this.usuario.user()?.nomeCivil?.trim() ?? '';
    if (coleta('NOME') && nome !== '') fixas['NOME'] = { valor: nome, exibicao: nome };
    if (coleta('NOME_SOCIAL')) {
      const social = this.nomeSocialDaConta();
      fixas['NOME_SOCIAL'] =
        social === '' ? { valor: null, exibicao: '' } : { valor: social, exibicao: social };
    }
    if (coleta('CPF') && isValidCpf(cpf)) {
      fixas['CPF'] = { valor: cpf, exibicao: mascararCpf(cpf), revelavel: cpfRevelavel(cpf) };
    }
    return fixas;
  });

  /**
   * A conta com nome social já abre o "deseja usar nome social?" como sim, mas a escolha continua do
   * candidato: o que já está gravado prevalece, inclusive a desistência de usá-lo.
   */
  private respostasDoNomeSocial(
    gravadas: Readonly<Record<string, ValorJson>>,
    formulario: FormularioRenderizavelDto,
  ): Record<string, ValorJson> {
    const coletaDeseja = coletaO(formulario, 'DESEJA_NOME_SOCIAL');
    if (this.nomeSocialDaConta() === '' || !coletaDeseja || 'DESEJA_NOME_SOCIAL' in gravadas) {
      return {};
    }
    return { DESEJA_NOME_SOCIAL: true };
  }

  /** O nome social da conta, vazio quando ela não tem. */
  private nomeSocialDaConta(): string {
    return this.usuario.user()?.nomeSocial?.trim() ?? '';
  }

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

  /** Inicia a inscrição e, com ela, lê o formulário da versão da inscrição e as ofertas do processo. */
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
        this.servico
          .obterFormulario(processoId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((formulario) => {
            if (!formulario.ok) return this.falharAoCarregar(formulario);
            const ofertas = ofertasDaInscricao(inscricao.data);
            const numeroDeOpcoes = numeroDeOpcoesDeCurso(inscricao.data.numeroDeOpcoesDeCurso);
            this.inscricao.set(inscricao.data);
            // As respostas chegam em JSON: são os valores que o formulário lê.
            const inicial: SimulacaoDoFormulario = {
              respostas: {
                ...this.respostasDoNomeSocial(
                  inscricao.data.respostas as Readonly<Record<string, ValorJson>>,
                  formulario.data,
                ),
                ...(inscricao.data.respostas as Readonly<Record<string, ValorJson>>),
              },
              grupos: inscricao.data.grupos as SimulacaoDoFormulario['grupos'],
            };
            this.inicial.set(inicial);
            // Com uma oferta só, ela é a escolha — mesmo que a gravada seja de outra que saiu do
            // processo —, para o cabeçalho e o envio dizerem o mesmo curso.
            const oferta =
              ofertas.length === 1
                ? ofertas[0].id
                : (ofertas.find((o) => o.id === inscricao.data.ofertaCursoId)?.id ?? null);
            // A 2ª opção só vale com a 1ª, com 2 opções admitidas e sendo outra oferta.
            const segunda =
              numeroDeOpcoes === 2 && oferta !== null
                ? (ofertas.find(
                    (o) => o.id === inscricao.data.ofertaCursoSegundaOpcaoId && o.id !== oferta,
                  )?.id ?? null)
                : null;
            this.avaliacao.iniciar(
              processoId,
              inscricao.data.avaliacao,
              formulario.data.dependenciasDaAvaliacao,
              inicial,
              oferta,
              segunda,
            );
            this.termosAceitosIniciais.set(inscricao.data.aceites.map((a) => a.codigo));
            this.instanteDoEnvio.set(this.relogio());
            this.formulario.set(formulario.data);
            this.acompanharODiaDoEnvio();
            this.ofertas.set(ofertas);
            this.numeroDeOpcoes.set(numeroDeOpcoes);
            this.ofertaEscolhida.set(oferta);
            this.segundaOfertaEscolhida.set(segunda);
            // A oferta que a versão em que está o rascunho retirou já vem sem seleção da API: o
            // campo aparece vazio, sem aviso, e o candidato confere na revisão.
            this.avisoDaSegundaLimpa.set(null);
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
      this.avaliacao.respostasMudaram(simulacao, () => this.corpoDaAvaliacao(inscricao, simulacao));
  }

  /** Repete o aviso para o leitor de tela mesmo quando o texto é o mesmo da tentativa anterior. */
  private anunciar(mensagem: string): void {
    this.aviso.set('');
    afterNextRender(() => this.aviso.set(mensagem), { injector: this.injector });
  }

  protected escolherOferta(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const oferta = valor === '' ? null : valor;
    this.ofertaEscolhida.set(oferta);
    this.erroDaOferta.set(null);
    if (
      this.codigoDaRecusaDaSegunda === null ||
      RECUSAS_DA_SEGUNDA_QUE_VEM_DA_PRIMEIRA.has(this.codigoDaRecusaDaSegunda)
    )
      this.erroDaSegundaOferta.set(null);
    this.limparASegundaQueNaoValeMais(oferta);
    this.reavaliarAsOfertas();
  }

  protected escolherSegundaOferta(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.segundaOfertaEscolhida.set(valor === '' ? null : valor);
    this.erroDaSegundaOferta.set(null);
    this.avisoDaSegundaLimpa.set(null);
    this.reavaliarAsOfertas();
  }

  /**
   * A 2ª opção não existe sem a 1ª nem é a mesma oferta dela: trocar a 1ª para o curso da 2ª, ou
   * retirá-la, limpa a 2ª, e o aviso diz isso ao candidato, que não a perde sem ver.
   */
  private limparASegundaQueNaoValeMais(primeira: string | null): void {
    const segunda = this.segundaOfertaEscolhida();
    if (segunda === null || (primeira !== null && primeira !== segunda)) return;
    const aviso =
      primeira === null
        ? 'A 2ª opção foi limpa porque a 1ª opção foi retirada.'
        : 'A 2ª opção foi limpa porque é o mesmo curso da nova 1ª opção. Escolha outro, se quiser.';
    this.segundaOfertaEscolhida.set(null);
    this.erroDaSegundaOferta.set(null);
    this.avisoDaSegundaLimpa.set(aviso);
    this.anunciar(aviso);
  }

  /**
   * Cada chamada de documento avança a revisão da inscrição. O ETag da tela é relido sem trocar as
   * respostas dela, ou o próximo salvar seria recusado e as respostas não salvas se perderiam.
   */
  private atualizarARevisaoEReavaliar(): void {
    this.relendoARevisao.set(true);
    this.servico
      .obter(this.processoId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.relendoARevisao.set(false);
        if (resultado.ok) {
          const eTag = resultado.data.eTag;
          this.inscricao.update((atual) => (atual ? { ...atual, eTag } : atual));
        } else {
          // Com o ETag velho na tela, o próximo salvar seria recusado e as respostas se perderiam.
          this.motivoDoRecarregar.set('incerta');
        }
        this.reavaliarDocumentos();
      });
  }

  /** Os arquivos enviados mudaram: a avaliação é pedida de novo com as respostas que estão na tela. */
  private reavaliarDocumentos(): void {
    const inscricao = this.inscricao();
    const formulario = this.formularioDoCandidato();
    if (inscricao && formulario)
      this.avaliacao.reavaliar(() => this.corpoDaAvaliacao(inscricao, formulario.simulacao()));
  }

  /** A oferta de alguma opção mudou na tela, sem gravar: a avaliação é pedida de novo com as novas. */
  private reavaliarAsOfertas(): void {
    // Lido do formulário na troca: a emissão das mudanças só chega no ciclo seguinte.
    const inscricao = this.inscricao();
    const formulario = this.formularioDoCandidato();
    if (inscricao && formulario)
      this.avaliacao.ofertaMudou(
        this.ofertaEscolhida(),
        this.segundaOfertaValida()?.id ?? null,
        () => this.corpoDaAvaliacao(inscricao, formulario.simulacao()),
      );
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
    if (this.bloqueada()) return;
    // O curso é o primeiro passo: sem ele a inscrição não segue. As pendências das seções são
    // contadas na mesma tentativa, e o foco fica no curso.
    const semCurso = this.ofertas().length > 1 && this.ofertaEscolhidaValida() === null;
    // O envio conclui todas as seções: com pendência, o formulário leva à primeira e nada é enviado.
    // Sem curso, só as conta: quem leva o candidato é o passo Curso.
    const pendencias = this.formularioDoCandidato()?.concluirTodas(!semCurso) ?? 0;
    if (semCurso) {
      const mensagem = mensagemDaRecusa('uniplus.selecao.inscricao.oferta_obrigatoria');
      this.recusarOfertas(mensagem, null);
      this.anunciar(
        pendencias > 0
          ? `${mensagem} Há também ${pendencias === 1 ? '1 item' : `${pendencias} itens`} a corrigir nas seções.`
          : mensagem,
      );
      return;
    }
    if (pendencias > 0) return;
    this.gravar(
      (request, eTag) => this.servico.submeter(this.processoId(), request, eTag),
      (comprovante) => {
        this.comprovante.set(comprovante);
        this.aviso.set(`Inscrição enviada. Número ${comprovante.numeroInscricao}.`);
        // O formulário só se libera com o ETag novo: antes disso, uma correção sairia com o velho.
        this.relerAGravada((lida) => {
          this.ocupada.set(false);
          if (!lida) this.motivoDoRecarregar.set('envio');
        });
      },
    );
  }

  /**
   * O envio devolve o comprovante, não a inscrição: sem reler, a próxima correção sairia com o ETag velho.
   * `aoTerminar` diz se a releitura trouxe a inscrição. Com `eTagDaTentativa`, a releitura só substitui
   * a inscrição e a avaliação da tela se o ETag mudou: com o mesmo, nada foi gravado, e a avaliação
   * gravada descreve respostas mais antigas que as da tela.
   */
  private relerAGravada(aoTerminar?: (lida: boolean) => void, eTagDaTentativa?: string): void {
    const revisao = this.avaliacao.revisao();
    this.servico
      .obter(this.processoId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok && resultado.data.eTag !== eTagDaTentativa) {
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
    this.erroDaSegundaOferta.set(null);
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
        this.tratarRecusa(resultado);
      });
  }

  /** O corpo do salvar e do envio: as respostas, as ofertas escolhidas e os termos aceitos. */
  private request(
    inscricao: InscricaoDto,
    simulacao: SimulacaoDoFormulario,
    termosAceitos: readonly string[],
  ): InscricaoRequest {
    const termos = new Map((this.formulario()?.termos ?? []).map((t) => [t.codigo, t]));
    return {
      ofertaCursoId: this.ofertaEscolhidaValida()?.id ?? null,
      ofertaCursoSegundaOpcaoId: this.segundaOfertaValida()?.id ?? null,
      ...this.respostasDoCorpo(inscricao, simulacao),
      aceites: termosAceitos.flatMap((codigo) => {
        const termo = termos.get(codigo);
        return termo ? [{ codigo, versaoId: termo.versaoId, hashVersao: termo.hashVersao }] : [];
      }),
    };
  }

  /** O corpo da consulta de avaliação: as respostas da tela e as ofertas escolhidas nela, ou `null`. */
  private corpoDaAvaliacao(
    inscricao: InscricaoDto,
    simulacao: SimulacaoDoFormulario,
  ): AvaliacaoDaInscricaoRequest {
    return {
      ...this.respostasDoCorpo(inscricao, simulacao),
      ofertaCursoId: this.ofertaEscolhidaValida()?.id ?? null,
      ofertaCursoSegundaOpcaoId: this.segundaOfertaValida()?.id ?? null,
    };
  }

  /**
   * As respostas e as ocorrências como o servidor as mescla ao gravado. A resposta que o candidato
   * apagou vai como `null`: ausente do corpo, o servidor manteria a gravada. O grupo que o candidato
   * removeu vai como lista vazia, pelo mesmo motivo: ausente do corpo, o servidor manteria as
   * ocorrências gravadas; enviado, ele as substitui. O nome social da conta só vai quando o candidato
   * escolhe usá-lo: com a recusa, a resposta vai nula, e a inscrição não guarda um nome que ele não
   * quis usar.
   */
  private respostasDoCorpo(
    inscricao: InscricaoDto,
    simulacao: SimulacaoDoFormulario,
  ): Pick<AvaliacaoDaInscricaoRequest, 'respostas' | 'grupos'> {
    const respostas: Record<string, unknown> = { ...(simulacao.respostas ?? {}) };
    for (const fato of Object.keys(inscricao.respostas)) {
      if (!(fato in respostas)) respostas[fato] = null;
    }
    if ('NOME_SOCIAL' in respostas && respostas['DESEJA_NOME_SOCIAL'] !== true) {
      respostas['NOME_SOCIAL'] = null;
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

  /** Libera o formulário ao fim, exceto na falha ambígua, que só o libera quando a releitura termina. */
  private tratarRecusa(falha: ApiFailure): void {
    if (CONFLITOS.has(falha.problem.code)) {
      this.ocupada.set(false);
      this.conflito.set(
        'Recarregamos a inscrição com a versão mais recente, e o formulário pode ter mudado. Confira as respostas e grave de novo.',
      );
      this.carregar();
      return;
    }
    const ambigua = falha.status === 0 || falha.status >= 500;
    this.exibirRecusa(falha, ambigua);
    if (ambigua) this.confirmarGravacao();
    else this.ocupada.set(false);
  }

  /**
   * A gravação pode ter acontecido sem a resposta chegar: o formulário só se libera com o ETag relido.
   * Se o ETag mudou, a gravação aconteceu e a tela passa a mostrar o estado do servidor, sem a recusa
   * neutra, e o aviso confirma o que foi gravado; se a releitura falha, quem fala é o aviso de recarregar.
   */
  private confirmarGravacao(): void {
    const eTagDaTentativa = this.inscricao()?.eTag;
    this.relerAGravada((lida) => {
      this.ocupada.set(false);
      if (!lida) {
        this.motivoDoRecarregar.set('incerta');
        this.recusaGeral.set(null);
      } else {
        const relida = this.inscricao();
        if (relida && relida.eTag !== eTagDaTentativa) {
          this.recusaGeral.set(null);
          this.aviso.set(confirmacaoDaGravacao(relida));
        }
      }
    }, eTagDaTentativa);
  }

  /** Mostra a recusa no campo, numa das ofertas ou, sem onde apontar, como recusa geral. */
  private exibirRecusa(falha: ApiFailure, ambigua: boolean): void {
    const recusas = falha.problem.errors ?? [];
    const daOferta = recusas.find((e) => e.field === CAMPO_DA_OFERTA);
    const daSegunda = recusas.find((e) => e.field === CAMPO_DA_SEGUNDA_OPCAO);
    this.codigoDaRecusaDaSegunda = daSegunda?.code ?? null;
    const porCampo = recusas
      .filter((e) => e.field !== CAMPO_DA_OFERTA && e.field !== CAMPO_DA_SEGUNDA_OPCAO)
      .map((e) => ({ campo: e.field, mensagem: mensagemDaRecusa(e.code) }));
    const dasOfertas =
      daOferta || daSegunda
        ? this.recusarOfertas(
            daOferta ? mensagemDaRecusa(daOferta.code) : null,
            daSegunda ? mensagemDaRecusaDaSegundaOpcao(daSegunda.code) : null,
          )
        : 0;
    if (porCampo.length > 0) this.errosDoServidor.set(porCampo);
    const total = porCampo.length + dasOfertas;
    if (total > 0) {
      this.aviso.set(
        total === 1
          ? 'Uma resposta foi recusada. Corrija e tente de novo.'
          : `${total} respostas foram recusadas. Corrija e tente de novo.`,
      );
      return;
    }
    if (ambigua) {
      this.recusaGeral.set({
        titulo: 'Não conseguimos confirmar a gravação',
        texto: 'Confira as respostas e tente de novo.',
      });
      return;
    }
    const mensagem = this.problemas.resolve(falha.problem);
    this.recusaGeral.set({
      titulo: TITULO_DA_RECUSA,
      texto: mensagem.detail ?? mensagem.title,
    });
  }

  /**
   * Sem o passo Curso na tela, a recusa da oferta só pode aparecer como recusa geral. Com ele, cada
   * mensagem fica junto do campo da opção, e o foco vai para o primeiro campo recusado.
   */
  private recusarOfertas(daPrimeira: string | null, daSegunda: string | null): number {
    const semPasso = this.ofertas().length <= 1;
    // A recusa da 2ª num processo que não a oferece não tem campo: o texto dela vai como recusa geral.
    const semCampoDaSegunda = !semPasso && !this.comSegundaOpcao();
    const textoGeral = semPasso ? (daPrimeira ?? daSegunda) : semCampoDaSegunda ? daSegunda : null;
    if (textoGeral !== null) this.recusaGeral.set({ titulo: TITULO_DA_RECUSA, texto: textoGeral });
    // Sem passo, só um texto aparece; com ele, um por opção recusada.
    const mostradas = semPasso ? 1 : (daPrimeira === null ? 0 : 1) + (daSegunda === null ? 0 : 1);
    if (semPasso || (daPrimeira === null && semCampoDaSegunda)) return mostradas;
    this.erroDaOferta.set(daPrimeira);
    this.erroDaSegundaOferta.set(semCampoDaSegunda ? null : daSegunda);
    // O campo só existe depois de o passo aparecer: a escolha do foco espera por ele.
    this.formularioDoCandidato()?.irAoPasso(PASSO_DO_CURSO, () => {
      const segunda = this.selectDaSegundaOferta()?.nativeElement;
      return daPrimeira === null && segunda && !segunda.disabled
        ? segunda
        : (this.selectDaOferta()?.nativeElement ?? null);
    });
    return mostradas;
  }
}
