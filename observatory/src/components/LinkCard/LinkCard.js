import React from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import MetadataTags from './MetadataTags';
import ProjectMetrics from './ProjectMetrics';
import styles from './LinkCard.module.css';

const LinkCard = ({
  link,
  onGraphView,
  variant = 'full' // 'full' | 'compact' | 'timeline'
}) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  const {
    url,
    title,
    description,
    author,
    topics,
    technologies,
    contentType,
    metrics,
    timestamp,
    content
  } = link;

  const timeAgo = timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : null;

  // Generate proper preview image based on content type
  const getPreviewImage = () => {
    try {
      const urlObj = new URL(url);

      // GitHub projects - use repository owner's avatar
      if (urlObj.hostname === 'github.com' || contentType === 'github-project' || contentType === 'github-tool') {
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2) {
          const owner = pathParts[0];
          return `https://github.com/${owner}.png?size=400`;
        }
      }

      // Twitter/X posts - use generic Twitter icon or try to extract username
      if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com') || contentType === 'twitter') {
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        if (pathParts.length >= 1 && pathParts[0] !== 'i') {
          return `https://unavatar.io/twitter/${pathParts[0]}`;
        }
      }

      // ArXiv papers - use OpenGraph image
      if (urlObj.hostname.includes('arxiv.org') || contentType === 'research-paper') {
        return `https://unavatar.io/${urlObj.hostname}`;
      }

      // For other URLs, try to get favicon/logo
      return `https://unavatar.io/${urlObj.hostname}`;
    } catch (e) {
      return null;
    }
  };

  const previewImage = getPreviewImage();

  const getContentTypeIcon = () => {
    switch (contentType) {
      case 'github': return '⚡';
      case 'tweet': return '🐦';
      case 'paper': return '📄';
      case 'video': return '🎥';
      default: return '🔗';
    }
  };

  const handleImageLoad = () => setImageLoaded(true);
  const handleImageError = () => setImageError(true);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 25
      }
    },
    hover: {
      y: -4,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 20
      }
    }
  };

  const isCompact = variant === 'compact' || variant === 'timeline';

  return (
    <motion.article
      className={`${styles.card} ${styles[`card-${variant}`]}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.cardLink}
      >
        {/* Image Preview */}
        {previewImage && !isCompact && (
          <div className={styles.imageContainer}>
            {!imageLoaded && !imageError && (
              <div className={styles.imageSkeleton}>
                <div className={styles.skeletonPulse} />
              </div>
            )}
            <img
              src={previewImage}
              alt={title || 'Link preview'}
              className={`${styles.image} ${imageLoaded ? styles.imageLoaded : ''}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {/* Content Type Badge */}
            <div className={styles.contentTypeBadge}>
              <span className={styles.contentTypeIcon}>{getContentTypeIcon()}</span>
              <span className={styles.contentTypeLabel}>{contentType}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <h3 className={styles.title}>
              {title || url}
            </h3>
            {timeAgo && (
              <time className={styles.timestamp} dateTime={timestamp}>
                {timeAgo}
              </time>
            )}
          </div>

          {/* Description */}
          {description && !isCompact && (
            <p className={styles.description}>
              {description}
            </p>
          )}

          {/* Original Content */}
          {content && !isCompact && (
            <blockquote className={styles.originalContent}>
              <span className={styles.quoteIcon}>"</span>
              {content}
            </blockquote>
          )}

          {/* Metadata Tags */}
          {!isCompact && (
            <MetadataTags
              topics={topics}
              technologies={technologies}
              author={author}
              maxDisplay={5}
            />
          )}

          {/* Metrics */}
          {!isCompact && (
            <ProjectMetrics metrics={metrics} contentType={contentType} />
          )}

          {/* Compact View Metadata */}
          {isCompact && (
            <div className={styles.compactMeta}>
              {author && (
                <span className={styles.compactAuthor}>
                  {author.handle}
                </span>
              )}
              {topics && topics.length > 0 && (
                <span className={styles.compactTopics}>
                  {topics.slice(0, 2).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions Overlay */}
        {!isCompact && (
          <motion.div
            className={styles.quickActions}
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
          >
            <button
              className={styles.actionButton}
              onClick={(e) => {
                e.preventDefault();
                if (onGraphView) onGraphView(link);
              }}
            >
              <span className={styles.actionIcon}>🕸️</span>
              <span>View in Graph</span>
            </button>
            <button
              className={styles.actionButton}
              onClick={(e) => {
                e.preventDefault();
                // Handle related links
              }}
            >
              <span className={styles.actionIcon}>🔗</span>
              <span>Related</span>
            </button>
          </motion.div>
        )}

        {/* Neural Pulse Effect */}
        <div className={styles.neuralPulse} />
      </a>
    </motion.article>
  );
};

export default LinkCard;
