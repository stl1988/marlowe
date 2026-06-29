import { useHead } from '@unhead/react';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

/**
 * Injects dynamic <head> tags for Marlowe based on the current route.
 * Uses the nsite deployed URL as the canonical base so OG tags work
 * correctly when shared from the nsite deployment.
 */

const SITE_URL = 'https://47h1rs70oqaspur8bichfzalg0wnassb8d7tslfacl7hwyaxhkmarlowe.nsite.lol';
const SITE_NAME = 'Marlowe';
const DEFAULT_TITLE = 'Marlowe — Open Source AI App Builder';
const DEFAULT_DESCRIPTION = 'Build custom apps through natural language conversation. AI-powered development that runs entirely in your browser.';
const OG_IMAGE = `${SITE_URL}/og-image.webp`;
const ICON_URL = `${SITE_URL}/marlowe.svg`;

interface PageMeta {
  title: string;
  description: string;
  url: string;
}

function getPageMeta(pathname: string): PageMeta {
  const url = `${SITE_URL}${pathname}`;

  if (pathname === '/' || pathname === '/giftcard') {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url,
    };
  }

  if (pathname.startsWith('/project/')) {
    return {
      title: `Project — ${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      url,
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      title: `Settings — ${SITE_NAME}`,
      description: `Configure your ${SITE_NAME} development environment.`,
      url,
    };
  }

  if (pathname === '/changelog') {
    return {
      title: `Changelog — ${SITE_NAME}`,
      description: `See what's new in each release of ${SITE_NAME}.`,
      url,
    };
  }

  if (pathname === '/clone') {
    return {
      title: `Clone Repository — ${SITE_NAME}`,
      description: `Import a Git repository into your ${SITE_NAME} workspace.`,
      url,
    };
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url,
  };
}

export function SiteHead() {
  const { pathname } = useLocation();
  const meta = useMemo(() => getPageMeta(pathname), [pathname]);

  useHead({
    title: meta.title,
    meta: [
      { name: 'description', content: meta.description },
      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: meta.title },
      { property: 'og:description', content: meta.description },
      { property: 'og:url', content: meta.url },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1536' },
      { property: 'og:image:height', content: '1024' },
      { property: 'og:image:type', content: 'image/webp' },
      // Twitter / X Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: meta.title },
      { name: 'twitter:description', content: meta.description },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    link: [
      { rel: 'canonical', href: meta.url },
      { rel: 'icon', type: 'image/svg+xml', href: ICON_URL },
      { rel: 'apple-touch-icon', href: `${SITE_URL}/marlowe-icon.webp` },
    ],
  });

  return null;
}
