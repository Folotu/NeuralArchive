import React from 'react';
import styles from './LinkPreview.module.css';

function getGitHubInfo(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'github.com') {
      const [, owner, repo] = urlObj.pathname.split('/');
      return {
        type: 'github',
        owner,
        repo,
        avatar: `https://github.com/${owner}.png`,
        url: url
      };
    }
  } catch (e) {
    console.error('Error parsing GitHub URL:', e);
  }
  return null;
}

export default function LinkPreview({ link, content, timestamp, onDelete }) {
  const [previewData, setPreviewData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPreview = async () => {
      try {
        const githubInfo = getGitHubInfo(link);
        if (githubInfo) {
          // For GitHub links, fetch repository info
          const response = await fetch(`https://api.github.com/repos/${githubInfo.owner}/${githubInfo.repo}`);
          const data = await response.json();
          setPreviewData({
            title: data.full_name,
            description: data.description,
            image: githubInfo.avatar,
            siteName: 'GitHub',
            stars: data.stargazers_count,
            forks: data.forks_count,
            issues: data.open_issues_count
          });
        } else {
          // For non-GitHub links
          const response = await fetch(`/api/preview?url=${encodeURIComponent(link)}`);
          const data = await response.json();
          setPreviewData(data);
        }
      } catch (error) {
        console.error('Error fetching preview:', error);
        // Fallback preview data
        setPreviewData({
          title: link,
          description: content,
          siteName: new URL(link).hostname
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [link, content]);

  if (loading) {
    return <div className={styles.previewCard}>Loading preview...</div>;
  }

  const isGitHub = previewData?.siteName === 'GitHub';

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) onDelete(link);
  };

  return (
    <div className={styles.previewCard}>
      {onDelete && (
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          title="Mark for deletion"
          aria-label="Delete this link"
        >
          &times;
        </button>
      )}
      <a href={link} target="_blank" rel="noopener noreferrer" className={styles.previewLink}>
        {previewData?.image && (
          <div className={styles.imageContainer}>
            <img src={previewData.image} alt={previewData.title || 'Link preview'} />
          </div>
        )}
        <div className={styles.content}>
          <h3 className={styles.title}>{previewData?.title || link}</h3>
          {previewData?.description && (
            <p className={styles.description}>{previewData.description}</p>
          )}
          <div className={styles.metadata}>
            {previewData?.siteName && (
              <span className={styles.siteName}>{previewData.siteName}</span>
            )}
            {isGitHub && (
              <div className={styles.githubStats}>
                <span>⭐ {previewData.stars}</span>
                <span>🔀 {previewData.forks}</span>
                <span>⚠️ {previewData.issues}</span>
              </div>
            )}
            {timestamp && <span className={styles.timestamp}>{timestamp}</span>}
          </div>
          {content && <p className={styles.messageContent}>{content}</p>}
        </div>
      </a>
    </div>
  );
}
