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

/** US state FIPS → name (the USA build uses the state where Ukraine uses the oblast). */
export const US_STATES: Record<string, string> = {
  '01': 'Alabama', '04': 'Arizona', '05': 'Arkansas', '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan',
  '27': 'Minnesota', '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire',
  '34': 'New Jersey', '35': 'New Mexico', '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma',
  '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee',
  '48': 'Texas', '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
}
const STATE_NAMES = new Set(Object.values(US_STATES))

export const oblastName = (name: string, lang: 'en' | 'uk') =>
  STATE_NAMES.has(name) ? (lang === 'uk' ? `штат ${name}` : name)
    : NOT_OBLAST.has(name) ? (lang === 'uk' ? OBLAST_UK[name] ?? name : name)
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
