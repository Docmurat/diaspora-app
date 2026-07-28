export type FavoriteUser = {
  id: string;
  name: string;
  category?: string;
  profession: string;
  city: string;
  country?: string;
  birthDate?: string;
  telegram?: string;
  bio?: string;
  extraInfo?: string;
  avatarUri?: string;
};

let favorites: FavoriteUser[] = [];

export function getFavorites(): FavoriteUser[] {
  return favorites;
}

export function addFavorite(user: FavoriteUser): void {
  const exists = favorites.some((item) => item.id === user.id);

  if (!exists) {
    favorites.push(user);
  }
}

export function removeFavorite(userId: string): void {
  favorites = favorites.filter((item) => item.id !== userId);
}

export function isFavorite(userId: string): boolean {
  return favorites.some((item) => item.id === userId);
}