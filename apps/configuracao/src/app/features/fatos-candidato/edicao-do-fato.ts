import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormControl, FormGroup } from '@angular/forms';
import { ProblemDetails } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { FatoCandidatoDto, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';
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
import {
  corpoDaDefinicao,
  obrigatorioNaoEmBranco,
  type GrupoDeCitacoes,
} from './fato-candidato.regras';
import { EscritorDeFato } from './escritor-do-fato';
import {
  ID_DAS_CITACOES,
  ID_DA_RECUSA_DA_DEFINICAO,
  ID_DO_FORMULARIO_DA_DEFINICAO,
  ID_DO_NOVO_VALOR,
  ID_DO_SALVAR_DA_DEFINICAO,
  idDaAcaoDoValor,
  idDoValor,
} from './ids-do-fato';
import { trocarDeLugar } from './ordem-dos-valores';
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
  );

  /** A recusa da definição que não cabe num campo da tela: fica junto do botão que salva. */
  readonly recusaDaDefinicao = signal<string | null>(null);
  /** O que cita o fato e deixaria de valer com a definição enviada. */
  readonly citacoes = signal<readonly GrupoDeCitacoes[]>([]);

  private fatoCopiado: string | null = null;
  private aRecopiar: SecoesARecopiar = { ...NADA_A_RECOPIAR };

  constructor() {
    super();
    effect(() => {
      const fato = this.leitura.fato();
      const falhou = this.leitura.falhouAoCarregar();
      untracked(() => {
        if (falhou) this.aguardandoRecarga.set(false);
        if (fato !== null) this.copiarDoServidor(fato);
      });
    });
    // Mexer na definição desfaz a lista de citações: ela descreve o corpo que foi recusado.
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
    const id = this.idDoFato();
    this.executar({
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
    });
  }

  salvarDefinicao(): void {
    if (!this.leitura.protecaoEditavel()) return;
    const exigirFinalidade = (): void => exigirTextoNaFinalidade(this.definicao);
    if (!this.conferido(this.definicao, ID_DO_FORMULARIO_DA_DEFINICAO, exigirFinalidade)) return;
    this.recusaDaDefinicao.set(null);
    const id = this.idDoFato();
    const corpo = corpoDaDefinicao(this.leitura.tipo(), this.definicao.getRawValue());
    this.executar({
      operacao: this.api.alterarDefinicao(
        id,
        corpo,
        withIdempotencyKey(this.chaves.de('definicao', id, JSON.stringify(corpo))),
      ),
      sucesso: 'Definição salva',
      aoSalvar: () => {
        this.chaves.rotacionar('definicao');
        this.aRecopiar.definicao = true;
        // O formato de `contribui` depende do tipo de dado (nulo no booleano, um valor no categórico).
        if ('dominio' in corpo && corpo.dominio !== this.leitura.fato()?.dominio) {
          this.aRecopiar.regras = true;
        }
        this.focoAposRecarga = ID_DO_SALVAR_DA_DEFINICAO;
      },
      aoRecusar: (problem) => this.recusarDefinicao(problem),
      aoPerderParaOutra: () => {
        this.aRecopiar.definicao = true;
        this.focoAposRecarga = ID_DO_SALVAR_DA_DEFINICAO;
      },
    });
  }

  acrescentarValor(): void {
    const exigirDescricao = (): void =>
      this.exigirDescricaoDoDeclarado(this.novoValor.controls.descricao);
    if (!this.conferido(this.novoValor, ID_DO_NOVO_VALOR, exigirDescricao)) return;
    const id = this.idDoFato();
    // A ordem sai do total de valores: com o fato recarregado a caminho, o total está velho.
    const ordem = this.leitura.fato()?.valores.length ?? 0;
    this.executar({
      operacao: this.api.acrescentarValor(
        id,
        comandoDoNovoValor(this.novoValor, ordem),
        withIdempotencyKey(this.chaves.de('valor', id)),
      ),
      sucesso: 'Valor acrescentado',
      aoSalvar: () => {
        this.chaves.rotacionar('valor');
        this.novoValor.reset();
      },
      aoRecusar: (problem) => this.recusarEmCampo(this.novoValor, problem, ID_DO_NOVO_VALOR),
    });
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
      aoSalvar: () => {
        this.chaves.rotacionar('reativacao');
        this.focoAposRecarga = idDaAcaoDoValor(codigo);
      },
    });
  }

  editarValor(codigo: string): void {
    const valor = this.leitura.fato()?.valores.find((item) => item.codigo === codigo);
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
    const id = this.idDoFato();
    const corpo = comandoDaCorrecao(this.correcao);
    this.executar({
      operacao: this.api.corrigirValor(
        id,
        codigo,
        corpo,
        withIdempotencyKey(this.chaves.de('correcao', id, JSON.stringify([codigo, corpo]))),
      ),
      sucesso: `Valor ${codigo} corrigido`,
      aoSalvar: () => {
        this.chaves.rotacionar('correcao');
        this.editando.set(null);
        this.focoAposRecarga = idDoValor(codigo, 'editar');
      },
      aoRecusar: (problem) =>
        this.recusarEmCampo(this.correcao, problem, idDoValor(codigo, 'form')),
    });
  }

  moverValor(codigo: string, sentido: -1 | 1): void {
    if (this.editando() !== null) return;
    const codigos = (this.leitura.fato()?.valores ?? []).map((valor) => valor.codigo);
    const troca = trocarDeLugar(codigos, codigo, sentido);
    if (troca === null) return;
    const id = this.idDoFato();
    const ordem = troca.codigos.join(',');
    this.executar({
      operacao: this.api.reordenarValores(
        id,
        { codigos: [...troca.codigos] },
        withIdempotencyKey(this.chaves.de('ordem', id, ordem)),
      ),
      sucesso: `Valor ${codigo} movido`,
      aoSalvar: () => {
        this.chaves.rotacionar('ordem');
        this.focoAposRecarga = idDoValor(codigo, troca.focoEm);
      },
    });
  }

  acrescentarRegra(): void {
    this.regras.acrescentar(this.leitura.fato()?.dominio ?? '');
  }

  salvarRegras(): void {
    if (this.bloqueado()) return;
    const porCodigo = new Map(this.leitura.fatosDaRegra().map((fato) => [fato.codigo, fato]));
    if (!this.regras.conferir(porCodigo, this.leitura.fatosJaCitados())) return;
    const id = this.idDoFato();
    this.executar({
      operacao: this.api.definirRegrasPadrao(
        id,
        this.regras.corpo(),
        withIdempotencyKey(this.chaves.de('regras', id)),
      ),
      sucesso: 'Regras padrão salvas',
      aoSalvar: () => {
        this.chaves.rotacionar('regras');
        this.aRecopiar.regras = true;
      },
      aoRecusar: (problem) => this.regras.aplicarRecusa(problem),
    });
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
    const coube = aplicarErrosNoFormulario(formulario, problem);
    if (coube) this.focarPrimeiroInvalidoEm(idDoFormulario);
    return coube;
  }

  /** Descrição só com espaços não é descrição: no fato declarado vale como vazia. */
  private exigirDescricaoDoDeclarado(controle: FormControl<string>): void {
    if (this.leitura.fato()?.origem === 'DECLARADO' && obrigatorioNaoEmBranco(controle) !== null) {
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
    if (outroFato) {
      this.editando.set(null);
      this.correcao.reset();
    }
    if (outroFato || this.aRecopiar.descritivo) this.descritivo.reset(valoresDoDescritivo(fato));
    if (outroFato || this.aRecopiar.definicao) {
      this.definicao.reset(valoresDaDefinicao(fato));
      this.citacoes.set([]);
    }
    if (outroFato || this.aRecopiar.regras) this.regras.copiarDe(fato);
    this.fatoCopiado = fato.id;
    this.aRecopiar = { ...NADA_A_RECOPIAR };
    this.devolverFoco();
  }

  private idDoFato(): string {
    return this.leitura.id() ?? '';
  }
}
