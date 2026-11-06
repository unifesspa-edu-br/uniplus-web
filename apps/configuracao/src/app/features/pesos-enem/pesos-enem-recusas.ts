import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { ProblemDetails, STATUS_HTTP } from '@uniplus/shared-core/http';
import { controlNameFromBackendField } from '../../shared/formulario';
import type { AreaForm } from './pesos-enem-form';

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
    const area = areas.at(Number(daArea[1]));
    if (area === undefined) {
      return null;
    }
    return daArea[2]?.toLowerCase() === 'corte' ? area.controls.corte : area.controls.peso;
  }
  if (/(?:^|\.)areas$/iu.test(field)) {
    return areas.at(0)?.controls.peso ?? null;
  }
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

/** Marca cada controle recusado. Vários erros podem cair no mesmo campo (ex.: `areas[i].codigo`
 *  e `areas[i].peso` vão ambos ao peso da área): acumula as mensagens, para o operador ver
 *  todas. Devolve as que não têm campo corrigível aqui. */
function marcarCamposRecusados(
  areas: FormArray<FormGroup<AreaForm>>,
  destinos: DestinosDePrimeiroNivel,
  errors: NonNullable<ProblemDetails['errors']>,
): string[] {
  const semCampo: string[] = [];
  const porControle = new Map<AbstractControl, MensagensDoControle>();
  for (const erro of errors) {
    const control = controleDoCampoDoServidor(areas, destinos, erro.field);
    const alvo = control === null ? semCampo : (porControle.get(control)?.mensagens ?? []);
    if (!alvo.includes(erro.message)) {
      alvo.push(erro.message);
    }
    if (control !== null && !porControle.has(control)) {
      porControle.set(control, { code: erro.code, mensagens: alvo });
    }
  }
  for (const [control, { code, mensagens }] of porControle) {
    control.setErrors({ backend: { code, message: mensagens.join(' ') } });
    control.markAsTouched();
  }
  return semCampo;
}

/**
 * Leva cada erro do backend ao campo em que o operador o corrige neste contexto. Devolve as
 * mensagens que não têm campo corrigível aqui (ex.: a base legal na edição em linha, que não
 * a exibe), para o banner da operação: um controle inválido e invisível travaria o formulário
 * sem mensagem, e pôr o erro num campo que não é o dele faria o operador mexer no lugar errado.
 *
 * Recusa 4xx sem `errors[]` (ex.: linha removida por outra sessão, conflito de concorrência)
 * não aponta campo nenhum, então vai ao banner. Falha transitória (rede, 5xx) não acrescenta
 * nada: o banner geral já a comunica.
 */
export function aplicarRecusaDoGrupo(
  areas: FormArray<FormGroup<AreaForm>>,
  problem: ProblemDetails,
  destinos: DestinosDePrimeiroNivel,
  tituloDaRecusa: (problem: ProblemDetails) => string,
): string[] {
  if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
    return marcarCamposRecusados(areas, destinos, problem.errors);
  }
  return ehRecusaAcionavelPeloOperador(problem) ? [tituloDaRecusa(problem)] : [];
}
