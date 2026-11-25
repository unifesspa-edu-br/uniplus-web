import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormControl, FormGroup } from '@angular/forms';
import { ProblemDetails, separarCausas } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import {
  FatoCandidatoDto,
  FatosCandidatoApi,
  OrigemFatoCodigo,
  VOCABULARIO_DE_TIPOS_DO_DADO,
  type CorrecaoDeValorDominioInput,
  type DefinicaoDoFatoInput,
} from '@uniplus/shared-data/configuracao';
import {
  comandoDaCorrecao,
  comandoDoDescritivo,
  comandoDoNovoValor,
  criarFormularioDaCorrecao,
  criarFormularioDaDefinicao,
  criarFormularioDoDescritivo,
  criarFormularioDoNovoValor,
  exigirTextoNaFinalidade,
  ligarDependenciasDaDefinicao,
  valoresDaDefinicao,
  valoresDoDescritivo,
} from './fato-candidato-edicao-form';
import type { GrupoDeCitacoes } from './citacoes-do-fato';
import { corpoDaDefinicao, obrigatorioNaoEmBranco } from './fato-candidato.regras';
import type { AcaoComChave } from './chaves-do-fato';
import { EscritorDeFato, type Escrita } from './escritor-do-fato';
import {
  ID_DAS_CITACOES,
  ID_DA_RECUSA_DA_DEFINICAO,
  ID_DO_FORMULARIO_DA_DEFINICAO,
  ID_DO_NOVO_VALOR,
  ID_DO_SALVAR_DA_DEFINICAO,
  idDaAcaoDoValor,
  idDoValor,
} from './ids-do-fato';
import { trocarDeLugar, type TrocaDeLugar } from './ordem-dos-valores';
import { aplicarErrosNoFormulario, distribuirRecusaDaDefinicao } from './recusas-do-fato';
import { RegrasEmEdicao } from './regras-em-edicao';

/** As seções que se copiam do servidor só quando o fato carregado é outro ou a própria seção salvou. */
interface SecoesARecopiar {
  descritivo: boolean;
  definicao: boolean;
  regras: boolean;
}

const NADA_A_RECOPIAR: SecoesARecopiar = { descritivo: false, definicao: false, regras: false };

/**
 * Todas as escritas da edição de um fato do catálogo: nome e descrição, definição, valores de
 * domínio (acrescentar, corrigir, mover, desativar, reativar) e regras padrão. É a única dona do
 * indicador de gravação: uma escrita impede a outra, e, depois de uma que deu certo, o fato
 * recarregado ainda não chegou — a lista na tela é a antiga, e reordenar ou corrigir a partir dela
 * reenviaria a ordem velha.
 */
@Injectable()
export class EdicaoDoFato extends EscritorDeFato {
  private readonly api = inject(FatosCandidatoApi);

  readonly descritivo = criarFormularioDoDescritivo();
  readonly definicao = criarFormularioDaDefinicao();
  readonly correcao = criarFormularioDaCorrecao();
  readonly novoValor = criarFormularioDoNovoValor();
  readonly regras = new RegrasEmEdicao();
  readonly dependencias = ligarDependenciasDaDefinicao(
    this.definicao,
    this.leitura.fato,
    this.leitura.tipo,
    inject(VOCABULARIO_DE_TIPOS_DO_DADO).itens,
  );

  /** A recusa da definição que não cabe num campo da tela: fica junto do botão que salva. */
  readonly recusaDaDefinicao = signal<string | null>(null);
  /** O que cita o fato e deixaria de valer com a definição enviada. */
  readonly citacoes = signal<readonly GrupoDeCitacoes[]>([]);

  private fatoCopiado: string | null = null;
  private aRecopiar: SecoesARecopiar = { ...NADA_A_RECOPIAR };

  constructor() {
    super();
    this.copiarQuandoOFatoChega();
    this.desfazerCitacoesAoMexerNaDefinicao();
  }

  private copiarQuandoOFatoChega(): void {
    effect(() => {
      const fato = this.leitura.fato();
      const falhou = this.leitura.falhouAoCarregar();
      untracked(() => {
        if (falhou) this.aguardandoRecarga.set(false);
        if (fato !== null) this.copiarDoServidor(fato);
      });
    });
  }

