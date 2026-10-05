import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ProblemI18nService, isApiOk, type ProblemDetails } from '@uniplus/shared-core/http';
import type { IniciarEnvioDoModeloDeDocumentoDto } from '@uniplus/shared-data/selecao';

import type { ModeloDaExigencia } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { abrirAcessoEmNovaAba, destinoExpirado } from '../../../shared/envio-pre-assinado';
import { EnvioDoModeloService } from './envio-do-modelo.service';

/** O teto do modelo no domínio: 10 MB. */
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

/** Os formatos editáveis que o contrato aceita, pela extensão do arquivo escolhido. */
const FORMATO_POR_EXTENSAO = new Map([
  ['docx', 'DOCX'],
  ['odt', 'ODT'],
]);

type FaseDoEnvio = 'iniciando' | 'enviando' | 'confirmando' | 'erro';

/**
 * O envio que está em tela: o arquivo escolhido e onde o fluxo parou. `retomavel` diz se repetir
 * pode dar certo — falha de rede, URL vencida, resposta inconclusiva —, ao contrário da recusa
 * definitiva do servidor, que pede outro arquivo.
 */
interface EnvioEmCurso {
  readonly nome: string;
  readonly fase: FaseDoEnvio;
  readonly progresso: number;
  readonly erro: string | null;
  readonly retomavel: boolean;
}

/**
 * O modelo de documento que a exigência oferece ao candidato — a declaração que ele baixa,
 * preenche, assina e devolve no bloco de comprovação.
 *
 * O envio tem três passos (iniciar, PUT direto ao storage, confirmar), e cada falha registra
 * onde parou para a retentativa recomeçar do ponto certo, como no anexo do edital. Só o modelo
 * confirmado é vinculado à exigência: o servidor recusa vincular o pendente, e só o confirmado
 * tem o hash que congela no edital.
 */
@Component({
  selector: 'sel-modelo-da-exigencia',
  standalone: true,
  templateUrl: './modelo-da-exigencia.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EnvioDoModeloService],
})
export class ModeloDaExigenciaComponent {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly envioDoModelo = inject(EnvioDoModeloService);
  private readonly problemI18n = inject(ProblemI18nService);

  /** O modelo vinculado à exigência; `null` quando ela não oferece modelo. */
  readonly modelo = input.required<ModeloDaExigencia | null>();
  readonly desabilitado = input(false);
  /** Prefixo dos ids, único por exigência na tela. */
  readonly idBase = input.required<string>();
  /** O documento exigido, para os nomes acessíveis distinguirem um modelo do outro. */
  readonly nomeDoDocumento = input.required<string>();

  /** O modelo confirmado a vincular, ou `null` para desvincular. */
  readonly modeloChange = output<ModeloDaExigencia | null>();

  readonly envio = signal<EnvioEmCurso | null>(null);
  readonly recusa = signal<string | null>(null);
  readonly abrindo = signal(false);
  readonly erroDeAbertura = signal<string | null>(null);

  readonly emCurso = computed(() => {
    const fase = this.envio()?.fase;
    return fase === 'iniciando' || fase === 'enviando' || fase === 'confirmando';
  });

  /**
   * A confirmação sem resposta pode ter selado o modelo; escolher outro arquivo agora abandonaria
   * o que talvez já esteja confirmado, e a saída é repetir a mesma confirmação.
   */
  readonly bloqueado = computed(
    () => this.desabilitado() || this.emCurso() || this.confirmacaoIndefinida(),
  );

  private readonly confirmacaoIndefinida = signal(false);

  /** Impede que uma segunda escolha atropele o envio em andamento. */
  private operacaoEmCurso = false;
  private arquivo: File | null = null;
  private destino: IniciarEnvioDoModeloDeDocumentoDto | null = null;
  /** O modelo cujo arquivo já chegou ao storage e só falta confirmar. */
  private modeloEnviadoId: string | null = null;

