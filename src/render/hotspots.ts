// Points d'intérêt de chaque salle (abscisses dans le repère de l'aile gauche, 0-256),
// mesurés sur les images : bancs, comptoirs, portes, lits, étals, pupitres, écran.

export interface RoomSpots {
  seats?: number[]; // s'asseoir (bancs, chaises, canapé)
  queue?: { head: number; dir: 1 | -1 }; // file d'attente au comptoir (dir : sens du regard)
  doors?: number[]; // rentrer chez soi
  beds?: number[];
  stalls?: number[]; // étals du bazar
  desks?: number[]; // pupitres d'élèves
  lectern?: number; // place de l'enseignant·e / du juge
  screen?: number; // centre de l'écran extérieur
}

export const SPOTS: Record<string, RoomSpots> = {
  canteen: { seats: [18, 34, 50, 104, 120, 136, 150, 204, 220, 238], queue: { head: 198, dir: 1 } },
  cafe_main: { seats: [16, 30, 46, 70, 86, 104, 150, 166, 184], queue: { head: 238, dir: 1 }, screen: 129 },
  cafe_mid: { seats: [14, 30, 48, 70, 88, 106, 150, 166, 186], queue: { head: 206, dir: 1 }, screen: 136 },
  residential: { doors: [70, 122, 199, 239], seats: [148, 160, 172] },
  quarters: { beds: [18, 34, 52, 66, 192, 208, 226, 244], seats: [82, 96, 160, 178] },
  school: { desks: [12, 28, 46, 60, 84, 98, 158, 172, 196, 212, 230, 246], lectern: 128 },
  medical: { beds: [72, 96, 112, 168, 196, 226] },
  council: { seats: [53, 75, 98, 125, 153, 180, 202] },
  court: { seats: [22, 36, 50, 64, 80, 94], desks: [118, 136], lectern: 205 },
  bazaar: { stalls: [26, 95, 163, 228] },
};
