import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarLocalOfertaCommand,
  CriarLocalOfertaCommand,
  LocalOfertaDto,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import {
  cidadeObrigatoriaValidator,
  enderecoEstruturadoDe,
  enderecoParaCommand,
} from '../../shared/endereco';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

export interface LocalOfertaForm {
  tipo: FormControl<string>;
  codigoEmec: FormControl<string>;
  campusResponsavelId: FormControl<string>;
  endereco: FormControl<EnderecoEstruturado | null>;
}

type ValoresDoLocal = ReturnType<FormGroup<LocalOfertaForm>['getRawValue']>;

export const LOCAL_EM_BRANCO: ValoresDoLocal = {
  tipo: '',
  codigoEmec: '',
  campusResponsavelId: '',
  endereco: null,
};

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof LocalOfertaForm>([
  'tipo',
  'codigoEmec',
  'campusResponsavelId',
]);

export function criarFormularioDeLocalOferta(): FormGroup<LocalOfertaForm> {
  return new FormGroup<LocalOfertaForm>({
    tipo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codigoEmec: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    campusResponsavelId: new FormControl('', { nonNullable: true }),
    endereco: new FormControl<EnderecoEstruturado | null>(null, {
      validators: [cidadeObrigatoriaValidator],
    }),
  });
}

export function valoresDoLocal(local: LocalOfertaDto): ValoresDoLocal {
  return {
    tipo: local.tipo,
    codigoEmec: local.codigoEmec ?? '',
    campusResponsavelId: local.campusResponsavelId ?? '',
    endereco: enderecoEstruturadoDe(local.cidade, local.endereco),
  };
}

/** O controle do formulário que corresponde ao campo recusado pelo servidor, se houver. */
export function controleDoCampoDoServidor(field: string): keyof LocalOfertaForm | null {
  return controlNameFromBackendField<keyof LocalOfertaForm>(field, CONTROLES_DO_SERVIDOR);
}

export function comandoDeCriacao(valores: ValoresDoLocal): CriarLocalOfertaCommand {
  const { cidadeCodigoIbge, cidadeNome, cidadeUf, endereco } = enderecoParaCommand(
    valores.endereco,
  );
  return {
    tipo: valores.tipo as TipoLocalOferta,
    codigoEmec: nullIfBlank(valores.codigoEmec),
    campusResponsavelId: nullIfBlank(valores.campusResponsavelId),
    cidadeCodigoIbge,
    cidadeNome,
    cidadeUf,
    endereco,
  };
}

export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDoLocal,
): AtualizarLocalOfertaCommand {
  return { id, ...comandoDeCriacao(valores) };
}
