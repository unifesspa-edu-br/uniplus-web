import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ProblemI18nService, isApiOk, abrirAcessoEmNovaAba } from '@uniplus/shared-core/http';
import { FileUploadComponent, type ArquivoEmEnvio } from '@uniplus/shared-ui/components';
import { FinalidadeDoDocumento, type DocumentoDoAtoDto } from '@uniplus/shared-data/selecao';

import type { AnexoDoEdital } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { EnvioDeArquivo, soFaltaConfirmar, type AlvoDoEnvio } from '../envio-de-arquivo';
import {
  EXTENSOES_DO_ANEXO,
  LIMITE_DE_ANEXOS,
  TAMANHO_MAXIMO_DO_ANEXO_MB,
  anexoConfirmado,
  extensaoDoArquivo,
  nomeInicialDoAnexo,
  nomeNoDownload,
  recusaDoNomeDoAnexo,
  tipoDeMidiaDoAnexo,
} from './anexos-do-edital';
import { AnexosDoEditalService } from './envio-do-anexo.service';

/** Os anexos que o ato da versão vigente publicou, lidos do servidor. */
type AnexosPublicados =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'falha' }
  | { readonly estado: 'lido'; readonly anexos: readonly DocumentoDoAtoDto[] };

/** Uma linha da consulta, venha do rascunho ou do ato publicado. */
interface AnexoEmConsulta {
  readonly chave: string;
  readonly documentoAPublicarId: string | null;
  readonly nome: string;
  readonly arquivo: string;
  readonly formato: string;
}

/**
 * Os anexos do edital: arquivos que acompanham o documento oficial e são publicados com ele.
 *
 * Cada anexo percorre as três fases do envio (iniciar, PUT direto ao storage, confirmar) e guarda
 * a que falhou, para a retentativa recomeçar do ponto certo. Os envios correm um de cada vez, e um
 * que falha não impede os seguintes. Só o anexo confirmado entra na publicação, e o nome de
 * exibição, editável até publicar, é o que a pessoa recebe no download.
 *
 * Depois da publicação a tela mostra, só para leitura, os anexos que a versão vigente publicou.
 */
