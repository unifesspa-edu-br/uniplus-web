import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  PrecedenciaFaseDto,
  type AtualizarPrecedenciaFaseCommand,
  type CriarPrecedenciaFaseCommand,
} from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  mensagemDeErroDoControle,
  nullIfBlank,
} from '../../shared/formulario';

/** Vendor codes dos DomainErrors de PrecedenciaFase (uniplus-api, todos 422, exceto a ausência, 404). */
export const ERRO_SELF_LOOP = 'uniplus.configuracao.precedencia_fase.self_loop';
export const ERRO_ARESTA_DUPLICADA = 'uniplus.configuracao.precedencia_fase.aresta_duplicada';
export const ERRO_ANTECESSORA_FORA_CANONICO =
  'uniplus.configuracao.precedencia_fase.antecessora_fora_do_conjunto_canonico';
export const ERRO_SUCESSORA_FORA_CANONICO =
  'uniplus.configuracao.precedencia_fase.sucessora_fora_do_conjunto_canonico';
export const ERRO_NAO_ENCONTRADA = 'uniplus.configuracao.precedencia_fase.nao_encontrada';

export const MENSAGEM_DE_AUTORREFERENCIA = 'A fase sucessora não pode ser igual à antecessora.';

export interface PrecedenciaForm {
  antecessoraCodigo: FormControl<string>;
  sucessoraCodigo: FormControl<string>;
  permiteSobreposicao: FormControl<boolean>;
}

type ValoresDaPrecedencia = ReturnType<FormGroup<PrecedenciaForm>['getRawValue']>;

const CAMPOS: ReadonlySet<string> = new Set<keyof PrecedenciaForm>([
  'antecessoraCodigo',
  'sucessoraCodigo',
  'permiteSobreposicao',
]);

/**
 * Erros de um código isolado, que o servidor recusa e a tela mostra no campo correspondente. Os
 * que dependem do par têm tratamento próprio (`CODIGOS_ERRO_DO_PAR`), e `ciclo_detectado` fica
 * de fora dos dois: a aresta que fecha um ciclo é inválida pelo grafo inteiro, não por um campo, e
 * aparece no alerta do formulário.
 */
export const CAMPO_DO_CODIGO_ISOLADO: ReadonlyMap<string, keyof PrecedenciaForm> = new Map([
  [ERRO_SUCESSORA_FORA_CANONICO, 'sucessoraCodigo'],
  [ERRO_ANTECESSORA_FORA_CANONICO, 'antecessoraCodigo'],
]);

/**
 * Erros que qualificam o par, não um campo. Aparecem na sucessora, o campo escolhido por último,
 * e deixam de valer quando qualquer um dos dois lados muda.
 */
export const CODIGOS_ERRO_DO_PAR: ReadonlySet<string> = new Set([
  ERRO_SELF_LOOP,
  ERRO_ARESTA_DUPLICADA,
]);

/** Antecessora igual à sucessora: o servidor recusa com 422, e a tela barra antes. */
function autorreferencia(grupo: AbstractControl): ValidationErrors | null {
  const antecessora = grupo.get('antecessoraCodigo')?.value;
  const sucessora = grupo.get('sucessoraCodigo')?.value;
  return antecessora && sucessora && antecessora === sucessora ? { selfLoop: true } : null;
}

export function criarFormularioDePrecedencia(): FormGroup<PrecedenciaForm> {
  return new FormGroup<PrecedenciaForm>(
    {
      antecessoraCodigo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      sucessoraCodigo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      permiteSobreposicao: new FormControl(false, { nonNullable: true }),
    },
    { validators: autorreferencia },
  );
}

export function valoresEmBrancoDaPrecedencia(): ValoresDaPrecedencia {
  return { antecessoraCodigo: '', sucessoraCodigo: '', permiteSobreposicao: false };
}

export function valoresDaPrecedencia(aresta: PrecedenciaFaseDto): ValoresDaPrecedencia {
  return {
    antecessoraCodigo: aresta.antecessoraCodigo,
    sucessoraCodigo: aresta.sucessoraCodigo,
    permiteSobreposicao: aresta.permiteSobreposicao,
  };
}

export function controleDoCampoDoServidor(field: string): keyof PrecedenciaForm | null {
  return controlNameFromBackendField<keyof PrecedenciaForm>(field, CAMPOS);
}

/** A mensagem da sucessora: a autorreferência do par, ou a do próprio controle. */
export function mensagemDaSucessora(form: FormGroup<PrecedenciaForm>): string | null {
  const sucessora = form.controls.sucessoraCodigo;
  if ((sucessora.touched || sucessora.dirty) && form.hasError('selfLoop')) {
    return MENSAGEM_DE_AUTORREFERENCIA;
  }
  return mensagemDeErroDoControle(sucessora);
}

/**
 * Tira da sucessora o erro do par devolvido pelo servidor. O Angular não revalida erros manuais de
 * um irmão: preso à sucessora, o erro sobreviveria à correção da antecessora e deixaria o
 * formulário travado numa dupla que já mudou.
 */
export function descartarErroDoPar(form: FormGroup<PrecedenciaForm>): void {
  const sucessora = form.controls.sucessoraCodigo;
  const codigo = (sucessora.errors?.['backend'] as { code?: string } | undefined)?.code;
  if (codigo !== undefined && CODIGOS_ERRO_DO_PAR.has(codigo)) {
    sucessora.updateValueAndValidity({ emitEvent: false });
  }
}

/** Projeção explícita: um campo novo no formulário não vaza para o payload. */
export function comandoDeCriacao(form: FormGroup<PrecedenciaForm>): CriarPrecedenciaFaseCommand {
  const valor = form.getRawValue();
  return {
    antecessoraCodigo: nullIfBlank(valor.antecessoraCodigo),
    sucessoraCodigo: nullIfBlank(valor.sucessoraCodigo),
    permiteSobreposicao: valor.permiteSobreposicao,
  };
}

/** O par de fases é imutável: a atualização só transporta o sinalizador de sobreposição. */
export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<PrecedenciaForm>,
): AtualizarPrecedenciaFaseCommand {
  return { id, permiteSobreposicao: form.getRawValue().permiteSobreposicao };
}
