// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Inline metadata type to avoid 'next' dependency in shared package
interface Metadata {
  title?: string
  description?: string
  alternates?: { canonical?: string }
  openGraph?: Record<string, unknown>
  twitter?: Record<string, unknown>
  robots?: Record<string, unknown>
}

export interface SiteConfig {
  name: string
  url: string
  description: string
  type: 'library' | 'newsroom'
  accentColor: string
  twitterHandle?: string
  logo?: string
}

export interface CategoryDef {
  slug: string
  label: string
  description: string
  h1: string
  parent?: string
}

export interface PostMeta {
  title: string
  slug: string
  date: string
  excerptText: string
  category: string
  image?: string
  tags?: string[]
}

// ---------------------------------------------------------------------------
// JSON-LD Generators (AEO Atomic Blocks)
// ---------------------------------------------------------------------------

export function articleJsonLd(post: PostMeta, site: SiteConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerptText,
    image: post.image ? `${site.url}${post.image}` : undefined,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Organization',
      name: site.name,
      url: site.url,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Simplified Media Network',
      url: 'https://simplified.media',
      logo: {
        '@type': 'ImageObject',
        url: site.logo ?? `${site.url}/images/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${site.url}/${post.slug}`,
    },
    articleSection: post.category,
    keywords: post.tags?.join(', '),
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.atomic-answer', 'h1', '.bp-lead'],
    },
  }
}

export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function categoryJsonLd(
  category: CategoryDef,
  site: SiteConfig,
  posts: PostMeta[],
  image?: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.h1,
    description: category.description,
    url: `${site.url}/${category.slug}`,
    ...(image && { image: `${site.url}${image}` }),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${site.url}/${post.slug}`,
        name: post.title,
      })),
    },
    isPartOf: {
      '@type': 'WebSite',
      name: site.name,
      url: site.url,
    },
  }
}

export function websiteJsonLd(site: SiteConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: site.url,
    description: site.description,
    publisher: {
      '@type': 'Organization',
      name: 'Simplified Media Network',
      url: 'https://simplified.media',
    },
  }
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

// ---------------------------------------------------------------------------
// JSON-LD Script Component
// ---------------------------------------------------------------------------

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// ---------------------------------------------------------------------------
// Metadata Generators
// ---------------------------------------------------------------------------

export function articleMetadata(
  post: PostMeta,
  site: SiteConfig,
): Metadata {
  const url = `${site.url}/${post.slug}`
  const imageUrl = post.image ? `${site.url}${post.image}` : undefined

  return {
    title: `${post.title} | ${site.name}`,
    description: post.excerptText,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerptText,
      url,
      siteName: site.name,
      type: 'article',
      publishedTime: post.date,
      authors: [site.name],
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: post.title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerptText,
      ...(imageUrl && { images: [imageUrl] }),
      ...(site.twitterHandle && { creator: site.twitterHandle }),
    },
    robots: { index: true, follow: true },
  }
}

export function categoryMetadata(
  category: CategoryDef,
  site: SiteConfig,
  image?: string,
): Metadata {
  const url = `${site.url}/${category.slug}`
  const imageUrl = image ? `${site.url}${image}` : (site.logo ? `${site.url}${site.logo}` : undefined)

  return {
    title: `${category.h1} | ${site.name}`,
    description: category.description,
    alternates: { canonical: url },
    openGraph: {
      title: category.h1,
      description: category.description,
      url,
      siteName: site.name,
      type: 'website',
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: category.h1 }],
      }),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: category.h1,
      description: category.description,
      ...(imageUrl && { images: [imageUrl] }),
      ...(site.twitterHandle && { creator: site.twitterHandle }),
    },
    robots: { index: true, follow: true },
  }
}

// ---------------------------------------------------------------------------
// Breadcrumb Component (visual + schema)
// ---------------------------------------------------------------------------

export function Breadcrumbs({
  items,
  accentColor = 'cobalt',
}: {
  items: { label: string; href: string }[]
  accentColor?: 'cobalt' | 'hazard' | 'fallout'
}) {
  const accentMap = {
    cobalt: 'hover:text-cobalt-400',
    hazard: 'hover:text-hazard-400',
    fallout: 'hover:text-fallout-400',
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol
        className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.15em]"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {items.map((item, i) => (
          <li
            key={item.href}
            className="flex items-center gap-1.5"
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            {i > 0 && (
              <span className="text-concrete-500" aria-hidden="true">/</span>
            )}
            {i === items.length - 1 ? (
              <span
                className="text-concrete-300"
                itemProp="name"
                aria-current="page"
              >
                {item.label}
                <meta itemProp="position" content={String(i + 1)} />
              </span>
            ) : (
              <a
                href={item.href}
                className={`text-concrete-400 transition-colors ${accentMap[accentColor]}`}
                itemProp="item"
              >
                <span itemProp="name">{item.label}</span>
                <meta itemProp="position" content={String(i + 1)} />
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
