import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import {
  type CausasDoProblema,
  ProblemDetails,
  separarCausas,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import { controlNameFromBackendField, marcarRecusaDoServidor } from '../../shared/formulario';
import type { AreaForm, PesoGrupoForm } from './pesos-enem-form';
import { rotuloDoGrupo } from './pesos-enem-rotulos';

/** Campos de primeiro nível do pedido que o operador corrige no contexto atual. O que falta
 *  aqui não tem campo visível, e o grupo nunca tem, porque não se edita: o erro dele vai
 *  para o banner da operação. */
export interface DestinosDePrimeiroNivel {
  readonly resolucao?: AbstractControl;
  readonly baseLegal?: AbstractControl;
}

const CAMPOS_DE_PRIMEIRO_NIVEL: ReadonlySet<keyof DestinosDePrimeiroNivel> = new Set([
  'resolucao',
  'baseLegal',
]);

/** 4xx = algo no pedido precisa mudar antes do retry (domínio/validação); 0/5xx = falha
 *  transitória (rede, servidor): o mesmo corpo pode passar num novo envio. */
export function ehRecusaAcionavelPeloOperador(problem: ProblemDetails): boolean {
  return problem.status >= 400 && problem.status < 500;
}

/** Leva o erro do backend ao campo em que o operador corrige: `areas[i].corte` ao corte da
 *  área; `areas[i].peso`, `areas[i].codigo` (o código não é editável) e o erro do item inteiro
 *  (`areas[i]`) ao peso da área; `areas` (área faltando) ao primeiro peso; `resolucao` e
 *  `baseLegal` ao campo deles, quando corrigíveis neste contexto. O resto (inclusive
 *  `grupoCurso`) devolve `null`, e a mensagem vai para o banner. Tolera prefixo no caminho
 *  (`request.`, `$.`) e a primeira letra maiúscula (`Areas[2].Peso`). */
function controleDoCampoDoServidor(
  areas: FormArray<FormGroup<AreaForm>>,
  destinos: DestinosDePrimeiroNivel,
  field: string,
): AbstractControl | null {
  const daArea = /(?:^|\.)areas\[(\d+)\](?:\.(\w+))?$/iu.exec(field);
  if (daArea !== null) {
    return controleDeUmaArea(areas, daArea);
  }
  if (/(?:^|\.)areas$/iu.test(field)) {
    return areas.at(0)?.controls.peso ?? null;
  }
  return controleDoPrimeiroNivel(destinos, field);
}

function controleDeUmaArea(
  areas: FormArray<FormGroup<AreaForm>>,
  daArea: RegExpExecArray,
): AbstractControl | null {
  const area = areas.at(Number(daArea[1]));
  if (area === undefined) {
    return null;
  }
  return daArea[2]?.toLowerCase() === 'corte' ? area.controls.corte : area.controls.peso;
}

function controleDoPrimeiroNivel(
  destinos: DestinosDePrimeiroNivel,
  field: string,
): AbstractControl | null {
  const nome = controlNameFromBackendField<keyof DestinosDePrimeiroNivel>(
    field,
    CAMPOS_DE_PRIMEIRO_NIVEL,
  );
  return nome === null ? null : (destinos[nome] ?? null);
}

interface MensagensDoControle {
  code: string;
  mensagens: string[];
}

type RecusaDeCampo = CausasDoProblema['deCampo'][number];

class MensagensDosCampos {
  private readonly porControle = new Map<AbstractControl, MensagensDoControle>();
  private readonly mensagensSemCampo: string[];

  constructor(mensagensGerais: readonly string[]) {
    this.mensagensSemCampo = [...mensagensGerais];
  }

  acumular(recusa: RecusaDeCampo, controle: AbstractControl | null): void {
    const alvo =
      controle === null
        ? this.mensagensSemCampo
        : (this.porControle.get(controle)?.mensagens ?? []);
    if (!alvo.includes(recusa.message)) {
      alvo.push(recusa.message);
    }
    if (controle !== null && !this.porControle.has(controle)) {
      this.porControle.set(controle, { code: recusa.code, mensagens: alvo });
    }
  }

  marcar(): void {
    for (const [controle, { code, mensagens }] of this.porControle) {
      marcarRecusaDoServidor(controle, code, mensagens.join(' '));
    }
  }

  semCampo(): string[] {
    return this.mensagensSemCampo;
  }
}

/** Marca cada controle recusado. Vários erros podem cair no mesmo campo (ex.: `areas[i].codigo`
 *  e `areas[i].peso` vão ambos ao peso da área): acumula as mensagens, para o operador ver
 *  todas. Devolve as que não têm campo corrigível aqui. */
function marcarCamposRecusados(
  areas: FormArray<FormGroup<AreaForm>>,
  destinos: DestinosDePrimeiroNivel,
  causas: CausasDoProblema,
): string[] {
  const mensagens = new MensagensDosCampos(causas.gerais.map((causa) => causa.message));
  for (const erro of causas.deCampo) {
    mensagens.acumular(erro, controleDoCampoDoServidor(areas, destinos, erro.field));
  }
  mensagens.marcar();
  return mensagens.semCampo();
}

/**
 * Leva cada erro do backend ao campo em que o operador o corrige neste contexto. Devolve as
 * mensagens que não têm campo corrigível aqui (ex.: a base legal na edição em linha, que não
 * a exibe), para o banner da operação: um controle inválido e invisível travaria o formulário
 * sem mensagem, e pôr o erro num campo que não é o dele faria o operador mexer no lugar errado.
 *
 * Causa geral de `errors[]` e recusa 4xx sem `errors[]` (ex.: linha removida por outra sessão, conflito de concorrência)
 * não aponta campo nenhum, então vai ao banner. Falha transitória (rede, 5xx) não acrescenta
 * nada: o banner geral já a comunica.
 */
export function aplicarRecusaDoGrupo(
  areas: FormArray<FormGroup<AreaForm>>,
  problem: ProblemDetails,
  destinos: DestinosDePrimeiroNivel,
  tituloDaRecusa: TituloDaRecusa,
): string[] {
  if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
    return marcarCamposRecusados(areas, destinos, separarCausas(problem.errors));
  }
  return ehRecusaAcionavelPeloOperador(problem) ? [tituloDaRecusa(problem)] : [];
}

