import { FormControl, FormGroup, Validators } from '@angular/forms';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';

export function criarFormularioDePerfil() {
  return new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}

export function valoresDoPerfil(perfil: PerfilDto | null) {
  return { nome: perfil?.nome ?? '', descricao: perfil?.descricao ?? '' };
}
