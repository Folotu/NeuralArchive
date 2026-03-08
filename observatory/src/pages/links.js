import React from 'react';
import Layout from '@theme/Layout';
import LinkPreview from '../components/LinkPreview';
import categorizedLinksData from '../categorized_links.json';
import styles from './links.module.css';

const allLinksRaw = categorizedLinksData.links || [];
const facetIndex = categorizedLinksData.facetIndex || {};

// Facet group definitions
const FACET_GROUPS = [
  { key: 'resourceType', label: 'Type', multi: false },
  { key: 'researchAreas', label: 'Research Areas', multi: true },
  { key: 'topics', label: 'Topics', multi: true, limit: 15 },
  { key: 'sourcePlatform', label: 'Platform', multi: false },
];

// Format label for display
function formatLabel(s) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function Links() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showPendingPanel, setShowPendingPanel] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState({});
  const [collapsedGroups, setCollapsedGroups] = React.useState({});
  const [deletedLinks, setDeletedLinks] = React.useState(() => {
    try {
      const stored = localStorage.getItem('deletedLinks');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const mainContentRef = React.useRef(null);

  // Force dark mode
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.style.backgroundColor = '#181a1b';
    document.body.classList.add('links-page');
    return () => document.body.classList.remove('links-page');
  }, []);

  // Persist deletions
  React.useEffect(() => {
    try {
      localStorage.setItem('deletedLinks', JSON.stringify([...deletedLinks]));
    } catch {}
  }, [deletedLinks]);

  // Delete handlers
  const handleDeleteLink = React.useCallback((url) => {
    setDeletedLinks(prev => { const next = new Set(prev); next.add(url); return next; });
  }, []);
  const handleUndoDelete = React.useCallback((url) => {
    setDeletedLinks(prev => { const next = new Set(prev); next.delete(url); return next; });
  }, []);
  const handleClearAllDeletions = React.useCallback(() => setDeletedLinks(new Set()), []);
  const handleCopyDeletions = React.useCallback(async () => {
    const json = JSON.stringify([...deletedLinks], null, 2);
    try { await navigator.clipboard.writeText(json); }
    catch { window.prompt('Copy this JSON:', json); }
  }, [deletedLinks]);

  // All links minus deleted
  const allLinks = React.useMemo(() =>
    allLinksRaw.filter(item => !deletedLinks.has(item.link)),
    [deletedLinks]
  );

  // Check if a link matches a facet filter value
  const linkMatchesFacet = React.useCallback((link, facetKey, values) => {
    if (!values || values.length === 0) return true;
    const facetVal = link.facets[facetKey];
    if (Array.isArray(facetVal)) {
      // Multi-label: OR — link matches if any of its labels are in the filter
      return values.some(v => facetVal.includes(v));
    }
    // Single-label
    return values.includes(facetVal);
  }, []);

  // Filtered links: AND across facet groups, OR within
  const filteredLinks = React.useMemo(() => {
    let results = allLinks;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter(item =>
        item.link.toLowerCase().includes(q) ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.content || '').toLowerCase().includes(q) ||
        (item.facets.topics || []).some(t => t.includes(q)) ||
        (item.facets.researchAreas || []).some(a => a.includes(q)) ||
        (item.facets.resourceType || '').includes(q)
      );
    }

    // Apply facet filters (AND across groups)
    for (const [facetKey, values] of Object.entries(activeFilters)) {
      if (values && values.length > 0) {
        results = results.filter(item => linkMatchesFacet(item, facetKey, values));
      }
    }

    return results;
  }, [searchQuery, allLinks, activeFilters, linkMatchesFacet]);

  // Dynamic facet counts based on current filtered set
  const dynamicCounts = React.useMemo(() => {
    const counts = {};
    for (const group of FACET_GROUPS) {
      counts[group.key] = {};
      for (const item of filteredLinks) {
        const val = item.facets[group.key];
        if (Array.isArray(val)) {
          for (const v of val) {
            counts[group.key][v] = (counts[group.key][v] || 0) + 1;
          }
        } else if (val) {
          counts[group.key][val] = (counts[group.key][val] || 0) + 1;
        }
      }
    }
    return counts;
  }, [filteredLinks]);

  // Has any filter active?
  const hasFilters = Object.values(activeFilters).some(v => v && v.length > 0);

  const toggleFacetValue = (facetKey, value, isMulti) => {
    setActiveFilters(prev => {
      const current = prev[facetKey] || [];
      if (isMulti) {
        // Toggle value in/out of array
        const next = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value];
        return { ...prev, [facetKey]: next };
      } else {
        // Single-select: toggle on/off
        const next = current.includes(value) ? [] : [value];
        return { ...prev, [facetKey]: next };
      }
    });
    setSearchQuery('');
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
  };

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollToTop = () => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    scrollToTop();
  };

  // Build title from active filters
  const pageTitle = React.useMemo(() => {
    if (searchQuery) return `Search Results for "${searchQuery}"`;
    const parts = [];
    for (const [key, values] of Object.entries(activeFilters)) {
      if (values && values.length > 0) {
        parts.push(values.map(formatLabel).join(' / '));
      }
    }
    return parts.length > 0 ? parts.join(' + ') : null;
  }, [searchQuery, activeFilters]);

  return (
    <Layout title="Research Links" description="Faceted Research Links">
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search links, topics, areas..."
          value={searchQuery}
          onChange={handleSearch}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>Filters</h2>
            {hasFilters && (
              <button className={styles.clearFilters} onClick={clearAllFilters}>
                Clear all
              </button>
            )}
          </div>

          {FACET_GROUPS.map(group => {
            const counts = facetIndex[group.key] || {};
            const entries = Object.entries(counts);
            const limited = group.limit ? entries.slice(0, group.limit) : entries;
            const isCollapsed = collapsedGroups[group.key];
            const selected = activeFilters[group.key] || [];

            return (
              <div key={group.key} className={styles.facetGroup}>
                <button
                  className={styles.facetGroupHeader}
                  onClick={() => toggleGroup(group.key)}
                >
                  <span>{group.label}</span>
                  <span className={styles.chevron}>{isCollapsed ? '+' : '-'}</span>
                </button>
                {!isCollapsed && (
                  <ul className={styles.facetList}>
                    {limited.map(([value, count]) => {
                      const isActive = selected.includes(value);
                      const dynCount = dynamicCounts[group.key]?.[value] || 0;
                      return (
                        <li
                          key={value}
                          className={`${styles.facetItem} ${isActive ? styles.facetActive : ''}`}
                          onClick={() => toggleFacetValue(group.key, value, group.multi)}
                        >
                          <span className={styles.facetLabel}>{formatLabel(value)}</span>
                          <span className={styles.facetCount}>
                            {hasFilters ? dynCount : count}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <main ref={mainContentRef} className={styles.main}>
          {(searchQuery || hasFilters) ? (
            <>
              <div className={styles.resultsHeader}>
                <h1 className={styles.categoryTitle}>
                  {pageTitle || 'All Links'}
                </h1>
                <span className={styles.resultCount}>{filteredLinks.length} links</span>
              </div>
              <div className={styles.linkGrid}>
                {filteredLinks.map((item, index) => (
                  <div key={`${item.link}-${index}`} className={styles.linkCard}>
                    <LinkPreview
                      link={item.link}
                      content={item.content}
                      timestamp={item.timestamp}
                      onDelete={handleDeleteLink}
                    />
                    {item.facets.topics && item.facets.topics.length > 0 && (
                      <div className={styles.topicChips}>
                        <span className={styles.typeChip}>
                          {formatLabel(item.facets.resourceType)}
                        </span>
                        {item.facets.topics.slice(0, 4).map(topic => (
                          <span
                            key={topic}
                            className={styles.topicChip}
                            onClick={() => toggleFacetValue('topics', topic, true)}
                          >
                            {formatLabel(topic)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {filteredLinks.length === 0 && (
                <p className={styles.noResults}>No links found</p>
              )}
            </>
          ) : (
            <div className={styles.welcome}>
              <h1>Welcome to Neural Observatory</h1>
              <p>Search above or select filters from the sidebar to explore {allLinks.length} research links</p>
            </div>
          )}
        </main>
      </div>

      {deletedLinks.size > 0 && (
        <div className={styles.pendingDeletions}>
          <button
            className={styles.pendingButton}
            onClick={() => setShowPendingPanel(prev => !prev)}
          >
            Pending Deletions ({deletedLinks.size})
          </button>
          {showPendingPanel && (
            <div className={styles.pendingPanel}>
              <div className={styles.pendingHeader}>
                <h3>Pending Deletions</h3>
                <div className={styles.pendingActions}>
                  <button onClick={handleCopyDeletions} className={styles.copyButton}>
                    Copy to Clipboard
                  </button>
                  <button onClick={handleClearAllDeletions} className={styles.clearButton}>
                    Clear All
                  </button>
                </div>
              </div>
              <ul className={styles.pendingList}>
                {[...deletedLinks].map(url => (
                  <li key={url} className={styles.pendingItem}>
                    <span className={styles.pendingUrl} title={url}>
                      {url.length > 60 ? url.slice(0, 60) + '...' : url}
                    </span>
                    <button
                      className={styles.undoButton}
                      onClick={() => handleUndoDelete(url)}
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
