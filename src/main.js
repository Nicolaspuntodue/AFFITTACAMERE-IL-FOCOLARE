import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { APARTMENTS, quote } from './booking.js';

gsap.registerPlugin(ScrollTrigger);
// mobile URL bar show/hide must not re-layout pins mid-scroll
ScrollTrigger.config({ ignoreMobileResize: true });

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- smooth scroll (gentle: the client prefers a calm page) ---------- */
let lenis;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = $(a.getAttribute('href'));
    if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: a.getAttribute('href') === '#top' ? 0 : -70 }); }
  }));
}

/* ---------- WebGL hero: started once the page has loaded and the main thread is idle, so it never delays first paint ---------- */
let gl = null;
const portraitHero = matchMedia('(max-aspect-ratio: 9/10)').matches; // same query as the <picture> and preloads
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
const afterLoad = (fn) => (document.readyState === 'complete' ? idle(fn) : addEventListener('load', () => idle(fn), { once: true }));
if (!reduced) {
  afterLoad(() => import('./gl.js').then(({ initHero }) => {
    gl = initHero($('.hero__gl'), portraitHero ? {
      src: '/media/hero-port.webp', mask: '/media/hero-mask-port.webp',
      chimney: [0.262, 0.452],           // top of the chimney in the left-half crop, texture uv (y up)
      focus: { wide: 0.5, narrow: 0.3 },
    } : {
      src: '/media/hero.webp', mask: '/media/hero-mask.webp',
      chimney: [0.131, 0.452],
      focus: { wide: 0.5, narrow: 0.21 }, // narrow windows keep the chimney and the valley in frame
    });
    const st = ScrollTrigger.getById('hero');
    if (st) gl.setProgress(st.progress); // the visitor may already have scrolled
    return gl.ready.then(() => document.documentElement.classList.add('has-gl'));
  }).catch((err) => console.warn('WebGL unavailable, using the photo', err)));
}

/* ---------- first screen entrance ---------- */
if (!reduced) {
  gsap.from('.hero__title, .hero__aside > *, .nav', {
    y: 24, opacity: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out', delay: 0.15,
  });
}

/* ---------- hero scroll: afternoon becomes evening ---------- */
const nav = $('.nav');
const evening = $('.hero__copy--evening');
if (!reduced) {
  gsap.timeline({
    scrollTrigger: {
      id: 'hero', trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: (st) => {
        gl?.setProgress(st.progress);
        evening.setAttribute('aria-hidden', st.progress < 0.6);
      },
    },
  })
    .to('.hero__copy[data-phase="day"]', { autoAlpha: 0, y: -30, duration: 0.25, ease: 'none' }, 0.12)
    .fromTo(evening, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'none' }, 0.55)
    .to({}, { duration: 0.2 });
}
// nav turns into a plain light bar once the hero has gone
ScrollTrigger.create({
  trigger: '.hero', start: 'bottom 70px',
  onEnter: () => nav.classList.add('is-solid'), onLeaveBack: () => nav.classList.remove('is-solid'),
});

/* ---------- section entrances: heading, then text, then picture ---------- */
if (!reduced) {
  const rise = (targets, trigger, extra = {}) => gsap.from(targets, {
    y: 28, opacity: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out',
    scrollTrigger: { trigger, start: 'top 82%' }, ...extra,
  });
  rise('.case__title', '.case__title');
  $$('.apt').forEach((a) => {
    rise($$('.apt__text > *', a), a);
    $$('figure', a).forEach((f) => {
      rise(f, f, { y: 40 });
      gsap.fromTo($('img', f), { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: f, scrub: true } });
    });
  });
  rise('.casa__statement > *', '.casa');
  $$('.casa__ph').forEach((f) => rise(f, f, { y: 40 }));
  rise('.included > *', '.included');
  rise('#dettagli .head', '#dettagli .head');
  rise('.band__panel', '.band', { y: 60 });
  rise('.dintorni__title', '.dintorni__title');
  rise('.places tr', '.places', { y: 16, stagger: 0.05 });
  rise('.dintorni__photo, .umbria figure', '.dintorni__grid', { y: 40, stagger: 0.12 });
  rise('.ospiti__photo, .ospiti blockquote, .scores li, .ospiti__small', '.ospiti');
  rise('.prenota__intro > *, .book', '.prenota');
  rise('.chiama__text, .chiama .btn', '.chiama');
  rise('.footer__menu a', '.footer', { x: -20, y: 0, stagger: 0.06 });
}

