import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  TipoAtoPublicadoDto,
  type AtualizarTipoAtoPublicadoCommand,
  type CriarTipoAtoPublicadoCommand,
} from '@uniplus/shared-data/publicacoes';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

export interface AtoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  vigenciaInicio: FormControl<string>;
  vigenciaFim: FormControl<string>;
  congelaConfiguracao: FormControl<boolean>;
  unicoPorObjeto: FormControl<boolean>;
  efeitoIrreversivel: FormControl<boolean>;
  ehResultado: FormControl<boolean>;
  publicavelComoAvulso: FormControl<boolean | null>;
  exigeAtoCorrigido: FormControl<boolean | null>;
  baseLegal: FormControl<string>;
}

export type ValoresDoAto = ReturnType<FormGroup<AtoForm>['getRawValue']>;

const CAMPOS: ReadonlySet<string> = new Set<keyof AtoForm>([
  'codigo',
  'nome',
  'vigenciaInicio',
  'vigenciaFim',
  'congelaConfiguracao',
  'unicoPorObjeto',
  'efeitoIrreversivel',
  'ehResultado',
  'publicavelComoAvulso',
  'exigeAtoCorrigido',
  'baseLegal',
]);

export function criarFormularioDeAto(): FormGroup<AtoForm> {
  return new FormGroup<AtoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    vigenciaInicio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    vigenciaFim: new FormControl('', { nonNullable: true }),
    congelaConfiguracao: new FormControl(false, { nonNullable: true }),
    unicoPorObjeto: new FormControl(false, { nonNullable: true }),
    efeitoIrreversivel: new FormControl(false, { nonNullable: true }),
    ehResultado: new FormControl(false, { nonNullable: true }),
    publicavelComoAvulso: new FormControl<boolean | null>(null, Validators.required),
    exigeAtoCorrigido: new FormControl<boolean | null>(null, Validators.required),
    baseLegal: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });
}

/** Os dois atributos de publicação nascem sem resposta: o operador declara sim ou não. */
export function valoresEmBrancoDoAto(): ValoresDoAto {
  return {
    codigo: '',
    nome: '',
    vigenciaInicio: '',
    vigenciaFim: '',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: false,
    publicavelComoAvulso: null,
    exigeAtoCorrigido: null,
    baseLegal: '',
  };
}

export function valoresDoAto(ato: TipoAtoPublicadoDto): ValoresDoAto {
  return {
    codigo: ato.codigo,
    nome: ato.nome,
    vigenciaInicio: ato.vigenciaInicio,
    vigenciaFim: ato.vigenciaFim ?? '',
    congelaConfiguracao: ato.congelaConfiguracao,
    unicoPorObjeto: ato.unicoPorObjeto,
    efeitoIrreversivel: ato.efeitoIrreversivel,
    ehResultado: ato.ehResultado,
    publicavelComoAvulso: ato.publicavelComoAvulso,
    exigeAtoCorrigido: ato.exigeAtoCorrigido,
    baseLegal: ato.baseLegal ?? '',
  };
}

export function controleDoCampoDoServidor(field: string): keyof AtoForm | null {
  return controlNameFromBackendField<keyof AtoForm>(field, CAMPOS);
}

export function comandoDeCriacao(form: FormGroup<AtoForm>): CriarTipoAtoPublicadoCommand {
  const valor = form.getRawValue();
  return {
    codigo: valor.codigo.trim(),
    nome: valor.nome.trim(),
    congelaConfiguracao: valor.congelaConfiguracao,
    unicoPorObjeto: valor.unicoPorObjeto,
    efeitoIrreversivel: valor.efeitoIrreversivel,
    ehResultado: valor.ehResultado,
    publicavelComoAvulso: valor.publicavelComoAvulso as boolean,
    exigeAtoCorrigido: valor.exigeAtoCorrigido as boolean,
    vigenciaInicio: valor.vigenciaInicio,
    vigenciaFim: nullIfBlank(valor.vigenciaFim),
    baseLegal: nullIfBlank(valor.baseLegal),
  };
}

/** O `id` do corpo reapresenta o da rota e o `codigo` volta idêntico ao persistido: o agregado recusa divergência nos dois. */
export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<AtoForm>,
): AtualizarTipoAtoPublicadoCommand {
  return { id, ...comandoDeCriacao(form) };
}

/**
 * Normaliza o código em caixa alta no modelo, sem reescrever a view (`emitModelToViewChange:
 * false`), para não reposicionar o cursor; a apresentação em caixa alta fica por conta do
 * `text-transform` do campo. Fora da criação nunca escreve: o código vigente é imutável.
 *
 * Chamar em contexto de injeção: a inscrição termina com a tela.
 */
export function normalizarCaixaDoCodigo(form: FormGroup<AtoForm>, emCriacao: () => boolean): void {
  form.controls.codigo.valueChanges.pipe(takeUntilDestroyed()).subscribe((codigo) => {
    const emCaixaAlta = codigo.toLocaleUpperCase('pt-BR');
    if (!emCriacao() || emCaixaAlta === codigo) return;
    form.controls.codigo.setValue(emCaixaAlta, { emitEvent: false, emitModelToViewChange: false });
  });
}
