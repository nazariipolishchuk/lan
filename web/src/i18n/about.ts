// Long-form text of the About page (S8, PLAN §5.8), in both languages. Kept apart from en.ts/uk.ts because
// it is prose, not interface strings; every section exists in both languages (checked by about.test.ts).

export interface AboutText {
  title: string
  intro: string
  replay: string
  steps: { h: string; items: [string, string][] }
  data: { h: string; cols: [string, string, string, string]; rows: [string, string, string, string][] }
  accuracy: {
    h: string; lead: string; groupLine: string; cropLine: string; regionsH: string; regionsLead: string
    regionCols: [string, string, string, string]; confusionH: string; confusionNote: string; classes: Record<string, string>
    noRegions: string
  }
  cannot: { h: string; items: string[] }
  ground: { h: string; items: string[] }
  glossary: { h: string; items: [string, string][] }
  agronomist: { h: string; p: string }
  privacy: { h: string; p: string }
  si: { h: string; p: string }
  refs: { h: string; p: string; link: string }
  coverage: { h: string; lead: string; legendHist: string; legendNone: string; total: string }
}

export const ABOUT: Record<'en' | 'uk', AboutText> = {
  en: {
    title: 'About Lan',
    intro: 'Lan turns NASA Earth observations into a crop-rotation plan for a single field. Everything below is measured or sourced; where we do not know something, we say so.',
    replay: 'Replay the intro and the quick guide',
    steps: {
      h: 'How it works, in three steps',
      items: [
        ['1. The field’s past', 'NASA HLS (Landsat + Sentinel-2, 30 m) gives every field a greenness curve for each season 2016–2026. A classifier reads each curve as winter crop, summer crop or not cultivated.'],
        ['2. The district’s climate', 'NASA POWER gives 35 years of daily weather per cell of about 50 km: crop calendars come from the cell’s own temperatures, risks are counted as "x of the last 20 years".'],
        ['3. A transparent plan', 'A rule engine in your browser checks return intervals, predecessors and combos, scores every candidate on water, heat, soil and disease, and shows its reasons. You correct any season and it recalculates.'],
      ],
    },
    data: {
      h: 'Data used',
      cols: ['Data', 'What for', 'Resolution', 'Years'],
      rows: [
        ['NASA HLS Vegetation Indices v2.0', 'Greenness curves, crop history, current state', '30 m, every 2–3 days', '2016–2026'],
        ['NASA POWER (MERRA-2)', 'Rain, temperature, evaporation demand, risks', '0.5° × 0.625° (about 50 km)', '1991–2026'],
        ['NASA NASADEM', 'Slope and elevation', '30 m', '2000 survey'],
        ['Fields of The World', 'Field outlines', 'polygons ≥ 1 ha', '2025'],
        ['KPI / World Bank crop maps', 'Training and checking the history (winter / summer / not cultivated)', '10 m', '2019–2024'],
        ['ISRIC SoilGrids 2.0', 'Clay, sand, organic carbon, pH', '250 m', 'model of 2020'],
        ['Crop type map of Ukraine 2020 (Chen, Tu et al. 2024)', 'Training the crop-name hints in Ukraine (maize, sunflower, rapeseed)', '10 m', '2020'],
        ['USDA Crop Sequence Boundaries', 'Crop history in the USA', 'fields', '2018–2025'],
        ['GeoNames, geoBoundaries', 'Village search, oblast outlines', '—', '2017–2026'],
      ],
    },
    accuracy: {
      h: 'How accurate is the history',
      lead: 'Measured on whole satellite tiles the model never saw during training.',
      groupLine: 'Winter crop / summer crop / not cultivated: {acc} agreement with the KPI crop maps on {n} field-seasons in Cherkasy oblast (held-out tiles {tiles}); macro-F1 {f1}.',
      cropLine: 'Crop names (maize / sunflower / other summer crop, and rapeseed among winter crops) are learned from the 2020 crop type map of Ukraine: {acc} on held-out tiles (macro-F1 {f1}). Trained on a single year, the yearly crop shares swing in drought years such as 2024, so names are shown only as "maybe …" hints and the rules never use them.',
      regionsH: 'Outside Cherkasy',
      regionsLead: 'The model was trained in the Forest-Steppe. The same check on one tile in each of these zones:',
      regionCols: ['Zone', 'Tile', 'Agreement', 'Field-seasons'],
      confusionH: 'Where it is wrong (Cherkasy held-out tiles)',
      confusionNote: 'Rows: the KPI map. Columns: our estimate. "Not cultivated" is the weak class: most fallow fields are read as summer crops.',
      classes: { winter: 'Winter', summer: 'Summer', uncultivated: 'Not cultivated' },
      noRegions: 'The out-of-region check runs with the all-Ukraine build.',
    },
    cannot: {
      h: 'What satellites cannot see',
      items: [
        'Crop names inside a group: winter wheat and winter barley look alike from space; so do many summer crops in some years.',
        'Soil nitrogen, weeds, pests and diseases in the field.',
        'Prices, contracts, machinery and your plans: tell the tool in Priorities.',
        'Seasons with too few cloud-free looks: they are marked "?" and the plan works around the gap.',
        'Fields under 2 ha: too small for 30 m pixels; only climate advice is given.',
      ],
    },
    ground: {
      h: 'Satellite versus ground measurements',
      items: [
        'Weather is a 50 km cell average, not your field’s station: POWER runs about 1.8 °C warmer in July than the Cherkasy station normals, so hot-day counts are likely overstated. Risks compare years within the same series.',
        'Soil is a 250 m model, not a sample from your field. Slope is a 30 m terrain model.',
        'Greenness is light reflected by the canopy; it shows when the crop grew, not the yield.',
      ],
    },
    glossary: {
      h: 'Glossary',
      items: [
        ['Greenness (NDVI)', 'How green the field looks from space, 0 (bare) to about 0.9 (dense crop).'],
        ['Evapotranspiration', 'Water the air takes from soil and plants; with rain it gives the water balance.'],
        ['Soil-moisture anomaly', 'How much wetter or drier the root zone is than usual for the date.'],
        ['Frost risk', 'Years in which the minimum temperature fell below the crop’s limit in its sensitive window.'],
        ['Water balance', 'Rain minus evaporation demand over a window; negative means the crop draws on soil reserves.'],
        ['Growing degree days', 'Warmth accumulated above a base temperature; drives crop development.'],
        ['Predecessor', 'The crop grown on the field the season before.'],
        ['Return interval', 'The minimum number of years before a crop may return to the same field (Resolution No. 164).'],
        ['Cover crop', 'A crop sown between main crops to protect and feed the soil, not for harvest.'],
        ['Confidence', 'How sure the estimate is, 0–1; below 0.6 it is shown as a guess and the rules do not rely on it.'],
      ],
    },
    agronomist: { h: 'It supports, it does not replace, an agronomist', p: 'Lan gives a second opinion grounded in the field’s past and the district’s climate. Check every plan on the ground: soil tests, weeds, local prices and your own experience come first.' },
    privacy: { h: 'Privacy', p: 'Your corrections, priorities and "unsafe" marks are stored only in this browser. The site has no server, no accounts and no analytics; location, if you allow it, is used only to move the map.' },
    si: { h: 'Use of SI', p: 'The team made every product decision. Claude (Anthropic) wrote code, pipeline scripts and drafts under the team’s review; Google Gemini generated the base image of the logo, which carries a visible "SI-assisted" mark.' },
    refs: { h: 'References and licences', p: 'Every dataset, library and text source, with its licence, is listed in the project’s references.', link: 'docs/REFERENCES.md on GitHub' },
    coverage: { h: 'Coverage', lead: 'Crop history is reconstructed where NASA HLS has been processed; elsewhere the card gives climate, soil and terrain.', legendHist: 'fields with history', legendNone: 'not processed', total: '{h} of {n} fields have a crop history' },
  },
  uk: {
    title: 'Про Лан',
    intro: 'Лан перетворює спостереження NASA за Землею на план сівозміни для конкретного поля. Усе нижче виміряно або має джерело; чого ми не знаємо — так і кажемо.',
    replay: 'Показати вступ і путівник ще раз',
    steps: {
      h: 'Як це працює, у три кроки',
      items: [
        ['1. Минуле поля', 'NASA HLS (Landsat + Sentinel-2, 30 м) дає кожному полю криву зеленості за кожен сезон 2016–2026. Класифікатор читає криву як озимі, ярі або «не оброблялось».'],
        ['2. Клімат району', 'NASA POWER дає 35 років щоденної погоди для клітинки близько 50 км: календарі культур — з температур саме цієї клітинки, ризики — «x з останніх 20 років».'],
        ['3. Прозорий план', 'Алгоритм у вашому браузері перевіряє повернення культур, попередники й комбо, оцінює кожен варіант за водою, спекою, ґрунтом і хворобами та показує причини. Ви виправляєте будь-який сезон — і все перераховується.'],
      ],
    },
    data: {
      h: 'Які дані',
      cols: ['Дані', 'Для чого', 'Роздільність', 'Роки'],
      rows: [
        ['NASA HLS Vegetation Indices v2.0', 'Криві зеленості, історія культур, поточний стан', '30 м, кожні 2–3 дні', '2016–2026'],
        ['NASA POWER (MERRA-2)', 'Опади, температура, випаровування, ризики', '0,5° × 0,625° (близько 50 км)', '1991–2026'],
        ['NASA NASADEM', 'Схил і висота', '30 м', 'зйомка 2000 р.'],
        ['Fields of The World', 'Межі полів', 'полігони ≥ 1 га', '2025'],
        ['Карти культур КПІ / Світового банку', 'Навчання й перевірка історії (озимі / ярі / не оброблялось)', '10 м', '2019–2024'],
        ['ISRIC SoilGrids 2.0', 'Глина, пісок, органічний вуглець, pH', '250 м', 'модель 2020 р.'],
        ['Карта культур України 2020 (Chen, Tu et al. 2024)', 'Навчання підказок назв культур в Україні (кукурудза, соняшник, ріпак)', '10 м', '2020'],
        ['USDA Crop Sequence Boundaries', 'Історія культур у США', 'поля', '2018–2025'],
        ['GeoNames, geoBoundaries', 'Пошук сіл, межі областей', '—', '2017–2026'],
      ],
    },
    accuracy: {
      h: 'Наскільки точна історія',
      lead: 'Виміряно на цілих супутникових тайлах, яких модель не бачила під час навчання.',
      groupLine: 'Озимі / ярі / не оброблялось: {acc} збігу з картами культур КПІ на {n} поле-сезонах Черкащини (відкладені тайли {tiles}); macro-F1 {f1}.',
      cropLine: 'Назви культур (кукурудза / соняшник / інша ярова, а серед озимих — ріпак) модель вивчила з карти культур України 2020 року: {acc} на відкладених тайлах (macro-F1 {f1}). Навчена на одному році, вона дає частки культур, що стрибають у посушливі роки, як-от 2024, тому назви показано лише як підказку «можливо …», і правила їх не використовують.',
      regionsH: 'Поза Черкащиною',
      regionsLead: 'Модель навчена в Лісостепу. Та сама перевірка на одному тайлі в кожній із цих зон:',
      regionCols: ['Зона', 'Тайл', 'Збіг', 'Поле-сезонів'],
      confusionH: 'Де помиляється (відкладені тайли Черкащини)',
      confusionNote: 'Рядки — карта КПІ, стовпці — наша оцінка. «Не оброблялось» — слабкий клас: більшість перелогів читається як ярі.',
      classes: { winter: 'Озимі', summer: 'Ярі', uncultivated: 'Не оброблялось' },
      noRegions: 'Перевірка поза регіоном навчання виконується разом зі збиранням усієї України.',
    },
    cannot: {
      h: 'Чого не бачать супутники',
      items: [
        'Назви культур усередині групи: озима пшениця й озимий ячмінь з космосу схожі; у деякі роки — і багато ярих.',
        'Азот у ґрунті, бур’яни, шкідників і хвороби.',
        'Ціни, контракти, техніку і ваші плани — скажіть про них у «Пріоритетах».',
        'Сезони з малою кількістю безхмарних знімків — вони позначені «?», і план обходить прогалину.',
        'Поля менші за 2 га — замалі для пікселів 30 м; для них лише кліматичні поради.',
      ],
    },
    ground: {
      h: 'Супутник проти вимірів на землі',
      items: [
        'Погода — середнє по клітинці 50 км, а не метеостанція вашого поля: у липні POWER на 1,8 °C тепліший за норми станції Черкаси, тож кількість спекотних днів, імовірно, завищена. Ризики порівнюють роки в межах одного ряду.',
        'Ґрунт — модель 250 м, а не проба з вашого поля. Схил — модель рельєфу 30 м.',
        'Зеленість — це світло, відбите посівом; вона показує, коли культура росла, а не врожайність.',
      ],
    },
    glossary: {
      h: 'Словник',
      items: [
        ['Зеленість (NDVI)', 'Наскільки зеленим поле виглядає з космосу: від 0 (голий ґрунт) до близько 0,9 (густий посів).'],
        ['Евапотранспірація', 'Вода, яку повітря забирає з ґрунту й рослин; разом з опадами дає водний баланс.'],
        ['Аномалія вологості ґрунту', 'Наскільки коренева зона вологіша чи сухіша, ніж зазвичай на цю дату.'],
        ['Ризик заморозку', 'Роки, коли мінімальна температура падала нижче межі культури в її чутливий період.'],
        ['Водний баланс', 'Опади мінус випаровування за період; від’ємний — культура бере воду із запасів ґрунту.'],
        ['Сума активних температур', 'Тепло, накопичене понад базову температуру; від нього залежить розвиток культури.'],
        ['Попередник', 'Культура, що росла на полі сезоном раніше.'],
        ['Інтервал повернення', 'Мінімум років, перш ніж культуру можна знову сіяти на тому ж полі (Постанова № 164).'],
        ['Покривна культура', 'Культура між основними — щоб захистити й підживити ґрунт, не для врожаю.'],
        ['Упевненість', 'Наскільки певна оцінка, 0–1; нижче 0,6 вона показана як здогад, і правила на неї не спираються.'],
      ],
    },
    agronomist: { h: 'Допомагає агроному, а не замінює його', p: 'Лан дає друге бачення на основі минулого поля й клімату району. Перевіряйте кожен план на місці: аналізи ґрунту, бур’яни, місцеві ціни й ваш досвід — передусім.' },
    privacy: { h: 'Приватність', p: 'Ваші виправлення, пріоритети й позначки «небезпечно» зберігаються лише в цьому браузері. У сайту немає сервера, акаунтів і аналітики; місцезнаходження, якщо дозволите, лише пересуває карту.' },
    si: { h: 'Використання ШІ', p: 'Кожне рішення щодо продукту ухвалила команда. Claude (Anthropic) писав код, скрипти обробки й чернетки під наглядом команди; Google Gemini створив основу лого, на якому є видима позначка «SI-assisted».' },
    refs: { h: 'Джерела й ліцензії', p: 'Кожен набір даних, бібліотека й текстове джерело з ліцензією — у переліку джерел проєкту.', link: 'docs/REFERENCES.md на GitHub' },
    coverage: { h: 'Покриття', lead: 'Історію культур відновлено там, де оброблено NASA HLS; деінде картка дає клімат, ґрунт і рельєф.', legendHist: 'поля з історією', legendNone: 'не оброблено', total: 'Історія є для {h} з {n} полів' },
  },
}