  /** Mexer na definição desfaz a lista de citações: ela descreve o corpo que foi recusado. */
  private desfazerCitacoesAoMexerNaDefinicao(): void {
    this.definicao.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.citacoes.set([]);
      this.recusaDaDefinicao.set(null);
    });
  }

  abrir(id: string): void {
    this.fatoCopiado = null;
    this.aRecopiar = { ...NADA_A_RECOPIAR };
    this.focoAposRecarga = null;
    this.aguardandoRecarga.set(false);
    this.editando.set(null);
    this.erro.set(null);
    this.anuncio.set('');
    this.chaves.rotacionarTodas();
    this.leitura.abrir(id);
  }

  fechar(): void {
    this.leitura.fechar();
  }

  salvarDescritivo(): void {
    // Só para consultar, nada se grava — nem pelo Enter que envia o formulário.
    if (!this.conferido(this.descritivo, 'cfg-fato-descritivo')) return;
    this.executar(this.escritaDoDescritivo(this.idDoFato()));
  }

  private escritaDoDescritivo(id: string): Escrita {
    return {
      operacao: this.api.atualizarDescritivo(
        id,
        comandoDoDescritivo(this.descritivo),
        withIdempotencyKey(this.chaves.de('descritivo', id)),
      ),
      sucesso: 'Nome, descrição e componente salvos',
      aoSalvar: () => {
        this.chaves.rotacionar('descritivo');
        this.aRecopiar.descritivo = true;
      },
      aoRecusar: (problem) => this.recusarEmCampo(this.descritivo, problem, 'cfg-fato-descritivo'),
    };
  }

  salvarDefinicao(): void {
    if (!this.leitura.protecaoEditavel()) return;
    const exigirFinalidade = (): void => exigirTextoNaFinalidade(this.definicao);
    if (!this.conferido(this.definicao, ID_DO_FORMULARIO_DA_DEFINICAO, exigirFinalidade)) return;
    this.recusaDaDefinicao.set(null);
    const corpo = corpoDaDefinicao(this.leitura.tipo(), this.definicao.getRawValue());
    this.executar(this.escritaDaDefinicao(corpo));
  }

  private escritaDaDefinicao(corpo: DefinicaoDoFatoInput): Escrita {
    const id = this.idDoFato();
    return {
      operacao: this.api.alterarDefinicao(
        id,
        corpo,
        withIdempotencyKey(this.chaves.de('definicao', id, JSON.stringify(corpo))),
      ),
      sucesso: 'Definição salva',
      aoSalvar: () => this.aoSalvarDefinicao(corpo),
      aoRecusar: (problem) => this.recusarDefinicao(problem),
      aoPerderParaOutra: () => this.recopiarDefinicao(),
    };
  }

  private aoSalvarDefinicao(corpo: DefinicaoDoFatoInput): void {
    this.chaves.rotacionar('definicao');
    // O formato de `contribui` depende do tipo de dado (nulo no booleano, um valor no categórico).
    if ('dominio' in corpo && corpo.dominio !== this.leitura.fato()?.definicao.dominio.codigo) {
      this.aRecopiar.regras = true;
    }
    this.recopiarDefinicao();
  }

  private recopiarDefinicao(): void {
    this.aRecopiar.definicao = true;
    this.focoAposRecarga = ID_DO_SALVAR_DA_DEFINICAO;
  }

  acrescentarValor(): void {
    const exigirDescricao = (): void =>
      this.exigirDescricaoDoDeclarado(this.novoValor.controls.descricao);
    if (!this.conferido(this.novoValor, ID_DO_NOVO_VALOR, exigirDescricao)) return;
    this.executar(this.escritaDoNovoValor());
  }

  private escritaDoNovoValor(): Escrita {
    const id = this.idDoFato();
    // A ordem sai do total de valores: com o fato recarregado a caminho, o total está velho.
    const ordem = this.leitura.fato()?.definicao.valores.declarados.length ?? 0;
    return {
      operacao: this.api.acrescentarValor(
        id,
        comandoDoNovoValor(this.novoValor, ordem),
        withIdempotencyKey(this.chaves.de('valor', id)),
      ),
      sucesso: 'Valor acrescentado',
      aoSalvar: () => this.aoAcrescentarValor(),
      aoRecusar: (problem) => this.recusarEmCampo(this.novoValor, problem, ID_DO_NOVO_VALOR),
    };
  }

  private aoAcrescentarValor(): void {
    this.chaves.rotacionar('valor');
    this.novoValor.reset();
  }

  desativarValor(codigo: string): void {
    if (this.editando() !== null) return;
    this.executar({
      operacao: this.api.desativarValor(this.idDoFato(), codigo),
      sucesso: `Valor ${codigo} desativado`,
      aoSalvar: () => {
        this.focoAposRecarga = idDaAcaoDoValor(codigo);
      },
    });
  }

  /** Reativa um valor desativado: condições novas voltam a poder citá-lo. */
  reativarValor(codigo: string): void {
    if (this.editando() !== null) return;
    const id = this.idDoFato();
    this.executar({
      operacao: this.api.reativarValor(
        id,
        codigo,
        withIdempotencyKey(this.chaves.de('reativacao', id, codigo)),
      ),
      sucesso: `Valor ${codigo} reativado`,
      aoSalvar: () => this.rotacionarEFocar('reativacao', idDaAcaoDoValor(codigo)),
    });
  }

  editarValor(codigo: string): void {
    const valor = this.leitura
      .fato()
      ?.definicao.valores.declarados.find((item) => item.codigo === codigo);
    if (valor === undefined || this.bloqueado() || this.editando() !== null) return;
    this.correcao.reset({ descricao: valor.descricao ?? '', orientacao: valor.orientacao ?? '' });
    this.erro.set(null);
    this.editando.set(codigo);
    // O botão Editar sai do DOM: o foco vai para o campo, senão cairia no corpo da página.
    this.focarQuandoRenderizar(idDoValor(codigo, 'descricao'));
  }

  cancelarEdicaoDoValor(codigo: string): void {
    this.editando.set(null);
    this.erro.set(null);
    this.focarQuandoRenderizar(idDoValor(codigo, 'editar'));
  }

  salvarEdicaoDoValor(codigo: string): void {
    const exigirDescricao = (): void =>
      this.exigirDescricaoDoDeclarado(this.correcao.controls.descricao);
    if (!this.conferido(this.correcao, idDoValor(codigo, 'form'), exigirDescricao)) return;
    this.executar(this.escritaDaCorrecao(codigo, comandoDaCorrecao(this.correcao)));
  }

  private escritaDaCorrecao(codigo: string, corpo: CorrecaoDeValorDominioInput): Escrita {
    const id = this.idDoFato();
    const chave = withIdempotencyKey(
      this.chaves.de('correcao', id, JSON.stringify([codigo, corpo])),
    );
    return {
      operacao: this.api.corrigirValor(id, codigo, corpo, chave),
      sucesso: `Valor ${codigo} corrigido`,
      aoSalvar: () => this.aoCorrigirValor(codigo),
      aoRecusar: (problem) =>
        this.recusarEmCampo(this.correcao, problem, idDoValor(codigo, 'form')),
    };
  }

  private aoCorrigirValor(codigo: string): void {
    this.editando.set(null);
    this.rotacionarEFocar('correcao', idDoValor(codigo, 'editar'));
  }

  moverValor(codigo: string, sentido: -1 | 1): void {
    if (this.editando() !== null) return;
    const codigos = (this.leitura.fato()?.definicao.valores.declarados ?? []).map((v) => v.codigo);
    const troca = trocarDeLugar(codigos, codigo, sentido);
    if (troca !== null) this.executar(this.escritaDaOrdem(codigo, troca));
  }

  private escritaDaOrdem(codigo: string, troca: TrocaDeLugar): Escrita {
    const id = this.idDoFato();
    const ordem = troca.codigos.join(',');
    return {
      operacao: this.api.reordenarValores(
        id,
        { codigos: [...troca.codigos] },
        withIdempotencyKey(this.chaves.de('ordem', id, ordem)),
      ),
      sucesso: `Valor ${codigo} movido`,
      aoSalvar: () => this.rotacionarEFocar('ordem', idDoValor(codigo, troca.focoEm)),
    };
  }

  private rotacionarEFocar(acao: AcaoComChave, idDoFoco: string): void {
    this.chaves.rotacionar(acao);
    this.focoAposRecarga = idDoFoco;
  }

  acrescentarRegra(): void {
    this.regras.acrescentar(this.leitura.fato()?.definicao.dominio.codigo ?? '');
  }

  salvarRegras(): void {
    if (this.bloqueado()) return;
    const porCodigo = new Map(this.leitura.fatosDaRegra().map((fato) => [fato.codigo, fato]));
    if (!this.regras.conferir(porCodigo, this.leitura.fatosJaCitados())) return;
    this.executar(this.escritaDasRegras());
  }

  private escritaDasRegras(): Escrita {
    const id = this.idDoFato();
    const chave = withIdempotencyKey(this.chaves.de('regras', id));
    return {
      operacao: this.api.definirRegrasPadrao(id, this.regras.corpo(), chave),
      sucesso: 'Regras padrão salvas',
      aoSalvar: () => {
        this.chaves.rotacionar('regras');
        this.aRecopiar.regras = true;
      },
      aoRecusar: (problem) => this.regras.aplicarRecusa(problem),
    };
  }

  /** A recusa da definição: no campo, na lista do que deixaria de valer ou no alerta junto do botão. */
  private recusarDefinicao(problem: ProblemDetails): boolean {
    const recusa = distribuirRecusaDaDefinicao(problem, this.definicao, this.dependencias.eixos());
    this.citacoes.set(recusa.citacoes);
    this.recusaDaDefinicao.set(recusa.semControle);
    if (recusa.citacoes.length > 0) this.focarQuandoRenderizar(ID_DAS_CITACOES);
    else if (recusa.semControle !== null) this.focarQuandoRenderizar(ID_DA_RECUSA_DA_DEFINICAO);
    else if (recusa.noCampo) this.focarPrimeiroInvalidoEm(ID_DO_FORMULARIO_DA_DEFINICAO);
    return recusa.noCampo || recusa.citacoes.length > 0 || recusa.semControle !== null;
  }

  private recusarEmCampo(
    formulario: FormGroup,
    problem: ProblemDetails,
    idDoFormulario: string,
  ): boolean {
    const coube = aplicarErrosNoFormulario(formulario, separarCausas(problem.errors).deCampo);
    if (coube) this.focarPrimeiroInvalidoEm(idDoFormulario);
    return coube;
  }

  /** Descrição só com espaços não é descrição: no fato declarado vale como vazia. */
  private exigirDescricaoDoDeclarado(controle: FormControl<string>): void {
    if (
      this.leitura.fato()?.definicao.resolucao.origem.codigo === OrigemFatoCodigo.DECLARADO &&
      obrigatorioNaoEmBranco(controle) !== null
    ) {
      controle.setErrors({ required: true });
      controle.markAsTouched();
    }
  }

  /**
   * As seções que o formulário edita só se copiam do servidor quando o fato carregado é outro, ou
   * depois que a própria seção salvou: as demais escritas recarregam o fato, e copiar a cada
   * recarga apagaria o que ainda está em edição — as regras montadas enquanto se acrescenta o
   * valor que elas vão contribuir.
   */
  private copiarDoServidor(fato: FatoCandidatoDto): void {
    this.aguardandoRecarga.set(false);
    const outroFato = this.fatoCopiado !== fato.id;
    if (outroFato) this.descartarEdicaoDoFatoAnterior();
    if (outroFato || this.aRecopiar.descritivo) this.descritivo.reset(valoresDoDescritivo(fato));
    if (outroFato || this.aRecopiar.definicao) this.copiarDefinicao(fato);
    if (outroFato || this.aRecopiar.regras) this.regras.copiarDe(fato);
    this.fatoCopiado = fato.id;
    this.aRecopiar = { ...NADA_A_RECOPIAR };
    this.devolverFoco();
  }

  private descartarEdicaoDoFatoAnterior(): void {
    this.editando.set(null);
    this.correcao.reset();
  }

  private copiarDefinicao(fato: FatoCandidatoDto): void {
    this.definicao.reset(valoresDaDefinicao(fato));
    this.citacoes.set([]);
  }

  private idDoFato(): string {
    return this.leitura.id() ?? '';
  }
}
