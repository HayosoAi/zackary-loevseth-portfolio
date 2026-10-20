const header = document.querySelector('[data-site-header]');
const year = document.querySelector('[data-year]');
const revealItems = document.querySelectorAll('[data-reveal]');
const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];

if (year) {
  year.textContent = String(new Date().getFullYear());
}

const updateHeader = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 24);
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

const trackedSections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window && trackedSections.length) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      navLinks.forEach((link) => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    },
    { rootMargin: '-24% 0px -64% 0px', threshold: [0, 0.15, 0.35] },
  );

  trackedSections.forEach((section) => sectionObserver.observe(section));
}

document.querySelectorAll('details').forEach((details) => {
  const summary = details.querySelector('summary');
  if (!summary) return;

  const syncExpandedState = () => {
    summary.setAttribute('aria-expanded', String(details.open));
  };

  syncExpandedState();
  details.addEventListener('toggle', syncExpandedState);
});
