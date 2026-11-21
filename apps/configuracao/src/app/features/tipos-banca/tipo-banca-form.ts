import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { AtualizarTipoBancaCommand, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

type Papel = TipoBancaDto['papel']['codigo'];
type TipoDeDecisao = TipoBancaDto['tiposDeDecisaoJulgados'][number]['codigo'];
export interface BancaForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  faseTipica: FormControl<string>;
  descricao: FormControl<string>;
  papel: FormControl<Papel | null>;
  exigeDuasOuMaisBancas: FormControl<boolean>;
  encerraRecursoNaPrimeiraInstancia: FormControl<boolean>;
  tiposDeDecisaoJulgados: FormControl<readonly TipoDeDecisao[]>;
}
const CAMPOS: ReadonlySet<string> = new Set<keyof BancaForm>([
  'codigo',
  'nome',
  'faseTipica',
  'descricao',
  'papel',
  'exigeDuasOuMaisBancas',
  'encerraRecursoNaPrimeiraInstancia',
  'tiposDeDecisaoJulgados',
]);
function campoDeTexto(...validadores: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: validadores });
}

function controlesDasMarcas() {
  return {
    papel: new FormControl<Papel | null>(null),
    exigeDuasOuMaisBancas: new FormControl(false, { nonNullable: true }),
    encerraRecursoNaPrimeiraInstancia: new FormControl(false, { nonNullable: true }),
    tiposDeDecisaoJulgados: new FormControl<readonly TipoDeDecisao[]>([], { nonNullable: true }),
  };
}

export function criarFormularioDeBanca(): FormGroup<BancaForm> {
  return new FormGroup<BancaForm>({
    codigo: campoDeTexto(Validators.required, Validators.maxLength(60)),
    nome: campoDeTexto(Validators.required, Validators.maxLength(200)),
    faseTipica: campoDeTexto(Validators.maxLength(60)),
    descricao: campoDeTexto(Validators.maxLength(300)),
    ...controlesDasMarcas(),
  });
}

export function valoresDaBanca(banca: TipoBancaDto) {
  return {
    codigo: banca.codigo.codigo,
    nome: banca.nome,
    faseTipica: banca.faseTipica ?? '',
    descricao: banca.descricao ?? '',
    papel: banca.papel.codigo,
    exigeDuasOuMaisBancas: banca.exigeDuasOuMaisBancas,
    encerraRecursoNaPrimeiraInstancia: banca.encerraRecursoNaPrimeiraInstancia,
    tiposDeDecisaoJulgados: banca.tiposDeDecisaoJulgados.map((tipo) => tipo.codigo),
  };
}
export function controleDoCampoDoServidor(field: string): keyof BancaForm | null {
  return controlNameFromBackendField<keyof BancaForm>(field.replace(/\[\d+\]/g, ''), CAMPOS);
}
function marcasDoFormulario(form: FormGroup<BancaForm>) {
  const {
    papel,
    exigeDuasOuMaisBancas,
    encerraRecursoNaPrimeiraInstancia,
    tiposDeDecisaoJulgados,
  } = form.getRawValue();
  return {
    papel,
    exigeDuasOuMaisBancas,
    encerraRecursoNaPrimeiraInstancia,
    tiposDeDecisaoJulgados,
  };
}

export function comandoDeAtualizacao(
  banca: TipoBancaDto,
  form: FormGroup<BancaForm>,
): AtualizarTipoBancaCommand {
  const valor = form.getRawValue();
  return {
    id: banca.id,
    nome: valor.nome.trim(),
    faseTipica: nullIfBlank(valor.faseTipica),
    descricao: nullIfBlank(valor.descricao),
    ...marcasDoFormulario(form),
  };
}
