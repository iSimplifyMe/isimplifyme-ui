'use client'

import { motion } from 'framer-motion'
import { analytics } from './analytics'

const sites = [
  {
    name: 'Simplified Media',
    description: 'Creative Studio & Game Development',
    url: 'https://simplified.media',
    color: '#44ff88',
  },
  {
    name: 'Gaming Endsights',
    description: 'Reviews, News & Industry Analysis',
    url: 'https://endsights.com',
    color: '#4a77ff',
  },
  {
    name: 'Adellion',
    description: 'Game Guides, Reviews & Gear Ratings',
    url: 'https://adellion.com',
    color: '#0EA5D6',
  },
]

export function NetworkBanner({ currentSite }: { currentSite: string }) {
  const otherSites = sites.filter(s => s.url !== `https://${currentSite}`)

  return (
    <section className="border-t border-[#E5E5E5] bg-[#FAFAF8] py-12 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px w-6 bg-[#d6d3d1]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#a8a29e]">
            Simplified Media Network
          </span>
          <div className="h-px flex-1 bg-[#E5E5E5]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {otherSites.map((site, i) => (
            <motion.a
              key={site.url}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.networkSiteClick(site.name)}
              className="group flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white p-5 transition-all duration-300 hover:border-[#d6d3d1] hover:shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: site.color }} />
                  <span className="font-[family-name:var(--font-display)] text-base font-bold text-[#1A1A1A] group-hover:text-[#44403c] transition-colors">
                    {site.name}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#78716c]">{site.description}</p>
              </div>
              <span className="text-[#a8a29e] transition-all duration-300 group-hover:text-[#1A1A1A] group-hover:translate-x-1">&rarr;</span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}