@Component({
  selector: 'sel-anexos-do-edital',
  standalone: true,
  imports: [FileUploadComponent],
  templateUrl: './anexos-do-edital.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnexosDoEditalService],
})
export class AnexosDoEditalComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly servico = inject(AnexosDoEditalService);
  private readonly problemI18n = inject(ProblemI18nService);

  /** O processo já foi publicado: a consulta lê os anexos do ato da versão vigente. */
  readonly publicado = input(false);
  /** O ato da versão vigente, quando já foi lido. */
  readonly atoId = input<string | null>(null);

  readonly extensoes = EXTENSOES_DO_ANEXO;
  readonly limite = LIMITE_DE_ANEXOS;
  readonly tamanhoMaximoMb = TAMANHO_MAXIMO_DO_ANEXO_MB;

  readonly recusa = signal<string | null>(null);
  readonly abrindo = signal<string | null>(null);
  readonly erroDeAbertura = signal<string | null>(null);
  readonly publicados = signal<AnexosPublicados | null>(null);

  /**
   * O envio de cada anexo, com o arquivo escolhido e onde o fluxo parou. Vive na memória do
   * componente, e não no rascunho, porque os bytes não se guardam e a URL pré-assinada é
   * credencial de acesso ao storage.
   */
  private readonly memoria = new Map<string, EnvioDeArquivo>();

  /** A fila única dos envios: uma nova escolha entra no fim, atrás do que já corre. */
  private fila: Promise<void> = Promise.resolve();

  /** Distingue a leitura dos anexos publicados mais recente da que ficou para trás. */
  private leituraAtual = 0;

  readonly anexos = computed(() => this.store.draft().publicacao.anexos);
  readonly confirmados = computed(() => this.anexos().filter(anexoConfirmado));

  /** O envio só começa com o processo criado; a gravação em curso e a consulta o travam. */
  readonly semProcesso = computed(() => this.store.processoSeletivoId() === null);
  readonly bloqueado = computed(() => this.semProcesso() || !this.store.aceitaEdicao());

  /** Os anexos na forma que a lista do `ui-file-upload` exibe. */
  readonly itens = computed<readonly ArquivoEmEnvio[]>(() =>
    this.anexos().map((anexo) => ({
      id: anexo.id,
      nome: anexo.nomeArquivo,
      fase: anexo.fase,
      progresso: anexo.progress,
      mensagem: anexo.mensagemErro,
      podeTentarDeNovo: this.podeRetomar(anexo),
      podeRetirar: !this.emAndamento(anexo) && this.store.aceitaEdicao(),
    })),
  );

  /** O que a consulta lista: o publicado pela versão vigente ou, antes disso, o rascunho. */
  readonly listaDeConsulta = computed<readonly AnexoEmConsulta[]>(() => {
    if (this.publicado()) {
      const lidos = this.publicados();
      return lidos?.estado === 'lido' ? lidos.anexos.map(comoAnexoPublicado) : [];
    }
    return this.confirmados().map((anexo) => ({
      chave: anexo.id,
      documentoAPublicarId: anexo.documentoAPublicarId ?? null,
      nome: anexo.nome,
      arquivo: anexo.nomeArquivo,
      formato: formatoDoArquivo(anexo.nomeArquivo),
    }));
  });

  constructor() {
    // O arquivo de um processo não vale em outro: trocar o processo em tela esquece os envios.
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.memoria.clear();
        this.recusa.set(null);
        this.erroDeAbertura.set(null);
      });
    });

    effect(() => {
      this.store.geracao();
      const id = this.store.processoSeletivoId();
      const atoId = this.atoId();
      const lerPublicados = this.publicado() && id !== null && atoId !== null;
      untracked(() => {
        if (!lerPublicados) {
          this.publicados.set(null);
          return;
        }
        void this.lerPublicados(id, atoId);
      });
    });
  }

  /** O ui-file-upload entrega só arquivo aprovado em formato e tamanho. */
  aoEscolherArquivos(arquivos: readonly File[]): void {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      this.recusa.set(
        'O cadastro do processo precisa estar concluído antes de anexar. Volte à identificação e avance.',
      );
      return;
    }

    this.recusa.set(null);
    const novos = arquivos.map((arquivo) => this.registrar(arquivo));
    // A lista cresce de forma síncrona: o limite do ui-file-upload conta o que já está nela.
    this.store.patchObjectSection('publicacao', {
      anexos: [...this.anexos(), ...novos.map(({ anexo }) => anexo)],
    });
    const ids = novos.map(({ anexo }) => anexo.id);
    this.fila = this.fila.then(() => this.enviarEmSequencia(processoId, ids));
  }

  private registrar(arquivo: File): { anexo: AnexoDoEdital } {
    const anexo: AnexoDoEdital = {
      id: crypto.randomUUID(),
      nomeArquivo: arquivo.name,
      nome: nomeInicialDoAnexo(arquivo.name),
      progress: 0,
      fase: 'iniciando',
    };
    // Geração do editor quando o anexo foi escolhido; o arquivo de um processo não vale em outro.
    const geracao = this.store.geracao();
    this.memoria.set(
      anexo.id,
      new EnvioDeArquivo({
        envio: this.servico.abrirEnvio(),
        arquivo,
        finalidade: FinalidadeDoDocumento.anexoDoEdital,
        tipoDeMidia: tipoDeMidiaDoAnexo(arquivo.name),
        recusaDoFormato: 'O formato do arquivo não é aceito para anexo.',
        explicar: (problema) => this.problemI18n.resolve(problema).title,
        vale: () => geracao === this.store.geracao(),
      }),
    );
    return { anexo };
  }

  private async enviarEmSequencia(processoId: string, ids: readonly string[]): Promise<void> {
    for (const id of ids) await this.executar(processoId, id);
  }

  /**
   * Retoma da fase que falhou, sem repetir o que já concluiu. A nova tentativa entra no fim da
   * mesma fila das escolhas: com outro anexo enviando, as duas requisições correriam juntas.
   */
  async retomar(id: string): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    const anexo = this.anexos().find((item) => item.id === id);
    if (processoId === null || anexo === undefined || !this.podeRetomar(anexo)) return;
    this.fila = this.fila.then(() => this.executar(processoId, id));
    await this.fila;
  }

  /**
   * Repetir pede o processo e algo a repetir: o arquivo na memória, ou o PUT já feito (só falta
   * confirmar, o que dispensa os bytes). Um anexo em erro que veio do servidor, sem arquivo nem
   * envio concluído, não tem o que repetir.
   */
  private podeRetomar(anexo: AnexoDoEdital): boolean {
    return (
      anexo.fase === 'erro' &&
      this.store.aceitaEdicao() &&
      !this.semProcesso() &&
      (this.memoria.has(anexo.id) || soFaltaConfirmar(anexo))
    );
  }

  private emAndamento(anexo: AnexoDoEdital): boolean {
    return anexo.fase === 'iniciando' || anexo.fase === 'enviando' || anexo.fase === 'confirmando';
  }

  private async executar(processoId: string, id: string): Promise<void> {
    const envio = this.memoria.get(id);
    if (envio === undefined) return;

    await envio.executar(processoId, this.alvoDe(id));
    if (envio.foiConfirmado) this.memoria.delete(id);
  }

  /**
   * Onde o envio escreve: o anexo na lista do rascunho. A página do editor sobrevive à troca de
   * endereço, então um envio disparado para o processo anterior continua respondendo depois que o
   * editor já trata de outro; o envio só escreve enquanto a geração em que nasceu é a atual.
   */
  private alvoDe(id: string): AlvoDoEnvio {
    return {
      estado: () => this.anexoDe(id),
      atualizar: (alteracao) => this.alterarAnexo(id, (anexo) => ({ ...anexo, ...alteracao })),
    };
  }

  private anexoDe(id: string): AnexoDoEdital | undefined {
    return this.anexos().find((anexo) => anexo.id === id);
  }

  private alterarAnexo(id: string, alterar: (anexo: AnexoDoEdital) => AnexoDoEdital): void {
    this.store.patchObjectSection('publicacao', {
      anexos: this.anexos().map((anexo) => (anexo.id === id ? alterar(anexo) : anexo)),
    });
  }

  /** Só sai da lista o que não está em envio; o documento já confirmado fica no servidor sem uso. */
  retirar(id: string): void {
    const anexo = this.anexoDe(id);
    if (anexo === undefined || this.emAndamento(anexo)) return;

    this.recusa.set(null);
    this.memoria.delete(id);
    this.store.patchObjectSection('publicacao', {
      anexos: this.anexos().filter((item) => item.id !== id),
    });
  }

  renomear(id: string, evento: Event): void {
    const nome = (evento.target as HTMLInputElement).value;
    this.alterarAnexo(id, (anexo) => ({ ...anexo, nome }));
  }

  /** Por que o nome não serviria, ou `null`; dito enquanto se digita, não só ao publicar. */
  recusaDoNome(anexo: AnexoDoEdital): string | null {
    return recusaDoNomeDoAnexo(anexo.nome, anexo.nomeArquivo);
  }

  /** Como o anexo será baixado, para a dica mostrar o que o servidor entrega. */
  nomeBaixado(anexo: AnexoDoEdital): string {
    return nomeNoDownload(anexo.nome, anexo.nomeArquivo);
  }

  /** Abre o anexo numa aba nova, pedindo o acesso à API no clique. */
  async abrir(documentoAPublicarId: string): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.abrindo() !== null) return;

    const geracao = this.store.geracao();
    this.abrindo.set(documentoAPublicarId);
    this.erroDeAbertura.set(null);
    try {
      const desfecho = await abrirAcessoEmNovaAba(
        () => this.servico.obterAcesso(processoId, documentoAPublicarId),
        () => geracao === this.store.geracao(),
      );
      if (desfecho.situacao === 'bloqueada') {
        this.erroDeAbertura.set(
          'O navegador bloqueou a abertura do anexo. Permita pop-ups para este endereço e tente de novo.',
        );
      } else if (desfecho.situacao === 'recusada') {
        this.erroDeAbertura.set(this.problemI18n.resolve(desfecho.problem).title);
      }
    } finally {
      this.abrindo.set(null);
    }
  }

  tentarLerPublicadosDeNovo(): void {
    const id = this.store.processoSeletivoId();
    const atoId = this.atoId();
    if (id !== null && atoId !== null) void this.lerPublicados(id, atoId);
  }

  /** Os anexos do ato da versão vigente, entre os atos do processo. */
  private async lerPublicados(processoId: string, atoId: string): Promise<void> {
    const geracao = this.store.geracao();
    const leitura = ++this.leituraAtual;
    this.publicados.set({ estado: 'lendo' });

    const atos = await this.servico.listarAtos(processoId);
    if (geracao !== this.store.geracao() || leitura !== this.leituraAtual) return;

    const ato = isApiOk(atos) ? atos.data.find((item) => item.id === atoId) : undefined;
    this.publicados.set(ato === undefined ? { estado: 'falha' } : { estado: 'lido', anexos: ato.anexos });
  }
}

function formatoDoArquivo(nomeArquivo: string): string {
  return extensaoDoArquivo(nomeArquivo).toUpperCase();
}

function comoAnexoPublicado(anexo: DocumentoDoAtoDto): AnexoEmConsulta {
  return {
    chave: anexo.documentoAPublicarId,
    documentoAPublicarId: anexo.documentoAPublicarId,
    nome: anexo.nomeDeExibicao ?? anexo.nomeArquivo,
    arquivo: anexo.nomeArquivo,
    formato: formatoDoArquivo(anexo.nomeArquivo),
  };
}
