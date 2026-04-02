'use client'

import { motion } from 'framer-motion'

interface RelatedPost {
  title: string
  slug: string
  date: string
  excerptText: string
  image?: string
  category: string
  readingTime: string
}

export function RelatedArticles({
  posts,
  heading = 'Related Articles',
  accentColor = 'cobalt',
}: {
  posts: RelatedPost[]
  heading?: string
  accentColor?: 'cobalt' | 'hazard' | 'fallout'
}) {
  if (posts.length === 0) return null

  const accentMap = {
    cobalt: 'group-hover:text-cobalt-400',
    hazard: 'group-hover:text-hazard-400',
    fallout: 'group-hover:text-fallout-400',
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-6 md:px-12 py-20" aria-label="Related articles">
      <h2 className="mb-10 font-[family-name:var(--font-display)] text-2xl md:text-3xl font-bold tracking-tight text-concrete-50">
        {heading}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post, i) => (
          <motion.div
            key={post.slug}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{
              duration: 0.6,
              delay: i * 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <a href={`/${post.slug}`} className="group block">
              {post.image && (
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl mb-4">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
                  />
                </div>
              )}
              <h3 className={`font-[family-name:var(--font-display)] text-lg font-bold leading-snug text-concrete-50 transition-colors duration-300 ${accentMap[accentColor]}`}>
                {post.title}
              </h3>
              <div className="mt-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-concrete-400">
                <time>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
                <span className="text-concrete-500">&middot;</span>
                <span>{post.readingTime}</span>
              </div>
            </a>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
