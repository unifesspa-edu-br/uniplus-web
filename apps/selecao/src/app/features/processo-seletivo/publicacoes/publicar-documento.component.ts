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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProblemI18nService, isApiOk, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  FinalidadeDoDocumento,
  ProcessosSeletivosApi,
  type AtoDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  FileUploadComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { ChaveDeSubstituicao } from '../steps/shared/chave-de-substituicao';
import { comChave } from '../steps/shared/comando-com-chave';
import {
  EXTENSOES_DO_ANEXO,
  LIMITE_DE_ANEXOS,
  TAMANHO_MAXIMO_DO_ANEXO_MB,
  extensaoDoArquivo,
  nomeInicialDoAnexo,
  nomeNoDownload,
  recusaDoNomeDoAnexo,
  tipoDeMidiaDoAnexo,
} from '../steps/shared/anexos-do-edital/anexos-do-edital';
import { AnexosDoEditalService } from '../steps/shared/anexos-do-edital/envio-do-anexo.service';
import { hojeNoFusoInstitucional } from '../steps/shared/fuso-institucional';
import { rotuloDoAto } from './apresentacao-do-ato';
import { EnviosDeArquivos, type ArquivoDoAto } from './envios-de-arquivos';
import { pedidoDoAto } from './pedido-do-ato';

/** O que o formulário publica: um documento novo ou a correção de um ato já publicado. */
export type ModoDaPublicacao =
  | { readonly tipo: 'avulso' }
  | { readonly tipo: 'correcao'; readonly ato: AtoDoProcessoDto };

/** O teto do documento principal: o mesmo dos anexos. */
const TAMANHO_MAXIMO_DO_PRINCIPAL_MB = TAMANHO_MAXIMO_DO_ANEXO_MB;
const TIPO_DE_MIDIA_DO_PRINCIPAL = 'application/pdf';

const NUMERO_TAMANHO_MAXIMO = 60;
const ASSINANTE_TAMANHO_MAXIMO = 200;
const MOTIVO_TAMANHO_MAXIMO = 1000;

type CampoDoFormulario =
  | 'tipoAtoCodigo'
  | 'numero'
  | 'dataPublicacao'
  | 'assinante'
  | 'atoCorrigidoId'
  | 'motivoDaCorrecao';

const CAMPOS: ReadonlySet<string> = new Set<CampoDoFormulario>([
  'tipoAtoCodigo',
  'numero',
  'dataPublicacao',
  'assinante',
  'atoCorrigidoId',
  'motivoDaCorrecao',
]);

