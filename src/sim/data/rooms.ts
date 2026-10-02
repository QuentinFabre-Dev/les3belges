import type { RoomTexture } from '../types';

// Fiches des salles (vue Salle).
export const ROOMS: Record<RoomTexture, { title: string; description: string }> = {
  cafe_main: { title: 'Grand réfectoire', description: 'Le cœur social du silo. Sur l’écran géant, la surface telle que la voient les capteurs. On y mange, on y débat, on y regarde le dehors en silence.' },
  cafe_mid: { title: 'Cafétéria', description: 'Réfectoire des étages intermédiaires. L’écran relais retransmet la vue extérieure.' },
  canteen: { title: 'Cantine', description: 'Longues tables, files d’attente aux heures de repas, c’est là que naissent les rumeurs.' },
  residential: { title: 'Couloir résidentiel', description: 'Portes des logements, recoins où l’on discute, plantes en pot entretenues avec soin.' },
  quarters: { title: 'Logements familiaux', description: 'Deux familles, quelques mètres carrés, des lits superposés et des souvenirs.' },
  school: { title: 'École', description: 'On y apprend à lire, à compter, et le Pacte. Au tableau, des dessins du silo.' },
  bazaar: { title: 'Bazar', description: 'Le marché du silo : troc de vêtements, d’outils, de légumes et de petits objets. Tout ce qui ne passe pas par le dépôt passe par ici.' },
  laundry: { title: 'Blanchisserie', description: 'Lavage des combinaisons, couture et réparation des textiles. Les équipes de salubrité y sont basées.' },
  greenhouse: { title: 'Serre', description: 'Grandes cultures sous lampes : maïs, tomates, haricots.' },
  hydroponics: { title: 'Fermes hydroponiques', description: 'Bacs de culture sous éclairage, irrigation goutte à goutte.' },
  admin: { title: 'Bureaux de l’administration', description: 'Terminaux, archives et registres du silo.' },
  council: { title: 'Salle du conseil', description: 'Les responsables y siègent autour de la grande table, sous la carte du silo.' },
  servers: { title: 'Salle des serveurs', description: 'Les machines de la DSI : capteurs, archives, communications.' },
  security: { title: 'Bureau du shérif', description: 'Casiers des adjoints, registre des arrestations et cellules.' },
  court: { title: 'Tribunal', description: 'Le juge y rend la justice du Pacte, devant les bancs du public.' },
  medical: { title: 'Infirmerie', description: 'Lits, rideaux, armoires à médicaments.' },
  workshop: { title: 'Atelier mécanique', description: 'Tours, établis, pièces détachées : là où l’on répare le silo.' },
  water: { title: 'Station de pompage', description: 'Cuves, pompes et filtres : l’eau de tout le silo passe par ici.' },
  generator: { title: 'Salle de la génératrice', description: 'Le cœur battant du silo. Son grondement familier rassure tous les étages.' },
  depot: { title: 'Dépôt', description: 'Étagères, caisses et fûts : pièces, médicaments et fournitures.' },
  mine: { title: 'Galerie de mine', description: 'Roche brute, étais de bois, wagonnets de minerai de fer.' },
};
