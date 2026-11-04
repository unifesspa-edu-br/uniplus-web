import { DestroyRef, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ValidationErrors } from '@angular/forms';
import { type ApiFailure, STATUS_HTTP } from '@uniplus/shared-core/http';
import type { NomesDeMunicipios } from '../editor-de-condicoes/valor-de-municipio';
import {
  ENDERECO_VAZIO,
  criarFormularioDoEndereco,
  montarEndereco,
  textosDoCep,
  textosDoEndereco,
} from './endereco-geo.formulario';
import {
  type BuscaDeCep,
  type CepEncontrado,
  type EnderecoEstruturado,
  ORIGEM_MANUAL,
} from './endereco-geo.model';
import { ResolucaoDoEndereco, somenteDigitos } from './endereco-geo.resolucao';

const DIGITOS_DO_CEP = 8;
/** Sentinela do erro de CEP inexistente quando o endereço exige CEP (mensagem com link). */
export const CEP_SEM_REGISTRO = 'CEP_SEM_REGISTRO';

/** O que a condução pede a quem a hospeda: o Geo, o aviso do valor e da validade, e o ciclo de vida. */
export interface DependenciasDaConducao {
  readonly exigeCep: () => boolean;
  readonly buscaDeCep: BuscaDeCep;
  readonly municipios: NomesDeMunicipios;
  readonly tituloDoProblema: (falha: ApiFailure) => string;
  readonly destroyRef: DestroyRef;
  readonly aoMudarOValor: (valor: EnderecoEstruturado | null) => void;
  readonly aoMudarAValidade: () => void;
}

/**
 * Conduz o preenchimento do endereço: dona do formulário e da resolução do CEP, faz a busca no
 * Geo e as transições entre CEP resolvido, correção do CEP e entrada manual sem CEP, e avisa quem a
 * hospeda do valor montado e da validade. O componente só a adapta ao Angular Forms e à interação
 * visual.
 */
export class ConducaoDoEndereco {
  readonly form = criarFormularioDoEndereco();
  readonly resolucao: ResolucaoDoEndereco;

  readonly disabled = signal(false);
  readonly resolvendoCep = signal(false);
  readonly cepErro = signal<string | null>(null);
  /** CEP ancorado reaberto para correção via "Trocar CEP" — ver `iniciarEdicaoCep`. */
  readonly editandoCep = signal(false);
  readonly modoManual = signal(false);
  readonly tamanhoDoComplemento = signal(0);
  /** O que o leitor de tela ouve sobre a busca do CEP: o início e a conclusão bem-sucedida. */
  readonly anuncioDoCep = signal('');
  /** A UF escolhida no endereço sem CEP, antes da cidade: a busca de municípios se limita a ela. */
  private readonly ufEscolhida = signal('');

  /** A UF da cidade escolhida, ou a escolhida antes dela. */
  readonly ufDaCidade = computed(() => this.resolucao.cidade()?.uf ?? this.ufEscolhida());
  /** A cidade escolhida no campo de município, pelo código IBGE. */
  readonly codigoDaCidade = computed(() => {
    const cidade = this.resolucao.cidade();
    return cidade ? [cidade.codigoIbge] : [];
  });
  /** O 404 do Geo com `exigeCep`: a mensagem leva o link da busca dos Correios. */
  readonly cepSemRegistro = computed(() => this.cepErro() === CEP_SEM_REGISTRO);

  constructor(private readonly dependencias: DependenciasDaConducao) {
    this.resolucao = new ResolucaoDoEndereco(dependencias.exigeCep);
    this.form.valueChanges
      .pipe(takeUntilDestroyed(dependencias.destroyRef))
      .subscribe(() => this.emitir());
  }

