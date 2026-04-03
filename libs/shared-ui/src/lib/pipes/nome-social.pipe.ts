import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'nomeSocial',
  standalone: true,
})
export class NomeSocialPipe implements PipeTransform {
  transform(nomeCivil: string, nomeSocial?: string | null): string {
    return nomeSocial?.trim() || nomeCivil;
  }
}
