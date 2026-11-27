import { inject, Injectable } from '@angular/core';
import {
  isApiOk,
  ProblemI18nService,
  type ProblemValidationError,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import {
  OrigemCandidatosCodigo,
  ProcessosSeletivosApi,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { firstValueFrom } from 'rxjs';

import type { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { quemCitaNoProcesso } from '../../passos/formulario/citantes-no-processo';
import { CadastroInicial } from '../cadastro-inicial.service';
import {
  GravacaoDosCamposPressupostos,
  fatosCitadosPelasModalidadesOfertadas,
} from '../campos-pressupostos.service';
import { recusaDaExigenciaDoServidor } from '../orientacao-da-recusa-do-fato';
import { identificarRecusaDaExigencia } from './caminho-da-recusa-das-exigencias';
import { todasAsExigencias } from './consulta-das-exigencias';
import { algumDocumentoAguardaFormulario } from './documentos-aguardando-formulario';
import {
  regrasDeComprovacaoParaEnvio,
  type OrigemDaRegraEnviada,
  type ProcessoVivoDasExigencias,
} from './gravacao-das-exigencias';
import { modalidadesDaExigencia } from './modalidades-da-exigencia';

export interface RecusaDaExigencia {
  readonly identificadorDaRegra: string | null;
  readonly faseCodigo?: string;
  readonly campo: string;
  readonly codigo: string;
  readonly mensagem: string;
}

export interface ResultadoDaGravacaoDasExigencias extends ValidacaoDoPasso {
  readonly recusas?: readonly RecusaDaExigencia[];
}

function traduzirRecusa(
  erro: ProblemValidationError,
  origens: readonly OrigemDaRegraEnviada[],
): RecusaDaExigencia {
  const identificacao = identificarRecusaDaExigencia(erro.field ?? '', origens);
  return {
    identificadorDaRegra: identificacao?.identificadorDaRegra ?? null,
    faseCodigo: identificacao?.faseCodigo,
    campo: identificacao?.campo ?? erro.field ?? '',
    codigo: erro.code ?? '',
    mensagem: recusaDaExigenciaDoServidor({ code: erro.code }) ?? erro.message,
  };
}

function recusaDaReleitura(): ValidacaoDoPasso {
  return {
    valid: false,
    messages: [
      'Não foi possível reler as fases para gravar os documentos exigidos. Tente gravar de novo.',
    ],
  };
}

function recusaSemFaseDeInscricao(): ValidacaoDoPasso {
  return {
    valid: false,
    messages: [
      'Uma exigência documental depende de um dado que o formulário de inscrição precisa coletar, e o cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição.',
    ],
  };
}

/** O que a gravação dos campos decidiu: recusar, não gravar os documentos ainda, ou seguir. */
interface DesfechoDosCampos {
  readonly recusa: ValidacaoDoPasso | null;
  readonly aguardaFormulario: boolean;
}

type CamposGarantidos = Awaited<ReturnType<GravacaoDosCamposPressupostos['garantirCampos']>>;

function recusaPorCampos(motivo: string): DesfechoDosCampos {
  return { recusa: { valid: false, messages: [motivo] }, aguardaFormulario: false };
}

const SEGUE: DesfechoDosCampos = { recusa: null, aguardaFormulario: false };

/** Os códigos dos formulários que o servidor tem em cada fase do cronograma gravado. */
function formulariosPorFase(processo: ProcessoSeletivoDto): ReadonlyMap<string, string[]> {
  const codigoDaFase = new Map(processo.cronogramaFases.map((fase) => [fase.id, fase.codigo]));
  const porFase = new Map(processo.cronogramaFases.map((fase) => [fase.codigo, [] as string[]]));
  for (const formulario of processo.formularios) {
    const codigo = formulario.faseId === null ? undefined : codigoDaFase.get(formulario.faseId);
    if (codigo !== undefined) porFase.get(codigo)?.push(formulario.codigo);
  }
  return porFase;
}

/** Diz ao operador o que já ficou gravado antes da recusa; o que vale sem recusa fica como está. */
function dizendoOQueFoiGravado(
  resultado: ResultadoDaGravacaoDasExigencias,
  jaGravado: string,
): ResultadoDaGravacaoDasExigencias {
  if (resultado.valid || !resultado.messages?.length) return resultado;
  const [primeira, ...demais] = resultado.messages;
  return { ...resultado, messages: [`${jaGravado} ${primeira}`, ...demais] };
}

/** A última gravação do passo Cronograma e a que fecha o passo Formulários: os documentos que cada fase exige. */
@Injectable()
export class GravacaoDasExigenciasDocumentais {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly camposPressupostos = inject(GravacaoDosCamposPressupostos);

  /**
   * Grava os documentos que cada fase exige. `jaGravado` diz ao operador, numa recusa, o que o
   * passo de quem chama já deixou gravado.
   *
   * O servidor exige em todo documento um formulário que ele já tenha, da fase do documento, e
   * troca o conjunto inteiro de uma vez: enviar só parte apagaria o resto. Por isso, com algum
   * documento numa fase sem formulário no servidor, nada é enviado — o conjunto gravado fica como
   * está — e o store guarda que os documentos aguardam, até a gravação dos formulários.
   */
  async gravar(processoId: string, jaGravado: string): Promise<ResultadoDaGravacaoDasExigencias> {
    const resultado = await this.gravarOuAguardar(processoId);
    return dizendoOQueFoiGravado(resultado, jaGravado);
  }

  /**
   * A conversão precisa do id de cada fase, que o rascunho não guarda — ele identifica a fase pelo
   * código canônico, que é o que sobrevive à reconciliação do servidor. A releitura aqui é a que
   * traduz um no outro; sem ela, a exigência sairia apontando para uma fase que só existe no
   * rascunho.
   */
  private async gravarOuAguardar(processoId: string): Promise<ResultadoDaGravacaoDasExigencias> {
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!isApiOk(detalhe)) return recusaDaReleitura();

    return this.gravarComOsCampos(processoId, detalhe.data, geracao);
  }

  private async gravarComOsCampos(
    processoId: string,
    processo: ProcessoSeletivoDto,
    geracao: number,
  ): Promise<ResultadoDaGravacaoDasExigencias> {
    const gravado = this.processoGravado(processo);
    const campos = await this.garantirOsCampos(processoId, processo, geracao);
    if (campos.recusa !== null) return campos.recusa;
    if (campos.aguardaFormulario || this.documentoAguardaFormulario(gravado)) {
      return this.aguardarOsFormularios();
    }
    return this.gravarDocumentos(processoId, gravado, geracao);
  }

  private documentoAguardaFormulario(gravado: ProcessoVivoDasExigencias): boolean {
    return algumDocumentoAguardaFormulario(this.store.draft().documentos, gravado);
  }

  private aguardarOsFormularios(): ResultadoDaGravacaoDasExigencias {
    this.store.documentosExigidosAguardandoFormulario.set(true);
    return { valid: true };
  }

  private async gravarDocumentos(
    processoId: string,
    gravado: ProcessoVivoDasExigencias,
    geracao: number,
  ): Promise<ResultadoDaGravacaoDasExigencias> {
    const regras = regrasDeComprovacaoParaEnvio(this.store.draft().documentos, gravado);
    const gravacao = await this.cadastro.definirDocumentosExigidos(processoId, regras.regras);
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!gravacao.ok) return this.resultadoDaRecusa(gravacao.problem, regras.origens);
    this.store.documentosExigidosAguardandoFormulario.set(false);
    return { valid: true };
  }

  private resultadoDaRecusa(
    problema: ProblemDetails,
    origens: readonly OrigemDaRegraEnviada[],
  ): ResultadoDaGravacaoDasExigencias {
    const motivo =
      recusaDaExigenciaDoServidor(problema) ?? this.problemI18n.resolve(problema).title;
    return {
      valid: false,
      messages: [motivo, ...(problema.errors ?? []).map((erro) => erro.message)],
      recusas: (problema.errors ?? []).map((erro) => traduzirRecusa(erro, origens)),
    };
  }

  /**
   * Os campos do formulário saem ANTES das exigências, e não é preferência de ordem: uma exigência
   * condicionada a um fato só se resolve se o certame coletar aquele fato. Quem declara a condição
   * é este passo, então é ele que garante o campo — o operador não deveria precisar lembrar que
   * decidir de quem o documento é cobrado mexe no formulário. A exigência recortada por modalidade
   * depende também das perguntas que as regras das modalidades ofertadas fazem: é delas que a
   * modalidade do candidato se deriva.
   *
   * Devolve a recusa quando os campos não ficaram no formulário, ou `{ valid: true }` se o
   * processo mudou no meio. Sem formulário de inscrição para receber o campo, os documentos
   * aguardam: o campo entra quando o formulário existir.
   */
  private async garantirOsCampos(
    processoId: string,
    processo: ProcessoSeletivoDto,
    geracao: number,
  ): Promise<DesfechoDosCampos> {
    const recorta = this.recortaPorModalidade();
    const citadosPelasExigencias = this.citadosPelasExigencias(processo);
    const fatos = this.fatosParaColeta(processo, recorta, citadosPelasExigencias);
    const campos = await this.camposPressupostos.garantirCampos(processoId, processo, fatos);
    if (geracao !== this.store.geracao())
      return { recusa: { valid: true }, aguardaFormulario: false };
    return this.desfechoDosCampos(campos, processo, recorta, citadosPelasExigencias);
  }

  private fatosParaColeta(
    processo: ProcessoSeletivoDto,
    recorta: boolean,
    citadosPelasExigencias: ReadonlySet<string>,
  ): ReadonlySet<string> {
    return new Set([...citadosPelasExigencias, ...this.fatosDasModalidades(processo, recorta)]);
  }

  private fatosDasModalidades(
    processo: ProcessoSeletivoDto,
    recorta: boolean,
  ): ReadonlySet<string> {
    return this.pedePerguntasDasModalidades(recorta)
      ? fatosCitadosPelasModalidadesOfertadas(processo)
      : new Set<string>();
  }

  private recortaPorModalidade(): boolean {
    return todasAsExigencias(this.store.draft().documentos).some(
      (exigencia) => modalidadesDaExigencia(exigencia) !== null,
    );
  }

  /**
   * O que o servidor tem do processo para conferir cada documento: o id de cada fase e o formulário
   * de cada fase, lidos agora. O formulário do rascunho pode ainda não estar gravado, e o servidor
   * só aceita o documento de um formulário que ele já tenha.
   */
  private processoGravado(processo: ProcessoSeletivoDto): ProcessoVivoDasExigencias {
    return {
      faseIdPorCodigo: new Map(processo.cronogramaFases.map((f) => [f.codigo, f.id])),
      modalidadesOfertadas: this.store.modalidadesDoProcesso(),
      etapasVivas: new Set(processo.etapas.map((etapa) => etapa.id)),
      formulariosPorFase: formulariosPorFase(processo),
    };
  }

  /** Os fatos que as exigências e as regras de derivação citam. */
  private citadosPelasExigencias(processo: ProcessoSeletivoDto): ReadonlySet<string> {
    const draft = this.store.draft();
    return new Set(
      quemCitaNoProcesso({
        documentos: draft.documentos,
        derivacao: processo.regrasDerivacao ?? [],
        desempate: draft.desempate,
      }).keys(),
    );
  }

  private desfechoDosCampos(
    campos: CamposGarantidos,
    processo: ProcessoSeletivoDto,
    recorta: boolean,
    citadosPelasExigencias: ReadonlySet<string>,
  ): DesfechoDosCampos {
    if (campos.tipo === 'recusados') return recusaPorCampos(campos.motivo);
    if (!this.faltaFormularioParaOsCampos(campos, processo, recorta, citadosPelasExigencias)) {
      return SEGUE;
    }
    return campos.tipo === 'semFaseDeInscricao'
      ? { recusa: recusaSemFaseDeInscricao(), aguardaFormulario: false }
      : { recusa: null, aguardaFormulario: true };
  }

  private faltaFormularioParaOsCampos(
    campos: CamposGarantidos,
    processo: ProcessoSeletivoDto,
    recorta: boolean,
    citadosPelasExigencias: ReadonlySet<string>,
  ): boolean {
    if (campos.tipo !== 'semFaseDeInscricao' && campos.tipo !== 'semFormularioDeInscricao') {
      return false;
    }
    return recorta || !this.camposPressupostos.coletaTudo(processo, citadosPelasExigencias);
  }

  /**
   * As perguntas das modalidades vão ao formulário do processo em que o candidato se inscreve — é
   * a inscrição que coleta as respostas de que a modalidade dele se deriva —, e ao do que recorta
   * exigência por modalidade, que sem elas escreveria uma condição que nunca resolve.
   */
  private pedePerguntasDasModalidades(recorta: boolean): boolean {
    return (
      recorta ||
      this.store.draft().identificacao.origemCandidatos === OrigemCandidatosCodigo.INSCRICAO_PROPRIA
    );
  }
}
