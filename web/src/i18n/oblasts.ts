// Oblast names as written by the pipeline (English) → Ukrainian.
export const OBLAST_UK: Record<string, string> = {
  Vinnytsia: 'Вінницька', Volyn: 'Волинська', Luhansk: 'Луганська', Dnipropetrovsk: 'Дніпропетровська',
  Donetsk: 'Донецька', Zhytomyr: 'Житомирська', Zakarpattia: 'Закарпатська', Zaporizhzhia: 'Запорізька',
  'Ivano-Frankivsk': 'Івано-Франківська', 'Kyiv City': 'м. Київ', Kyiv: 'Київська', Kirovohrad: 'Кіровоградська',
  Sevastopol: 'м. Севастополь', Crimea: 'АР Крим', Lviv: 'Львівська', Mykolaiv: 'Миколаївська', Odesa: 'Одеська',
  Poltava: 'Полтавська', Rivne: 'Рівненська', Sumy: 'Сумська', Ternopil: 'Тернопільська', Kharkiv: 'Харківська',
  Kherson: 'Херсонська', Khmelnytskyi: 'Хмельницька', Cherkasy: 'Черкаська', Chernihiv: 'Чернігівська', Chernivtsi: 'Чернівецька',
}

const NOT_OBLAST = new Set(['Kyiv City', 'Sevastopol', 'Crimea'])

export const oblastName = (name: string, lang: 'en' | 'uk') =>
  NOT_OBLAST.has(name) ? (lang === 'uk' ? OBLAST_UK[name] ?? name : name)
    : lang === 'uk' ? `${OBLAST_UK[name] ?? name} обл.` : `${name} oblast`

/** ISO 3166-2:UA code → the pipeline's English oblast name (pipeline/src/lan/fields.py OBLASTS). */
export const OBLAST_BY_CODE: Record<string, string> = {
  '05': 'Vinnytsia', '07': 'Volyn', '09': 'Luhansk', '12': 'Dnipropetrovsk', '14': 'Donetsk',
  '18': 'Zhytomyr', '21': 'Zakarpattia', '23': 'Zaporizhzhia', '26': 'Ivano-Frankivsk',
  '30': 'Kyiv City', '32': 'Kyiv', '35': 'Kirovohrad', '40': 'Sevastopol', '43': 'Crimea',
  '46': 'Lviv', '48': 'Mykolaiv', '51': 'Odesa', '53': 'Poltava', '56': 'Rivne', '59': 'Sumy',
  '61': 'Ternopil', '63': 'Kharkiv', '65': 'Kherson', '68': 'Khmelnytskyi', '71': 'Cherkasy',
  '74': 'Chernihiv', '77': 'Chernivtsi',
}
