// Oblast names as written by the pipeline (English) → Ukrainian.
export const OBLAST_UK: Record<string, string> = {
  Vinnytsia: 'Вінницька', Volyn: 'Волинська', Luhansk: 'Луганська', Dnipropetrovsk: 'Дніпропетровська',
  Donetsk: 'Донецька', Zhytomyr: 'Житомирська', Zakarpattia: 'Закарпатська', Zaporizhzhia: 'Запорізька',
  'Ivano-Frankivsk': 'Івано-Франківська', 'Kyiv City': 'м. Київ', Kyiv: 'Київська', Kirovohrad: 'Кіровоградська',
  Sevastopol: 'м. Севастополь', Crimea: 'АР Крим', Lviv: 'Львівська', Mykolaiv: 'Миколаївська', Odesa: 'Одеська',
  Poltava: 'Полтавська', Rivne: 'Рівненська', Sumy: 'Сумська', Ternopil: 'Тернопільська', Kharkiv: 'Харківська',
  Kherson: 'Херсонська', Khmelnytskyi: 'Хмельницька', Cherkasy: 'Черкаська', Chernihiv: 'Чернігівська', Chernivtsi: 'Чернівецька',
}

export const oblastName = (name: string, lang: 'en' | 'uk') =>
  lang === 'uk' ? `${OBLAST_UK[name] ?? name} обл.` : `${name} oblast`
