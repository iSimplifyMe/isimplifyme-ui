'use client'

import { motion } from 'framer-motion'
import { fadeUp } from './theme'
import { ControlPanelFooter } from './control-panel-footer'

interface ArticleLayoutProps {
  title: string
  date: string
  category: string
  content: string
  backHref: string
  backLabel: string
  activeSite?: 'studio' | 'endsights' | 'adellion'
}

export function ArticleLayout({
  title,
  date,
  category,
  content,
  backHref,
  backLabel,
  activeSite = 'endsights',
}: ArticleLayoutProps) {
  return (
    <>
      <article className="relative min-h-screen bg-concrete-950 py-24">
        <div className="mx-auto max-w-3xl px-6">
          {/* Back button */}
          <a
            href={backHref}
            className="group mb-16 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-concrete-400 transition-colors duration-300 hover:text-concrete-50"
          >
            <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">
              &larr;
            </span>
            {backLabel}
          </a>

          {/* Title */}
          <motion.h1
            className="text-4xl font-bold tracking-tight text-concrete-50 md:text-5xl lg:text-6xl"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {title}
          </motion.h1>

          {/* Meta row */}
          <motion.div
            className="mt-8 flex flex-wrap items-center gap-4"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            <time className="font-mono text-sm text-concrete-400">{date}</time>
            <span className="rounded-full border border-fallout-500/40 px-3 py-0.5 font-mono text-xs uppercase tracking-wider text-fallout-400">
              {category}
            </span>
          </motion.div>

          {/* Gradient divider */}
          <div className="mt-10 h-px bg-gradient-to-r from-fallout-500/60 to-transparent" />

          {/* Article content */}
          <motion.div
            className={[
              'prose prose-invert prose-lg mt-12 max-w-none',
              // Heading overrides
              'prose-headings:font-bold prose-headings:tracking-tight',
              "prose-headings:[font-family:'Space_Grotesk',sans-serif]",
              // Link overrides
              'prose-a:text-fallout-400 prose-a:underline-offset-4 prose-a:decoration-fallout-500/40',
              'prose-a:transition-colors prose-a:duration-300 hover:prose-a:text-fallout-300',
              // Paragraph & list color
              'prose-p:text-concrete-300 prose-li:text-concrete-300',
              // Blockquote
              'prose-blockquote:border-l-fallout-500/50 prose-blockquote:text-concrete-400',
              // Code
              'prose-code:text-fallout-300 prose-code:font-mono',
              // Strong
              'prose-strong:text-concrete-100',
              // Image
              'prose-img:rounded-xl prose-img:border prose-img:border-concrete-700/60',
              // HR
              'prose-hr:border-concrete-800',
            ].join(' ')}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </article>

      <ControlPanelFooter activeSite={activeSite} />
    </>
  )
}