/**
 * O formulário lateral que publica um documento avulso do processo, ou corrige um ato já publicado.
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
  ],
  providers: [AnexosDoEditalService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './publicar-documento.component.html',
  styleUrl: './publicar-documento.component.css',
})
export class PublicarDocumentoComponent {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly envios = inject(AnexosDoEditalService);
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

  /** O ato foi aceito pelo servidor; ainda aguarda o registro. */
  readonly publicado = output<void>();

  protected readonly extensoesDoAnexo = EXTENSOES_DO_ANEXO;
  protected readonly limiteDeAnexos = LIMITE_DE_ANEXOS;
  protected readonly tamanhoMaximoMb = TAMANHO_MAXIMO_DO_ANEXO_MB;
  protected readonly tamanhoMaximoDoPrincipalMb = TAMANHO_MAXIMO_DO_PRINCIPAL_MB;
  protected readonly apenasPdf: readonly string[] = [TIPO_DE_MIDIA_DO_PRINCIPAL];
  protected readonly rotuloDoAto = rotuloDoAto;

  protected readonly form = new FormGroup({
    tipoAtoCodigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    numero: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(NUMERO_TAMANHO_MAXIMO)],
    }),
    dataPublicacao: new FormControl(hojeNoFusoInstitucional(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    assinante: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(ASSINANTE_TAMANHO_MAXIMO)],
    }),
    atoCorrigidoId: new FormControl('', { nonNullable: true }),
    motivoDaCorrecao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MOTIVO_TAMANHO_MAXIMO)],
    }),
  });

  protected readonly principal = new EnviosDeArquivos({
    finalidade: FinalidadeDoDocumento.documentoDeAto,
    processoId: () => this.processoId(),
    abrirEnvio: () => this.envios.abrirEnvio(),
    tipoDeMidiaDe: (nomeArquivo) =>
      extensaoDoArquivo(nomeArquivo) === 'pdf' ? TIPO_DE_MIDIA_DO_PRINCIPAL : null,
    recusaDoFormato: 'O documento principal precisa ser um PDF.',
    explicar: (problema) => this.problemI18n.resolve(problema).title,
    nomeInicial: nomeInicialDoAnexo,
  });

  protected readonly anexos = new EnviosDeArquivos({
    finalidade: FinalidadeDoDocumento.documentoDeAto,
    processoId: () => this.processoId(),
    abrirEnvio: () => this.envios.abrirEnvio(),
    tipoDeMidiaDe: tipoDeMidiaDoAnexo,
    recusaDoFormato: 'O formato do arquivo não é aceito para anexo.',
    explicar: (problema) => this.problemI18n.resolve(problema).title,
    nomeInicial: nomeInicialDoAnexo,
  });

  protected readonly publicando = signal(false);
  /** O que o servidor recusou, para a pessoa corrigir sem recomeçar. */
  protected readonly recusa = signal<readonly string[]>([]);
  protected readonly confirmando = signal(false);
  protected readonly tentouEnviar = signal(false);

  /**
   * Por que ainda não dá para publicar, mostrado depois da primeira tentativa e atualizado a cada
   * mudança: a pessoa vê o aviso sumir quando resolve o que faltava.
   */
  protected readonly impedimentos = computed(() =>
    this.tentouEnviar() ? this.impedimentosDosArquivos() : [],
  );

  private chave = new ChaveDeSubstituicao();
  private readonly resumo = viewChild<ElementRef<HTMLElement>>('resumo');

  private readonly tipoEscolhido = toSignal(this.form.controls.tipoAtoCodigo.valueChanges, {
    initialValue: this.form.controls.tipoAtoCodigo.value,
  });

  /**
   * Os tipos que a pessoa pode escolher: todos os publicáveis como documento avulso. Aviso e
   * comunicado também corrigem um ato que não congela; `exigeAtoCorrigido` só diz que o tipo não
   * se publica sem o ato corrigido.
   */
  protected readonly opcoesDeTipo = computed(() => this.tipos());

  protected readonly tipoSelecionado = computed(() =>
    this.opcoesDeTipo().find((tipo) => tipo.codigo === this.tipoEscolhido()),
  );

  /** O ato que este corrige, fixo quando a pessoa clicou em "Corrigir" num ato. */
  protected readonly atoDaCorrecao = computed(() => {
    const modo = this.modo();
    return modo?.tipo === 'correcao' ? modo.ato : null;
  });

  /** O ato corrigido é escolhido na tela quando o tipo o exige e nenhum foi fixado. */
  protected readonly escolheOAtoCorrigido = computed(
    () => this.atoDaCorrecao() === null && this.tipoSelecionado()?.exigeAtoCorrigido === true,
  );

  protected readonly corrige = computed(
    () => this.atoDaCorrecao() !== null || this.escolheOAtoCorrigido(),
  );

  protected readonly titulo = computed(() => {
    const ato = this.atoDaCorrecao();
    return ato === null ? 'Publicar documento' : `Corrigir ${rotuloDoAto(ato)}`;
  });

  protected readonly semTipoParaCorrecao = computed(
    () => this.modo()?.tipo === 'correcao' && this.opcoesDeTipo().length === 0,
  );

  /** O resumo que explica por que ainda não foi publicado: a recusa do servidor ou o que falta. */
  protected readonly resumoVisivel = computed(
    () => this.recusa().length > 0 || this.impedimentos().length > 0,
  );

  /** Os anexos já selados, com o campo do nome; os demais só aparecem na lista de envio. */
  protected readonly anexosConfirmados = computed(() =>
    this.anexos.arquivos().filter((arquivo) => arquivo.fase === 'confirmado'),
  );

  constructor() {
    // Cada abertura é um documento novo: nada do anterior sobrevive, nem o que foi enviado.
    effect(() => {
      if (!this.aberto()) return;
      const modo = untracked(() => this.modo());
      untracked(() => this.iniciar(modo));
    });

    // O motivo e o ato corrigido só são obrigatórios quando o ato corrige outro.
    effect(() => {
      const exige = this.corrige();
      const escolhe = this.escolheOAtoCorrigido();
      untracked(() => {
        this.trocarObrigatoriedade(this.form.controls.motivoDaCorrecao, exige);
        this.trocarObrigatoriedade(this.form.controls.atoCorrigidoId, escolhe);
      });
    });
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected aoFechar(): void {
    this.confirmando.set(false);
  }

  /** Confere o que a tela sabe conferir antes de pedir a confirmação do que não se desfaz. */
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

    const valores = this.form.getRawValue();
    const ato = this.atoDaCorrecao();
    const pedido = pedidoDoAto(
      {
        tipoAtoCodigo: valores.tipoAtoCodigo,
        numero: valores.numero,
        dataPublicacao: valores.dataPublicacao,
        assinante: valores.assinante,
        atoCorrigidoId: ato?.id ?? (this.escolheOAtoCorrigido() ? valores.atoCorrigidoId : null),
        motivoDaCorrecao: valores.motivoDaCorrecao,
      },
      principal.documentoAPublicarId,
      this.anexos.confirmados(),
    );

    this.publicando.set(true);
    this.form.disable({ emitEvent: false });
    const processoId = this.processoId();
    const { resultado, inconclusiva } = await comChave(this.chave, pedido, (contexto) =>
      this.api.publicarAtoAvulso(processoId, pedido, contexto),
    );
    this.publicando.set(false);
    this.form.enable({ emitEvent: false });

    if (isApiOk(resultado)) {
      this.notificacoes.success(
        'Documento enviado para publicação',
        'O registro leva alguns instantes: a situação aparece na lista.',
      );
      this.aberto.set(false);
      this.publicado.emit();
      return;
    }

    this.mostrarRecusa(resultado.problem, inconclusiva);
  }

  protected erroDoCampo(campo: CampoDoFormulario): string | null {
    const controle = this.form.controls[campo];
    if (!(controle.touched || controle.dirty) || controle.errors === null) return null;

    const doServidor = controle.errors['servidor'] as { readonly mensagem: string } | undefined;
    if (doServidor !== undefined) return doServidor.mensagem;
    if (controle.errors['required']) return 'Campo obrigatório.';
    if (controle.errors['maxlength']) return 'O texto passa do tamanho permitido.';
    return 'Valor inválido.';
  }

  protected renomear(arquivo: ArquivoDoAto, evento: Event): void {
    this.anexos.renomear(arquivo.id, (evento.target as HTMLInputElement).value);
  }

  protected recusaDoNome(arquivo: ArquivoDoAto): string | null {
    return recusaDoNomeDoAnexo(arquivo.nome, arquivo.nomeArquivo);
  }

  protected nomeBaixado(arquivo: ArquivoDoAto): string {
    return nomeNoDownload(arquivo.nome, arquivo.nomeArquivo);
  }

  private iniciar(modo: ModoDaPublicacao | null): void {
    this.principal.descartar();
    this.anexos.descartar();
    this.chave = new ChaveDeSubstituicao();
    this.recusa.set([]);
    this.tentouEnviar.set(false);
    this.confirmando.set(false);

    this.form.reset({
      tipoAtoCodigo: '',
      numero: '',
      dataPublicacao: hojeNoFusoInstitucional(),
      assinante: '',
      atoCorrigidoId: '',
      motivoDaCorrecao: '',
    });

    // Com um tipo só a oferecer, não faz sentido pedir a escolha.
    if (modo?.tipo === 'correcao' && this.tipos().length === 1) {
      this.form.controls.tipoAtoCodigo.setValue(this.tipos()[0].codigo);
    }
  }

  /** O que impede de publicar por causa dos arquivos: cada recusa é a que o servidor faria. */
  private impedimentosDosArquivos(): readonly string[] {
    const mensagens: string[] = [];

    if (this.principal.arquivos().length === 0) {
      mensagens.push('Envie o documento principal, em PDF.');
    } else if (this.principal.naoConfirmados() > 0) {
      mensagens.push(
        'O documento principal não foi enviado por completo. Aguarde o envio, tente de novo ou retire o arquivo.',
      );
    }

    if (this.anexos.arquivos().length > LIMITE_DE_ANEXOS) {
      mensagens.push(`O documento aceita no máximo ${LIMITE_DE_ANEXOS} anexos.`);
    }
    if (this.anexos.naoConfirmados() > 0) {
      mensagens.push(
        'Há anexo que não foi enviado por completo. Aguarde o envio, tente de novo ou retire o anexo.',
      );
    }
    for (const anexo of this.anexosConfirmados()) {
      const recusa = recusaDoNomeDoAnexo(anexo.nome, anexo.nomeArquivo);
      if (recusa !== null) mensagens.push(`Anexo ${anexo.nomeArquivo}: ${recusa}`);
    }

    if (this.escolheOAtoCorrigido() && this.atosCorrigiveis().length === 0) {
      mensagens.push('Não há documento publicado que possa ser corrigido por este tipo.');
    }

    return mensagens;
  }

  private mostrarRecusa(problema: ProblemDetails, inconclusiva: boolean): void {
    const mensagens: string[] = [this.problemI18n.resolve(problema).title];

    for (const erro of problema.errors ?? []) {
      const campo = campoDoServidor(erro.field);
      if (campo === null) {
        mensagens.push(erro.message);
        continue;
      }
      const controle = this.form.controls[campo];
      controle.setErrors({ ...controle.errors, servidor: { mensagem: erro.message } });
      controle.markAsTouched();
    }

    if (inconclusiva) {
      mensagens.push(
        'Não foi possível saber se o documento foi publicado. Confira a lista de documentos; se ele não aparecer, publique de novo: o pedido é o mesmo e não se repete.',
      );
    }

    this.recusa.set(mensagens);
    this.focarResumo();
  }

  private focarPrimeiroCampoInvalido(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }

  private trocarObrigatoriedade(controle: FormControl<string>, obrigatorio: boolean): void {
    if (obrigatorio) {
      controle.addValidators(Validators.required);
    } else {
      controle.removeValidators(Validators.required);
    }
    controle.updateValueAndValidity({ emitEvent: false });
  }

  /** O foco vai ao resumo: quem navega por teclado não vê o que está acima da dobra. */
  private focarResumo(): void {
    afterNextRender(() => this.resumo()?.nativeElement.focus(), { injector: this.injector });
  }

}

/** O controle do formulário que o campo citado pelo servidor (`PascalCase`, às vezes com caminho) nomeia. */
function campoDoServidor(campo: string): CampoDoFormulario | null {
  const ultimo = campo.split('.').at(-1)?.replace(/\[\d+\]$/u, '') ?? campo;
  const camelCase = ultimo.charAt(0).toLocaleLowerCase('pt-BR') + ultimo.slice(1);
  return CAMPOS.has(camelCase) ? (camelCase as CampoDoFormulario) : null;
}