  /** O processo em tela quando o envio começou: a resposta de outro não vira vínculo deste. */
  private geracaoDoEnvio: number | null = null;
  private vivo = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.vivo = false));
  }

  onArquivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (arquivo !== undefined && !this.bloqueado()) void this.enviar(arquivo);
  }

  private async enviar(arquivo: File): Promise<void> {
    if (this.operacaoEmCurso) return;

    const recusa = recusarArquivo(arquivo);
    if (recusa !== null) {
      this.recusa.set(recusa);
      return;
    }
    if (this.store.processoSeletivoId() === null) {
      this.recusa.set(
        'O cadastro do processo precisa estar concluído antes de enviar o modelo. Volte à identificação e avance.',
      );
      return;
    }

    this.recusa.set(null);
    this.arquivo = arquivo;
    this.destino = null;
    this.modeloEnviadoId = null;
    this.geracaoDoEnvio = this.store.geracao();
    this.envio.set({ nome: arquivo.name, fase: 'iniciando', progresso: 0, erro: null, retomavel: false });
    await this.executar();
  }

  /** Retoma da fase que falhou, sem repetir o que já concluiu. */
  async retomar(): Promise<void> {
    if (this.envio()?.retomavel !== true) return;
    await this.executar();
  }

  private async executar(): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    const arquivo = this.arquivo;
    if (this.operacaoEmCurso || processoId === null || arquivo === null) return;

    this.operacaoEmCurso = true;
    try {
      // O arquivo já chegou ao storage: repetir o PUT esbarraria numa URL possivelmente vencida.
      // Só a confirmação falta, e repeti-la com a mesma chave recupera o replay.
      this.modeloEnviadoId ??= await this.enviarAoStorage(processoId, arquivo);
      if (this.modeloEnviadoId !== null) await this.confirmar(processoId, this.modeloEnviadoId);
    } finally {
      this.operacaoEmCurso = false;
    }
  }

  /** Inicia, se preciso, e envia os bytes; devolve o modelo pendente, ou `null` se falhou. */
  private async enviarAoStorage(processoId: string, arquivo: File): Promise<string | null> {
    let destino = this.destino;
    if (destino === null || destinoExpirado(destino)) {
      this.atualizar({ fase: 'iniciando', progresso: 0, erro: null });
      const { resultado, inconclusiva } = await this.envioDoModelo.iniciar(processoId, {
        nomeArquivo: arquivo.name,
        formato: formatoDoArquivo(arquivo.name),
      });
      if (!this.aindaVale()) return null;
      if (!isApiOk(resultado)) {
        this.falhar(this.mensagemDaRecusa(resultado.problem), inconclusiva);
        return null;
      }
      destino = resultado.data;
      this.destino = destino;
    }

    this.atualizar({ fase: 'enviando', erro: null });
    const envio = await this.envioDoModelo.enviarArquivo(destino, arquivo, (progresso) =>
      this.atualizar({ progresso }),
    );
    if (!this.aindaVale()) return null;
    if (!envio.ok) {
      // A assinatura recusada não volta a valer: a retentativa pede outra URL.
      if (envio.expirada) this.destino = null;
      this.falhar(
        envio.expirada
          ? 'O endereço de envio não é mais válido. Tente novamente para obter um novo.'
          : 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.',
        true,
      );
      return null;
    }

    // A URL cumpriu o papel; some da memória para não ficar credencial viva à toa.
    this.destino = null;
    return destino.modeloDeDocumentoId;
  }

  private async confirmar(processoId: string, modeloId: string): Promise<void> {
    this.atualizar({ fase: 'confirmando', progresso: 100, erro: null });
    const { resultado, inconclusiva } = await this.envioDoModelo.confirmar(processoId, modeloId);
    if (!this.aindaVale()) return;

    this.confirmacaoIndefinida.set(!isApiOk(resultado) && inconclusiva);
    if (!isApiOk(resultado)) {
      const mensagem = this.mensagemDaRecusa(resultado.problem);
      this.falhar(
        inconclusiva
          ? `${mensagem} Não é possível saber se o modelo foi registrado; use "Tentar novamente" para repetir a mesma confirmação.`
          : mensagem,
        inconclusiva,
      );
      return;
    }

    const modelo = resultado.data;
    this.envio.set(null);
    this.arquivo = null;
    this.modeloEnviadoId = null;
    this.modeloChange.emit({
      modeloId: modelo.id,
      nomeArquivo: modelo.nomeArquivo,
      formato: modelo.formato,
      hashSha256: modelo.hashSha256 ?? '',
    });
  }

  /** Desvincula o modelo da exigência; o arquivo confirmado continua guardado no processo. */
  remover(): void {
    if (this.bloqueado()) return;
    this.modeloChange.emit(null);
  }

  /** Abre o modelo confirmado numa aba nova, pelo acesso emitido no clique. */
  async conferir(): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    const modelo = this.modelo();
    if (processoId === null || modelo === null || this.abrindo()) return;

    const geracao = this.store.geracao();
    this.abrindo.set(true);
    this.erroDeAbertura.set(null);
    try {
      const desfecho = await abrirAcessoEmNovaAba(
        () => this.envioDoModelo.obterAcesso(processoId, modelo.modeloId),
        () => this.vivo && geracao === this.store.geracao(),
      );
      if (desfecho.situacao === 'bloqueada') {
        this.erroDeAbertura.set(
          'O navegador bloqueou a abertura do modelo. Permita pop-ups para este endereço e tente de novo.',
        );
      } else if (desfecho.situacao === 'recusada') {
        this.erroDeAbertura.set(this.mensagemDaRecusa(desfecho.problem));
      }
    } finally {
      this.abrindo.set(false);
    }
  }

  /** Rótulo da fase, para o leitor de tela acompanhar o andamento. */
  descricao(envio: EnvioEmCurso): string {
    switch (envio.fase) {
      case 'iniciando':
        return `Preparando o envio de ${envio.nome}`;
      case 'enviando':
        return `Enviando ${envio.nome}: ${envio.progresso}%`;
      case 'confirmando':
        return `Validando ${envio.nome}`;
      case 'erro':
        return `O envio de ${envio.nome} não foi concluído.`;
    }
  }

  /**
   * A recusa do servidor como o operador a lê: os erros de campo, quando há, e senão a explicação
   * da recusa — é ali que vêm o formato que não é texto, a macro e o tamanho.
   */
  private mensagemDaRecusa(problema: ProblemDetails): string {
    const erros = problema.errors ?? [];
    if (erros.length > 0) return [...new Set(erros.map((erro) => erro.message))].join(' ');
    const { title, detail } = this.problemI18n.resolve(problema);
    return detail ?? title;
  }

  /** Funil de toda escrita do envio, com a guarda do processo e da tela. */
  private atualizar(patch: Partial<EnvioEmCurso>): void {
    if (!this.aindaVale()) return;
    this.envio.update((atual) => (atual === null ? atual : { ...atual, ...patch }));
  }

  private falhar(erro: string, retomavel: boolean): void {
    this.atualizar({ fase: 'erro', erro, retomavel });
  }

  /**
   * A página do editor sobrevive à troca de processo e a linha da exigência pode fechar durante o
   * envio: a resposta que chega depois não pode vincular o modelo à exigência de outro processo.
   */
  private aindaVale(): boolean {
    return this.vivo && this.geracaoDoEnvio === this.store.geracao();
  }
}

/** O formato do contrato pela extensão do arquivo; `null` quando não é editável. */
function formatoDoArquivo(nome: string): string | null {
  const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
  return FORMATO_POR_EXTENSAO.get(extensao) ?? null;
}

/** Recusa no cliente o que o servidor recusaria de todo modo. */
function recusarArquivo(arquivo: File): string | null {
  if (formatoDoArquivo(arquivo.name) === null) {
    return `Formato não permitido: "${arquivo.name}". O modelo precisa ser um documento editável, DOCX ou ODT, para o candidato preenchê-lo.`;
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) return 'O modelo excede o tamanho máximo permitido de 10 MB.';
  if (arquivo.size === 0) return 'O arquivo está vazio.';
  return null;
}
