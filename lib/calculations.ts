// Berekeningen voor babykrant gegevens

export function getSterrenbeeld(datum: string): string {
  if (!datum) return '-'
  
  const date = new Date(datum)
  const dag = date.getDate()
  const maand = date.getMonth() + 1 // 0-indexed
  
  if ((maand === 3 && dag >= 21) || (maand === 4 && dag <= 19)) return 'Ram'
  if ((maand === 4 && dag >= 20) || (maand === 5 && dag <= 20)) return 'Stier'
  if ((maand === 5 && dag >= 21) || (maand === 6 && dag <= 20)) return 'Tweelingen'
  if ((maand === 6 && dag >= 21) || (maand === 7 && dag <= 22)) return 'Kreeft'
  if ((maand === 7 && dag >= 23) || (maand === 8 && dag <= 22)) return 'Leeuw'
  if ((maand === 8 && dag >= 23) || (maand === 9 && dag <= 22)) return 'Maagd'
  if ((maand === 9 && dag >= 23) || (maand === 10 && dag <= 22)) return 'Weegschaal'
  if ((maand === 10 && dag >= 23) || (maand === 11 && dag <= 21)) return 'Schorpioen'
  if ((maand === 11 && dag >= 22) || (maand === 12 && dag <= 21)) return 'Boogschutter'
  if ((maand === 12 && dag >= 22) || (maand === 1 && dag <= 19)) return 'Steenbok'
  if ((maand === 1 && dag >= 20) || (maand === 2 && dag <= 18)) return 'Waterman'
  if ((maand === 2 && dag >= 19) || (maand === 3 && dag <= 20)) return 'Vissen'
  
  return '-'
}

export function getChineesJaar(datum: string): string {
  if (!datum) return '-'
  
  const jaar = new Date(datum).getFullYear()
  const dieren = ['Aap', 'Haan', 'Hond', 'Varken', 'Rat', 'Os', 'Tijger', 'Konijn', 'Draak', 'Slang', 'Paard', 'Geit']
  const index = jaar % 12
  
  return dieren[index]
}

export function getGeboortebloem(datum: string): string {
  if (!datum) return '-'
  
  const maand = new Date(datum).getMonth() + 1
  const bloemen = [
    'Sneeuwklokje', // januari
    'Viooltje', // februari
    'Narcis', // maart
    'Madeliefje', // april
    'Lelietje-van-dalen', // mei
    'Roos', // juni
    'Waterlelie', // juli
    'Gladiool', // augustus
    'Aster', // september
    'Calendula', // oktober
    'Chrysant', // november
    'Hulst' // december
  ]
  
  return bloemen[maand - 1] || '-'
}

export function getGeboortesteen(datum: string): string {
  if (!datum) return '-'
  
  const maand = new Date(datum).getMonth() + 1
  const stenen = [
    'Granaat', // januari
    'Amethist', // februari
    'Aquamarijn', // maart
    'Diamant', // april
    'Smaragd', // mei
    'Parel', // juni
    'Robijn', // juli
    'Peridoot', // augustus
    'Saffier', // september
    'Opaal', // oktober
    'Topaas', // november
    'Turkoois' // december
  ]
  
  return stenen[maand - 1] || '-'
}

export function getKleur(datum: string): string {
  if (!datum) return '-'
  
  const maand = new Date(datum).getMonth() + 1
  const kleuren = [
    'Donkerblauw', 'Paars', 'Lichtblauw', 'Geel',
    'Groen', 'Roze', 'Rood', 'Oranje',
    'Donkergroen', 'Blauw', 'Goud', 'Zilver'
  ]
  
  return kleuren[maand - 1] || '-'
}