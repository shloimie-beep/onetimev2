import { createHash } from 'node:crypto';
import type {
  MishnayosMasechtaTaxon,
  MishnayosSederTaxon,
} from '../../../contracts/src/content/vimeo-mishnayos-catalog.ts';

function masechta(canonicalName: string, ...variants: string[]): MishnayosMasechtaTaxon {
  return { canonicalName, variants: [canonicalName, ...variants] };
}

export const MISHNAYOS_TAXONOMY: readonly MishnayosSederTaxon[] = [
  {
    canonicalName: 'Zeraim',
    variants: ['Zeraim', 'Seeds'],
    masechtos: [
      masechta('Berakhot', 'Berachos', 'Brachot', 'Brochos'),
      masechta('Peah', 'Peiah', 'Pei-ah'),
      masechta('Demai'),
      masechta('Kilayim', 'Kilaim'),
      masechta('Sheviit', 'Sheviis', 'Sheviith'),
      masechta('Terumot', 'Terumos'),
      masechta('Maasrot', 'Maasros', 'Maaserot'),
      masechta('Maaser Sheni', 'Maaser Sheini', 'Maaser Sheni'),
      masechta('Challah', 'Challa'),
      masechta('Orlah', 'Orla'),
      masechta('Bikkurim', 'Bikurim'),
    ],
  },
  {
    canonicalName: 'Moed',
    variants: ['Moed', 'Festivals'],
    masechtos: [
      masechta('Shabbat', 'Shabbos', 'Shabbath'),
      masechta('Eruvin', 'Eiruvin', 'Erubin'),
      masechta('Pesachim', 'Pesahim'),
      masechta('Shekalim'),
      masechta('Yoma'),
      masechta('Sukkah', 'Succah', 'Sukka'),
      masechta('Beitzah', 'Beitza', 'Yom Tov'),
      masechta('Rosh Hashanah', 'Rosh Hashana', 'Rosh HaShanah'),
      masechta('Taanit', 'Taanis', 'Taanith'),
      masechta('Megillah', 'Megilla'),
      masechta('Moed Katan', 'Moed Kattan'),
      masechta('Chagigah', 'Hagigah', 'Chagiga'),
    ],
  },
  {
    canonicalName: 'Nashim',
    variants: ['Nashim', 'Women'],
    masechtos: [
      masechta('Yevamot', 'Yevamos', 'Yebamot'),
      masechta('Ketubot', 'Kesubos', 'Ketubos'),
      masechta('Nedarim'),
      masechta('Nazir'),
      masechta('Sotah', 'Sota'),
      masechta('Gittin', 'Gitin'),
      masechta('Kiddushin', 'Kidushin'),
    ],
  },
  {
    canonicalName: 'Nezikin',
    variants: ['Nezikin', 'Damages'],
    masechtos: [
      masechta('Bava Kamma', 'Bava Kama', 'Baba Kamma', 'Baba Kama'),
      masechta('Bava Metzia', 'Bava Metsia', 'Baba Metzia', 'Baba Metsia'),
      masechta('Bava Batra', 'Bava Basra', 'Baba Batra', 'Baba Basra'),
      masechta('Sanhedrin'),
      masechta('Makkot', 'Makkos', 'Makot'),
      masechta('Shevuot', 'Shevuos', 'Shavuot', 'Shavuos'),
      masechta('Eduyot', 'Eduyos', 'Ediyot'),
      masechta('Avodah Zarah', 'Avoda Zara', 'Avodah Zara', 'Avoda Zarah'),
      masechta('Avot', 'Avos', 'Pirkei Avot', 'Pirkei Avos'),
      masechta('Horayot', 'Horiyos', 'Horayos'),
    ],
  },
  {
    canonicalName: 'Kodashim',
    variants: ['Kodashim', 'Kodshim', 'Holy Things'],
    masechtos: [
      masechta('Zevachim', 'Zevahim'),
      masechta('Menachot', 'Menachos', 'Menahot'),
      masechta('Chullin', 'Chulin', 'Hullin'),
      masechta('Bekhorot', 'Bechoros', 'Bekhoros'),
      masechta('Arakhin', 'Arachin', 'Erchin'),
      masechta('Temurah', 'Temura'),
      masechta('Keritot', 'Kerisos', 'Kritot'),
      masechta('Meilah', 'Meila'),
      masechta('Tamid'),
      masechta('Middot', 'Middos', 'Midot'),
      masechta('Kinnim', 'Kinim'),
    ],
  },
  {
    canonicalName: 'Tohorot',
    variants: ['Tohorot', 'Taharot', 'Tahoros', 'Purities'],
    masechtos: [
      masechta('Kelim'),
      masechta('Oholot', 'Ohalot', 'Oholos'),
      masechta('Negaim'),
      masechta('Parah', 'Para'),
      masechta('Tohorot', 'Taharot', 'Tahoros'),
      masechta('Mikvaot', 'Mikvaos', 'Mikvot'),
      masechta('Niddah', 'Nida'),
      masechta('Makhshirin', 'Machshirin'),
      masechta('Zavim'),
      masechta('Tevul Yom', 'Tebul Yom'),
      masechta('Yadayim'),
      masechta('Uktzin', 'Ukzin', 'Okatzin'),
    ],
  },
] as const;

export const MISHNAYOS_MASECHTA_COUNT = MISHNAYOS_TAXONOMY.reduce(
  (count, seder) => count + seder.masechtos.length,
  0,
);

export const MISHNAYOS_TAXONOMY_DIGEST = createHash('sha256')
  .update(JSON.stringify(MISHNAYOS_TAXONOMY))
  .digest('hex');

export function assertCompleteMishnayosTaxonomy() {
  if (MISHNAYOS_TAXONOMY.length !== 6 || MISHNAYOS_MASECHTA_COUNT !== 63) {
    throw new Error('Mishnayos taxonomy must contain six Sedarim and 63 Masechtos.');
  }
  const names = MISHNAYOS_TAXONOMY.flatMap((seder) =>
    seder.masechtos.map((entry) => entry.canonicalName),
  );
  if (new Set(names).size !== 63) {
    throw new Error('Mishnayos taxonomy contains duplicate canonical Masechta names.');
  }
}

assertCompleteMishnayosTaxonomy();
