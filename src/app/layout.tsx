import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Amsterdam Gig Scout", description: "Persoonlijke radar voor live muziek in Amsterdam" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>
    <header className="topbar"><nav className="shell nav"><Link className="brand" href="/">Gig Scout<i>●</i></Link><div className="navlinks"><Link href="/">Radar</Link><Link href="/kalender">Kalender</Link><Link href="/opgeslagen">Opgeslagen</Link><Link href="/instellingen">Smaakprofiel</Link><Link href="/dekking">Dekking</Link></div><Link className="button secondary" href="/configuratie">Configuratie</Link></nav></header>
    <main className="shell">{children}</main>
    <footer className="footer"><div className="shell">Amsterdam Gig Scout · lokale persoonlijke muziekradar · eventdata is nooit gegarandeerd volledig</div></footer>
  </body></html>;
}