  /** Recebe o valor do formulário pai; `null` volta ao endereço novo. */
  escrever(valor: EnderecoEstruturado | null): void {
    if (valor === null) {
      this.form.reset(ENDERECO_VAZIO, { emitEvent: false });
      this.resolucao.limpar();
    } else {
      this.form.setValue(textosDoEndereco(valor), { emitEvent: false });
      this.resolucao.restaurar(valor);
      // O nome da cidade gravada aparece no campo de município sem passar pela busca.
      if (valor.cidade) {
        this.dependencias.municipios.lembrar([valor.cidade]);
      }
    }
    this.tamanhoDoComplemento.set((valor?.complemento ?? '').length);
    this.ufEscolhida.set(valor?.cidade?.uf ?? '');
    // Endereço gravado manualmente reabre em modo manual (tudo editável).
    this.modoManual.set(valor?.origem === ORIGEM_MANUAL && !this.dependencias.exigeCep());
    this.cepErro.set(null);
    this.editandoCep.set(false);
    this.anuncioDoCep.set('');
  }

  desabilitar(desabilitado: boolean): void {
    this.disabled.set(desabilitado);
    if (desabilitado) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  /**
   * Inválido enquanto houver um CEP digitado que não foi resolvido pelo Geo — bloqueia o save
   * mesmo quando o endereço é opcional (Instituição), para a tentativa de CEP não ser descartada
   * em silêncio.
   */
  validar(): ValidationErrors | null {
    const resolucao = this.resolucao;
    if (resolucao.cepPendente()) {
      return { cepNaoResolvido: true };
    }
    if (resolucao.cepDeFaixaSemConfirmacao()) {
      return { cepNaoConfirmado: true };
    }
    if (
      this.dependencias.exigeCep() &&
      resolucao.cidade() !== null &&
      resolucao.cepResolvido().length !== DIGITOS_DO_CEP
    ) {
      return { cepObrigatorio: true };
    }
    return this.logradouroOuBairroVazios() ? { logradouroBairroObrigatorios: true } : null;
  }

  /** Logradouro ou bairro obrigatório (CEP geral da cidade) ainda vazio. */
  faltaPreencher(campo: 'logradouro' | 'bairro'): boolean {
    return (
      this.resolucao.logradouroBairroObrigatorios() && this.form.controls[campo].value.trim() === ''
    );
  }

  /**
   * O campo que o CEP resolveu sem valor: o DNE não tem bairro ou distrito para esse logradouro — o
   * distrito, em especial, só existe fora da sede do município. Travado e vazio, ele não informa
   * nada ao usuário e parece defeito, então não aparece; o valor continua nulo.
   */
  semValorDoCep(campo: 'bairro' | 'distrito'): boolean {
    return this.resolucao.ehAncorado(campo) && this.form.controls[campo].value.trim() === '';
  }

  /** O CEP digitado tem 8 dígitos e ainda não foi resolvido (evita request redundante). */
  cepNovoCompleto(): boolean {
    const digitos = somenteDigitos(this.form.controls.cep.value);
    return digitos.length === DIGITOS_DO_CEP && digitos !== this.resolucao.cepResolvido();
  }

  /**
   * Reabre o campo CEP para correção sem descartar o restante do endereço já resolvido; a outra
   * saída, o fluxo "sem CEP", zera CEP e campos derivados como efeito colateral.
   */
  iniciarEdicaoCep(): void {
    this.editandoCep.set(true);
    this.cepErro.set(null);
  }

  resolverCep(): void {
    if (this.resolvendoCep() || this.disabled()) {
      return;
    }
    const digitos = somenteDigitos(this.form.controls.cep.value);
    if (digitos.length !== DIGITOS_DO_CEP) {
      this.cepErro.set('Informe um CEP com 8 dígitos.');
      return;
    }
    this.resolvendoCep.set(true);
    this.cepErro.set(null);
    this.anuncioDoCep.set('Buscando CEP…');
    this.dependencias
      .buscaDeCep(digitos)
      .pipe(takeUntilDestroyed(this.dependencias.destroyRef))
      .subscribe((resultado) => {
        this.resolvendoCep.set(false);
        // Resposta obsoleta: o CEP mudou durante a busca e não pode sobrescrever o formulário.
        if (somenteDigitos(this.form.controls.cep.value) !== digitos) {
          this.anuncioDoCep.set('');
          return;
        }
        if (resultado.ok) {
          this.aplicarCepResolvido(resultado.data, digitos);
        } else {
          // A recusa é anunciada pela mensagem de erro do campo.
          this.anuncioDoCep.set('');
          this.recusarCep(resultado);
        }
      });
  }

  confirmarCep(confirmado: boolean): void {
    this.resolucao.confirmar(confirmado);
    this.emitir();
  }

  /** Alterna entre autofill por CEP e preenchimento manual (sem CEP). */
  alternarModoManual(): void {
    if (this.dependencias.exigeCep()) {
      return;
    }
    const manual = !this.modoManual();
    this.ufEscolhida.set(this.resolucao.cidade()?.uf ?? '');
    this.modoManual.set(manual);
    this.cepErro.set(null);
    this.editandoCep.set(false);
    if (manual) {
      this.resolucao.passarParaEntradaManual();
      this.form.reset(ENDERECO_VAZIO, { emitEvent: false });
    }
    this.emitir();
  }

  /** A UF do endereço sem CEP: trocá-la tira a cidade de outra UF. */
  escolherUf(sigla: string): void {
    this.ufEscolhida.set(sigla);
    const cidade = this.resolucao.cidade();
    if (cidade !== null && cidade.uf !== sigla) {
      this.selecionarCidade('');
    }
  }

  /** A cidade escolhida no campo de município, achada pela busca; o código vazio tira a cidade. */
  selecionarCidade(codigo: string): void {
    const selecionada = codigo === '' ? null : this.dependencias.municipios.municipio(codigo);
    this.resolucao.escolherCidade(
      selecionada
        ? { codigoIbge: selecionada.codigoIbge, nome: selecionada.nome, uf: selecionada.uf }
        : null,
    );
    this.emitir();
  }

  private logradouroOuBairroVazios(): boolean {
    if (!this.resolucao.logradouroBairroObrigatorios()) {
      return false;
    }
    const { logradouro, bairro } = this.form.getRawValue();
    return logradouro.trim() === '' || bairro.trim() === '';
  }

  private recusarCep(falha: ApiFailure): void {
    if (falha.status === STATUS_HTTP.NAO_ENCONTRADO) {
      this.resolucao.aoNaoEncontrarCep();
      this.cepErro.set(
        this.dependencias.exigeCep()
          ? CEP_SEM_REGISTRO
          : 'CEP não encontrado. Verifique ou preencha o endereço manualmente.',
      );
    } else if (falha.status === STATUS_HTTP.REQUISICAO_INVALIDA) {
      this.cepErro.set('CEP em formato inválido.');
    } else {
      this.cepErro.set(this.dependencias.tituloDoProblema(falha));
    }
  }

  private aplicarCepResolvido(cep: CepEncontrado, digitos: string): void {
    this.modoManual.set(false);
    this.editandoCep.set(false);
    this.anuncioDoCep.set('CEP encontrado.');
    this.dependencias.municipios.lembrar([this.resolucao.adotar(cep, digitos)]);
    this.form.patchValue(textosDoCep(cep, !this.resolucao.cepEmFaixa()), { emitEvent: false });
    this.emitir();
  }

  private emitir(): void {
    if (this.form.controls.cep.value.trim().length === 0 && this.resolucao.temResolucao) {
      this.descartarCorrecaoAbandonada();
    }
    const texto = this.form.getRawValue();
    this.tamanhoDoComplemento.set(texto.complemento.length);
    this.resolucao.sincronizarComCampo(texto.cep);
    if (this.resolucao.cepCorrespondeAoResolvido()) {
      this.cepErro.set(null);
    }
    this.dependencias.aoMudarAValidade();
    this.dependencias.aoMudarOValor(montarEndereco(texto, this.resolucao));
  }

  private descartarCorrecaoAbandonada(): void {
    this.resolucao.descartar();
    this.cepErro.set(null);
    // O número descreve um imóvel do endereço abandonado e não pode vazar para o próximo CEP.
    this.form.patchValue(
      { ...ENDERECO_VAZIO, cep: this.form.controls.cep.value },
      { emitEvent: false },
    );
  }
}
