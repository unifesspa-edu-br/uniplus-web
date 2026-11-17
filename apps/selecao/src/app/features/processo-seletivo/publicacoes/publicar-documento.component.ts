import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import {
  ProblemI18nService,
  isApiOk,
  type ApiResult,
  type ProblemDetails,
  ChaveDeSubstituicao,
  comChave,
  type RespostaDoComando,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  FinalidadeDoDocumento,
  DocumentosEAtosDoProcessoApi,
  type AtoDoProcessoDto,
  type AtoPublicadoDto,
  type ProdutoPrevistoDto,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  FileUploadComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import {
  TAMANHO_MAXIMO_DO_ANEXO_MB,
  extensaoDoArquivo,
  nomeInicialDoAnexo,
  tipoDeMidiaDoAnexo,
} from '../wizard/shared/anexos-do-edital/anexos-do-edital';
import { AnexosDoEdital } from '../wizard/shared/anexos-do-edital/envio-do-anexo.service';
import { AnexosDaPublicacaoComponent } from './anexos-da-publicacao.component';
import { rotuloDoAto } from './apresentacao-do-ato';
import { mensagemDoErroDoCampo, type CampoDoFormulario } from './campos-da-publicacao';
import { EnviosDeArquivos, type DependenciasDosEnvios } from './envios-de-arquivos';
import {
  ajustarObrigatoriedade,
  criarFormularioDaPublicacao,
  esvaziar,
} from './formulario-da-publicacao';
import {
  atoDaCorrecao,
  escolheOTipo,
  itemDo,
  politicaDo,
  tituloDa,
  type ModoDaPublicacao,
} from './modo-da-publicacao';
import { impedimentosDosArquivos } from './impedimentos-da-publicacao';
import { pedidoDoAto, pedidoDoItem, type DadosDoItem } from './pedido-do-ato';
import { rotuloDoPapel } from './previstos-do-edital';
import {
  MENSAGEM_DA_PUBLICACAO_INCONCLUSIVA,
  distribuirRecusaDaPublicacao,
} from './recusa-da-publicacao';

const TAMANHO_MAXIMO_DO_PRINCIPAL_MB = TAMANHO_MAXIMO_DO_ANEXO_MB;
const TIPO_DE_MIDIA_DO_PRINCIPAL = 'application/pdf';

interface EnvioDaPublicacao {
  readonly pedido: object;
  readonly enviar: (contexto: HttpContext) => Observable<ApiResult<AtoPublicadoDto>>;
}

/**
 * O formulário lateral que publica um documento avulso do processo, corrige um ato já publicado
 * ou publica um item que o edital declara, com a política de divulgação do certame quando o item é
 * resultado.
 *
 * O servidor decide o que vale: quais tipos servem a documento avulso, a vigência, a cadeia de
 * correção e os documentos. A tela oferece o que o catálogo declara, avisa antes do que não se
 * desfaz e mostra a recusa sem perder o que foi preenchido nem os arquivos já enviados.
 */
@Component({
  selector: 'sel-publicar-documento',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DateBrPipe,
    DrawerComponent,
    FileUploadComponent,
    SpinnerComponent,
    AnexosDaPublicacaoComponent,
  ],
  providers: [AnexosDoEdital],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './publicar-documento.component.html',
  styleUrl: './publicar-documento.component.css',
})
export class PublicarDocumentoComponent {
  private readonly api = inject(DocumentosEAtosDoProcessoApi);
  private readonly envios = inject(AnexosDoEdital);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly processoId = input.required<string>();
  /** O que se publica; `null` com o formulário fechado. */
  readonly modo = input<ModoDaPublicacao | null>(null);
  /** Os tipos que o catálogo declara publicáveis como documento avulso e que vigoram hoje. */
  readonly tipos = input<readonly TipoAtoPublicadoDto[]>([]);
  /** Os atos que podem ser o corrigido de um ato novo. */
  readonly atosCorrigiveis = input<readonly AtoDoProcessoDto[]>([]);
  readonly aberto = model(false);

  /** O ato foi publicado pelo servidor. */
  readonly publicado = output<void>();

  protected readonly tamanhoMaximoDoPrincipalMb = TAMANHO_MAXIMO_DO_PRINCIPAL_MB;
  protected readonly apenasPdf: readonly string[] = [TIPO_DE_MIDIA_DO_PRINCIPAL];
  protected readonly rotuloDoAto = rotuloDoAto;

