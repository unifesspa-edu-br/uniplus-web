/** A aba que a tecla escolhe: setas andam em círculo, Home e End vão às pontas; outra tecla, nenhuma. */
export function abaPelaTecla(tecla: string, atual: number, total: number): number | null {
  switch (tecla) {
    case 'ArrowRight':
      return (atual + 1) % total;
    case 'ArrowLeft':
      return (atual - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}