/* ---------- footer: the fire photographs slowly crossfade ---------- */
{
  const box = $('.footer__photo');
  const imgs = $$('img', box);
  let i = 0, timer = 0;
  const step = () => { imgs[i].classList.remove('is-on'); i = (i + 1) % imgs.length; imgs[i].classList.add('is-on'); };
  if (!reduced && imgs.length > 1) {
    imgs[0].classList.add('is-on');
    box.classList.add('is-cycling');
    new IntersectionObserver(([en]) => {
      clearInterval(timer);
      if (en.isIntersecting) timer = setInterval(() => { if (!document.hidden) step(); }, 5500);
    }).observe(box);
  }
}

/* ---------- direct booking: pick dates and guests, see the apartment and the price ---------- */
{
  const form = $('.book');
  const out = (k) => $(`[data-out="${k}"]`, form);
  const eur = (n) => `${n.toLocaleString('it-IT')} €`;
  // dates stay as YYYY-MM-DD strings; "today" is the visitor's local day, not UTC
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nextDay = (s) => new Date(Date.parse(s) + 86400000).toISOString().slice(0, 10);
  const { checkin, checkout, guests } = form.elements;
  const apt = () => form.elements.apt.value;
  checkin.min = today;
  checkout.min = nextDay(today);

  const update = (e) => {
    if (checkin.value) {
      checkout.min = nextDay(checkin.value);
      if (checkout.value && checkout.value <= checkin.value) checkout.value = '';
    }
    // more than 4 guests only fit the Superior: switch for them instead of showing an error
    const g = +guests.value;
    if (e?.target === guests) out('hint').textContent = '';
    if (e?.target === guests && g > APARTMENTS.bilocale.maxGuests && apt() === 'bilocale') {
      form.elements.apt.value = 'superior';
      out('hint').textContent = `Per ${g} persone vi proponiamo il Superior.`;
    }
    const q = quote(apt(), checkin.value, checkout.value, g);
    if (q.error) {
      out('line').textContent = checkin.value && checkout.value ? q.error : 'Scegliete le date';
      out('total').textContent = '—';
      return q;
    }
    out('line').textContent = `${APARTMENTS[apt()].name} · ${eur(q.perNight)} × ${q.nights} ${q.nights === 1 ? 'notte' : 'notti'}`;
    out('total').textContent = eur(q.total);
    out('error').textContent = '';
    return q;
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = update();
    const f = form.elements;
    const err = q.error || (!f.name.value.trim() && 'Inserite nome e cognome') || (!f.contact.value.trim() && 'Lasciate un telefono o un’email');
    if (err) { out('error').textContent = err; return; }
    // ponytail: demo only, nothing is sent. Wire to email / Stripe checkout before launch.
    out('done').textContent = `${f.name.value.trim().split(' ')[0]}, abbiamo ricevuto la richiesta per il ${APARTMENTS[apt()].name}, ${q.nights} ${q.nights === 1 ? 'notte' : 'notti'} (${eur(q.total)}). Carlo vi ricontatta a breve per confermare.`;
    $('[data-step="form"]', form).hidden = true;
    $('[data-step="done"]', form).hidden = false;
  });
  $('[data-action="reset"]', form).addEventListener('click', () => {
    form.reset(); out('hint').textContent = ''; update();
    $('[data-step="form"]', form).hidden = false;
    $('[data-step="done"]', form).hidden = true;
  });
}

/* ---------- current section in the nav ---------- */
$$('.nav__links a').forEach((a) => ScrollTrigger.create({
  trigger: a.getAttribute('href'), start: 'top 50%', end: 'bottom 50%',
  onToggle: (st) => a.classList.toggle('is-current', st.isActive),
}));

document.fonts.ready.then(() => ScrollTrigger.refresh());
