// Direct-booking rates (EUR per night). Single place to edit prices.
// ponytail: flat table with sample prices (Trip.com shows "da 58 €"), confirm with Carlo; swap for a booking engine when it goes live.
export const APARTMENTS = {
  bilocale: { name: 'Bilocale', base: 70, baseGuests: 2, extra: 15, maxGuests: 4 },
  superior: { name: 'Superior', base: 95, baseGuests: 4, extra: 15, maxGuests: 6 },
};
export const MIN_NIGHTS = 1;

const DAY = 86400000;
const toUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

export const nightly = (apt, guests) => apt.base + Math.max(0, guests - apt.baseGuests) * apt.extra;

// quote('bilocale', '2026-11-12', '2026-11-14', 3) -> { nights: 2, perNight: 85, total: 170 } or { error }
export function quote(id, checkin, checkout, guests = 2) {
  const apt = APARTMENTS[id];
  if (!apt) return { error: 'Scegli l’appartamento' };
  if (!checkin || !checkout) return { error: 'Scegli le date' };
  const nights = Math.round((toUTC(checkout) - toUTC(checkin)) / DAY);
  if (!(nights >= MIN_NIGHTS)) return { error: 'La partenza deve essere dopo l’arrivo' };
  if (guests < 1 || guests > apt.maxGuests) return { error: `Il ${apt.name} ospita fino a ${apt.maxGuests} persone` };
  const perNight = nightly(apt, guests);
  return { nights, perNight, total: perNight * nights };
}