/** Vendor code do DomainError de par resolução + grupo já cadastrado (409 Conflict). */
export const PAR_JA_EXISTE_CODE = 'uniplus.configuracao.peso_area_enem.par_ja_existe';

export type TituloDaRecusa = (problem: ProblemDetails) => string;

export interface FalhaDoGrupo {
  readonly grupo: FormGroup<PesoGrupoForm>;
  readonly problem: ProblemDetails;
}

export interface DesfechoDasRecusasDosGrupos {
  readonly duplicidade: boolean;
  readonly semCampo: string[];
  readonly ultimoProblema: ProblemDetails | null;
}

function ehDuplicidade({ problem }: FalhaDoGrupo): boolean {
  return problem.code === PAR_JA_EXISTE_CODE;
}

function recusarGrupo(
  { grupo, problem }: FalhaDoGrupo,
  resolucao: AbstractControl | undefined,
  titulo: TituloDaRecusa,
): string[] {
  const destinos = { resolucao, baseLegal: grupo.controls.baseLegal };
  const nome = rotuloDoGrupo(grupo.controls.grupoCurso.value);
  return aplicarRecusaDoGrupo(grupo.controls.areas, problem, destinos, titulo).map(
    (mensagem) => `${nome}: ${mensagem}`,
  );
}

/** Leva a recusa de cada grupo que falhou ao campo dele. A duplicidade do par resolução + grupo
 *  não vira mensagem de grupo: quem chama a trata no campo da resolução ou no banner. */
export function recusarGrupos(
  falhas: readonly FalhaDoGrupo[],
  resolucao: AbstractControl | undefined,
  titulo: TituloDaRecusa,
): DesfechoDasRecusasDosGrupos {
  return {
    duplicidade: falhas.some(ehDuplicidade),
    semCampo: falhas
      .filter((falha) => !ehDuplicidade(falha))
      .flatMap((falha) => recusarGrupo(falha, resolucao, titulo)),
    ultimoProblema: falhas.at(-1)?.problem ?? null,
  };
}
