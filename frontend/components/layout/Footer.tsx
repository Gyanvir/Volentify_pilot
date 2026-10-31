import Link from 'next/link';

const COLUMNS = [
  { title: 'Operations', links: [
    { href: '/map', label: 'Tactical map' }, { href: '/disasters', label: 'Active incidents' },
    { href: '/alerts', label: 'Alerts' }, { href: '/predictions', label: 'Forecasts' },
    { href: '/disaster-intelligence', label: 'Satellite & bulletins' }, { href: '/analytics', label: 'Analytics' },
  ] },
  { title: 'Response network', links: [
    { href: '/mesh', label: 'Volentify Mesh app' }, { href: '/volunteer', label: 'Volunteer dispatch' }, { href: '/agency', label: 'Command hub' },
    { href: '/ngo-partners', label: 'NGO partners' }, { href: '/government', label: 'Government agencies' },
    { href: '/resources', label: 'Hospitals & shelters' },
  ] },
  { title: 'Volentify', links: [
    { href: '/about', label: 'About' }, { href: '/research', label: 'Research' }, { href: '/knowledge', label: 'Preparedness' },
    { href: '/news', label: 'Situation reports' }, { href: '/faqs', label: 'Questions' }, { href: '/contact', label: 'Report an incident' },
  ] },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="page grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <p className="font-serif text-3xl text-ivory">Volentify</p>
          <p className="max-w-xs text-sm leading-relaxed text-stone">
            Disaster intelligence and volunteer coordination for India — built to keep working when the network does not.
          </p>
          <div className="space-y-1 pt-2 text-sm">
            <p className="text-sand">In an emergency, call <a href="tel:112" className="link">112</a></p>
            <p className="text-stone">Ambulance <a href="tel:108" className="link">108</a> · NDMA <a href="tel:1078" className="link">1078</a></p>
          </div>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="mb-4 text-sm text-ivory">{c.title}</p>
            <ul className="space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-stone transition-colors hover:text-ivory">{l.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="page flex flex-col gap-2 py-6 text-xs text-ash sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Volentify Humanitarian Technologies · MIT licence</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-sand">Privacy</Link>
            <Link href="/terms" className="hover:text-sand">Terms</Link>
            <a href="https://github.com/thehimanshubansal/Volentify" className="hover:text-sand">Source</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