  protected readonly form = criarFormularioDaPublicacao();

  protected readonly principal = this.listaDeEnvios({
    tipoDeMidiaDe: (nomeArquivo) =>
      extensaoDoArquivo(nomeArquivo) === 'pdf' ? TIPO_DE_MIDIA_DO_PRINCIPAL : null,
    recusaDoFormato: 'O documento principal precisa ser um PDF.',
  });

  protected readonly anexos = this.listaDeEnvios({
    tipoDeMidiaDe: tipoDeMidiaDoAnexo,
    recusaDoFormato: 'O formato do arquivo não é aceito para anexo.',
  });

  protected readonly publicando = signal(false);
  protected readonly recusa = signal<readonly string[]>([]);
  protected readonly confirmando = signal(false);
  protected readonly tentouEnviar = signal(false);

  protected readonly impedimentos = computed(() =>
    this.tentouEnviar()
      ? impedimentosDosArquivos({
          principal: this.principal,
          anexos: this.anexos,
          semAtoParaCorrigir: this.escolheOAtoCorrigido() && this.atosCorrigiveis().length === 0,
        })
      : [],
  );

  private chave = new ChaveDeSubstituicao();
  private readonly resumo = viewChild<ElementRef<HTMLElement>>('resumo');

  private readonly tipoEscolhido = toSignal(this.form.controls.tipoAtoCodigo.valueChanges, {
    initialValue: this.form.controls.tipoAtoCodigo.value,
  });

  protected readonly opcoesDeTipo = computed(() => this.tipos());

  protected readonly tipoSelecionado = computed(() =>
    this.opcoesDeTipo().find((tipo) => tipo.codigo === this.tipoEscolhido()),
  );

  protected readonly atoDaCorrecao = computed(() => atoDaCorrecao(this.modo()));
  protected readonly escolheOTipo = computed(() => escolheOTipo(this.modo()));
  protected readonly item = computed(() => itemDo(this.modo()));
  protected readonly politica = computed(() => politicaDo(this.modo()));
  protected readonly titulo = computed(() => tituloDa(this.modo()));

  protected readonly escolheOAtoCorrigido = computed(
    () => this.atoDaCorrecao() === null && this.tipoSelecionado()?.exigeAtoCorrigido === true,
  );

  protected readonly corrige = computed(
    () => this.atoDaCorrecao() !== null || this.escolheOAtoCorrigido(),
  );

  protected readonly rotuloDoPapel = rotuloDoPapel;

  protected readonly semTipoParaCorrecao = computed(
    () => this.modo()?.tipo === 'correcao' && this.opcoesDeTipo().length === 0,
  );

  protected readonly resumoVisivel = computed(
    () => this.recusa().length > 0 || this.impedimentos().length > 0,
  );

