import { inject, Injectable } from '@angular/core';
import { isApiOk, ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import type {
  AplicacaoDeModeloDto,
  FormularioDto,
  ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import type { FormularioDoProcessoNoRascunho } from '../../../processo-seletivo.models';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import {
  paraGravarDoServidor,
  planoDeGravacao,
  type FormularioParaGravar,
} from '../formulario-do-processo';
import type { ProcessoAposAplicacao } from '../modelo-de-formulario';
import { LeituraDoProcessoNoFormulario } from './leitura-do-processo-no-formulario.service';
import { textoDaRecusa } from './texto-da-recusa';

type Recusa = {
  readonly ok: false;
  readonly recusa: string;
  readonly copiaConfirmada: boolean | null;
  /** Se o cabeçalho do formulário já foi gravado: ele existe no servidor, mesmo sem a cópia. */
  readonly formularioNoServidor: boolean;
};

/** O desfecho da aplicação de um modelo: a recusa a mostrar, ou o que o servidor relatou e ficou tendo. */
export type DesfechoDaAplicacao =
  /**
   * `copiaConfirmada`: nulo quando a recusa é definitiva e nada foi copiado; `false` quando a cópia
   * pode ter acontecido; `true` quando aconteceu e a releitura falhou.
   */
  | Recusa
  | {
      readonly ok: true;
      readonly relato: AplicacaoDeModeloDto;
      readonly servidor: ProcessoAposAplicacao;
      readonly avisoDaFase: string | null;
    };

/** O cabeçalho do formulário com a fase resolvida para o id, como a gravação o compara. */
type CabecalhoParaGravar = FormularioParaGravar & { readonly faseId: string };

/** O que a nova declaração do cabeçalho fez: se mudou o servidor, e o aviso quando ele a recusou. */
type DesfechoDoCabecalho = { readonly regravou: boolean; readonly aviso: string | null };

const SEM_MUDANCA: DesfechoDoCabecalho = { regravou: false, aviso: null };

const recusaSemCopia = (recusa: string): Recusa => ({
  ok: false,
  recusa,
  copiaConfirmada: null,
  formularioNoServidor: false,
});

/** A releitura que falhou depois da cópia: o formulário existe e a cópia aconteceu. */
const SEM_RELEITURA_DEPOIS_DA_COPIA: Recusa = {
  ok: false,
  recusa: '',
  copiaConfirmada: true,
  formularioNoServidor: true,
};

/**
 * A sequência de chamadas que aplica um modelo ao formulário: o cabeçalho, que a cópia exige já
 * gravado, a cópia, o cabeçalho de novo quando a cópia o desfez e a releitura que projeta o
 * resultado.
 */
@Injectable()
export class AplicacaoNoServidor {
  private readonly cadastro = inject(CadastroInicial);
  private readonly leitura = inject(LeituraDoProcessoNoFormulario);
  private readonly problemI18n = inject(ProblemI18nService);

  /**
   * A aplicação no servidor: relê o processo, grava o cabeçalho do formulário com o que o rascunho
   * declara, aplica o modelo, declara de novo o cabeçalho se a cópia o desfez e relê para projetar
   * o resultado. A fase precisa estar no cronograma gravado ANTES da cópia: sem ela, o formulário
   * ficaria sem fase, e a publicação o recusa.
   */
  async aplicar(
    processoId: string,
    formulario: FormularioDoProcessoNoRascunho,
    modeloId: string,
  ): Promise<DesfechoDaAplicacao> {
    const cabecalho = await this.gravarCabecalho(processoId, formulario);
    if ('ok' in cabecalho) return cabecalho;
    const codigo = formulario.codigo;
    const copia = await this.cadastro.aplicarModeloDeFormulario(processoId, modeloId, codigo);
    if (!copia.ok) return this.recusaDaCopia(copia);
    return this.desfechoDaCopia(processoId, cabecalho, codigo, copia.relato);
  }

  private recusaDaCopia(copia: { problem: ProblemDetails; inconclusiva: boolean }): Recusa {
    return {
      ok: false,
      recusa: textoDaRecusa(copia.problem, this.problemI18n),
      copiaConfirmada: copia.inconclusiva ? false : null,
      formularioNoServidor: true,
    };
  }

  /** Relê o processo depois da cópia, declara de novo o cabeçalho se ela o desfez e projeta o resultado. */
  private async desfechoDaCopia(
    processoId: string,
    cabecalho: CabecalhoParaGravar,
    codigo: string,
    relato: AplicacaoDeModeloDto,
  ): Promise<DesfechoDaAplicacao> {
    const depois = await this.leitura.ler(processoId);
    if (!isApiOk(depois)) return SEM_RELEITURA_DEPOIS_DA_COPIA;
    const copiado = depois.data.formularios.find((item) => item.codigo === codigo);
    const redeclarado = await this.redeclararCabecalho(processoId, codigo, cabecalho, copiado);
    const final = redeclarado.regravou ? await this.leitura.ler(processoId) : depois;
    if (!isApiOk(final)) return SEM_RELEITURA_DEPOIS_DA_COPIA;
    const servidor = processoAposAplicacao(final.data);
    return { ok: true, relato, avisoDaFase: redeclarado.aviso, servidor };
  }

  /**
   * Relê o processo e grava o cabeçalho do formulário — fase, obrigatoriedade e consequência —, sem
   * mexer no conteúdo que o servidor já tem. Sem a fase no cronograma gravado, a recusa volta como
   * desfecho.
   */
  private async gravarCabecalho(
    processoId: string,
    formulario: FormularioDoProcessoNoRascunho,
  ): Promise<CabecalhoParaGravar | Recusa> {
    const antes = await this.leitura.ler(processoId);
    if (!isApiOk(antes)) return recusaSemCopia(NAO_RELEU_O_PROCESSO);
    const fase = antes.data.cronogramaFases.find((item) => item.codigo === formulario.faseCodigo);
    if (fase === undefined) return recusaSemCopia(textoDaFaseForaDoCronograma(formulario.codigo));
    const gravado = antes.data.formularios.find((item) => item.codigo === formulario.codigo);
    const desejado = cabecalhoDesejado(formulario, fase.id, gravado);
    return this.gravarDesejado(processoId, formulario.codigo, desejado, gravado);
  }

  private async gravarDesejado(
    processoId: string,
    codigo: string,
    desejado: CabecalhoParaGravar,
    gravado: FormularioDto | undefined,
  ): Promise<CabecalhoParaGravar | Recusa> {
    const servidor = gravado === undefined ? null : paraGravarDoServidor(gravado);
    const resultado = await this.cadastro.gravarFormulario(processoId, codigo, servidor, desejado);
    return resultado.ok
      ? desejado
      : recusaSemCopia(textoDaRecusa(resultado.problem, this.problemI18n));
  }

  /**
   * Declara de novo o cabeçalho quando a cópia o desfez. Diz se o cabeçalho mudou no servidor — a
   * releitura então traz o novo — e o aviso, quando o servidor recusou.
   */
  private async redeclararCabecalho(
    processoId: string,
    codigo: string,
    desejado: CabecalhoParaGravar,
    copiado: FormularioDto | undefined,
  ): Promise<DesfechoDoCabecalho> {
    if (copiado === undefined) return SEM_MUDANCA;
    const servidor = paraGravarDoServidor(copiado);
    const novo = { ...desejado, conteudo: servidor.conteudo };
    const mudou = planoDeGravacao(servidor, novo).length > 0;
    const resultado = await this.cadastro.gravarFormulario(processoId, codigo, servidor, novo);
    return resultado.ok
      ? { regravou: mudou, aviso: null }
      : { regravou: false, aviso: this.avisoDaRecusa(resultado.problem) };
  }

  private avisoDaRecusa(problem: ProblemDetails): string {
    return avisoDoCabecalho(textoDaRecusa(problem, this.problemI18n));
  }
}

/**
 * O cabeçalho que o rascunho declara. O conteúdo é o que o servidor já tem; no formulário que ainda
 * não existe lá, só as páginas do rascunho, sem itens nem termos: a cópia os substitui.
 */
function cabecalhoDesejado(
  formulario: FormularioDoProcessoNoRascunho,
  faseId: string,
  gravado: FormularioDto | undefined,
): CabecalhoParaGravar {
  return {
    faseId,
    obrigatorio: formulario.obrigatorio,
    consequenciaDaFaltaDeEnvio: formulario.consequenciaDaFaltaDeEnvio,
    conteudo:
      gravado === undefined
        ? { ...formulario.conteudo, itens: [], grupos: [], termos: [] }
        : paraGravarDoServidor(gravado).conteudo,
  };
}

const NAO_RELEU_O_PROCESSO =
  'Não foi possível reler o processo para aplicar o modelo. Tente de novo.';

const avisoDoCabecalho = (recusa: string): string =>
  `O cabeçalho do formulário não foi gravado: ${recusa} Grave o passo para declará-lo.`;

function textoDaFaseForaDoCronograma(codigo: string): string {
  return `O formulário ${codigo} precisa de uma fase do cronograma gravado antes de partir de um modelo. Escolha a fase nesta aba; se ela é nova, grave antes o passo Cronograma.`;
}

/** O processo relido como a projeção da aplicação o precisa. */
function processoAposAplicacao(processo: ProcessoSeletivoDto): ProcessoAposAplicacao {
  return {
    formularios: processo.formularios,
    cronogramaFases: processo.cronogramaFases,
    regrasDerivacao: processo.regrasDerivacao.map((config) => ({
      codigoFato: config.codigoFato,
      regras: config.regras,
    })),
  };
}
