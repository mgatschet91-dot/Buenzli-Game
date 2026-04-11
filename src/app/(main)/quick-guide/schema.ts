const BASE = 'https://buenzlifight.ch';

export function breadcrumbSchema(items: { name: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${BASE}${item.href}`,
    })),
  };
}

export function articleSchema(opts: { title: string; description: string; slug: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    url: `${BASE}${opts.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'BünzliFight',
      url: BASE,
    },
    inLanguage: 'de-CH',
  };
}

export function itemListSchema(items: { name: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'BünzliFight Handbuch – Kapitelübersicht',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: `${BASE}${item.href}`,
    })),
  };
}