  constructor() {
    effect(() => {
      if (!this.aberto()) return;
      const modo = untracked(() => this.modo());
      untracked(() => this.iniciar(modo));
    });

    effect(() => {
      const exigencias = {
        motivoDaCorrecao: this.corrige(),
        atoCorrigido: this.escolheOAtoCorrigido(),
        tipoDoAto: this.escolheOTipo(),
        confirmacaoDaPolitica: this.politica() !== null,
      };
      untracked(() => ajustarObrigatoriedade(this.form, exigencias));
    });
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected aoFechar(): void {
    this.confirmando.set(false);
  }

  protected solicitar(): void {
    if (this.publicando()) return;

    this.tentouEnviar.set(true);
    this.recusa.set([]);
    this.form.markAllAsTouched();

    if (this.impedimentos().length > 0) {
      this.focarResumo();
      return;
    }
    if (this.form.invalid) {
      this.focarPrimeiroCampoInvalido();
      return;
    }
    this.confirmando.set(true);
  }

  protected async publicar(): Promise<void> {
    const principal = this.principal.confirmados()[0];
    if (principal === undefined || this.publicando()) return;

    const { resultado, inconclusiva } = await this.enviarPublicacao(
      this.montarEnvio(principal.documentoAPublicarId),
    );
    if (isApiOk(resultado)) {
      this.concluirPublicacao();
    } else {
      this.mostrarRecusa(resultado.problem, inconclusiva);
    }
  }

  protected erroDoCampo(campo: CampoDoFormulario): string | null {
    const controle = this.form.controls[campo];
    if (!(controle.touched || controle.dirty) || controle.errors === null) return null;

    return mensagemDoErroDoCampo(campo, controle.errors);
  }

  private async enviarPublicacao(
    envio: EnvioDaPublicacao,
  ): Promise<RespostaDoComando<AtoPublicadoDto>> {
    this.publicando.set(true);
    this.form.disable({ emitEvent: false });
    const resposta = await comChave(this.chave, envio.pedido, envio.enviar);
    this.publicando.set(false);
    this.form.enable({ emitEvent: false });
    return resposta;
  }

  private concluirPublicacao(): void {
    this.notificacoes.success(
      'Documento publicado',
      'Ele já aparece na lista de documentos publicados.',
    );
    this.aberto.set(false);
    this.publicado.emit();
  }

  private listaDeEnvios(
    formato: Pick<DependenciasDosEnvios, 'tipoDeMidiaDe' | 'recusaDoFormato'>,
  ): EnviosDeArquivos {
    return new EnviosDeArquivos({
      ...formato,
      finalidade: FinalidadeDoDocumento.documentoDeAto,
      processoId: () => this.processoId(),
      abrirEnvio: () => this.envios.abrirEnvio(),
      explicar: (problema) => this.problemI18n.resolve(problema).title,
      nomeInicial: nomeInicialDoAnexo,
    });
  }

  private iniciar(modo: ModoDaPublicacao | null): void {
    this.principal.descartar();
    this.anexos.descartar();
    this.chave = new ChaveDeSubstituicao();
    this.recusa.set([]);
    this.tentouEnviar.set(false);
    this.confirmando.set(false);

    esvaziar(this.form);

    if (modo?.tipo === 'correcao' && this.tipos().length === 1) {
      this.form.controls.tipoAtoCodigo.setValue(this.tipos()[0].codigo);
    }
  }

  private montarEnvio(documentoPrincipalId: string): EnvioDaPublicacao {
    const item = this.item();
    return item === null
      ? this.envioDoAtoAvulso(documentoPrincipalId)
      : this.envioDoItem(item, documentoPrincipalId);
  }

  private envioDoItem(item: ProdutoPrevistoDto, documentoPrincipalId: string): EnvioDaPublicacao {
    const politicaConfirmada =
      this.politica() !== null && this.form.controls.politicaDeDivulgacaoConfirmada.value;
    const pedido = pedidoDoItem(
      this.dadosDoPedido(),
      documentoPrincipalId,
      this.anexos.confirmados(),
      politicaConfirmada,
    );
    const processoId = this.processoId();
    return {
      pedido,
      enviar: (contexto) => this.api.publicarProdutoPrevisto(processoId, item.id, pedido, contexto),
    };
  }

  private envioDoAtoAvulso(documentoPrincipalId: string): EnvioDaPublicacao {
    const tipoAtoCodigo = this.form.controls.tipoAtoCodigo.value;
    const dados = { ...this.dadosDoPedido(), tipoAtoCodigo };
    const pedido = pedidoDoAto(dados, documentoPrincipalId, this.anexos.confirmados());
    const processoId = this.processoId();
    return {
      pedido,
      enviar: (contexto) => this.api.publicarAtoAvulso(processoId, pedido, contexto),
    };
  }

  private dadosDoPedido(): DadosDoItem {
    const valores = this.form.getRawValue();
    const corrigidoEscolhido = this.escolheOAtoCorrigido() ? valores.atoCorrigidoId : null;
    return {
      numero: valores.numero,
      dataDoAto: valores.dataDoAto,
      assinante: valores.assinante,
      atoCorrigidoId: this.atoDaCorrecao()?.id ?? corrigidoEscolhido,
      motivoDaCorrecao: valores.motivoDaCorrecao,
    };
  }

  private mostrarRecusa(problema: ProblemDetails, inconclusiva: boolean): void {
    const titulo = this.problemI18n.resolve(problema).title;
    const recusa = distribuirRecusaDaPublicacao(titulo, problema.errors);
    for (const [campo, mensagem] of recusa.dosCampos) {
      const controle = this.form.controls[campo];
      controle.setErrors({ ...controle.errors, servidor: { mensagem } });
      controle.markAsTouched();
    }
    this.recusa.set(
      inconclusiva ? [...recusa.mensagens, MENSAGEM_DA_PUBLICACAO_INCONCLUSIVA] : recusa.mensagens,
    );
    this.focarResumo();
  }

  private focarPrimeiroCampoInvalido(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }

  private focarResumo(): void {
    afterNextRender(() => this.resumo()?.nativeElement.focus(), { injector: this.injector });
  }
}
