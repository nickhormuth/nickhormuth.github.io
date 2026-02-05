/**
 * ReviewWidget - Multi-Platform Review Aggregator
 * Displays reviews from Google, Airbnb, TripAdvisor, Yelp, and Facebook
 *
 * @version 1.0.0
 * @author Review Widget
 */

(function() {
  'use strict';

  // Platform configurations
  const PLATFORMS = {
    google: {
      name: 'Google',
      color: '#4285f4',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`
    },
    airbnb: {
      name: 'Airbnb',
      color: '#ff5a5f',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 17.703c-.457.907-1.158 1.658-2.023 2.169-.443.262-.923.457-1.427.581-.252.062-.508.105-.767.129-.13.012-.26.019-.391.019-.391 0-.776-.048-1.151-.144-.75-.19-1.443-.547-2.023-1.044-.29-.249-.555-.527-.79-.831-.235.304-.5.582-.79.831-.58.497-1.273.854-2.023 1.044-.375.096-.76.144-1.151.144-.131 0-.261-.007-.391-.019-.259-.024-.515-.067-.767-.129-.504-.124-.984-.319-1.427-.581-.865-.511-1.566-1.262-2.023-2.169-.228-.452-.399-.935-.506-1.436-.054-.25-.093-.504-.117-.76-.012-.13-.019-.26-.019-.391 0-.522.067-1.034.197-1.527.26-1.004.756-1.926 1.439-2.686.341-.38.726-.72 1.149-1.011.212-.146.433-.281.662-.403.229-.122.466-.231.712-.326.245-.095.499-.177.761-.244.131-.033.264-.062.398-.086.134-.024.27-.044.407-.059.137-.015.275-.026.414-.031.139-.006.279-.008.42-.006.282.004.563.024.841.061.278.036.553.09.823.16.27.07.535.157.793.26.258.103.51.222.753.356.122.067.241.138.358.213.117.075.231.154.342.237.111.083.218.17.323.26.104.09.205.184.302.281.485.485.896 1.042 1.22 1.651.324.609.558 1.27.69 1.961.066.346.111.697.135 1.052.012.178.019.356.019.536 0 .131-.007.261-.019.391-.024.256-.063.51-.117.76-.107.501-.278.984-.506 1.436z"/></svg>`
    },
    tripadvisor: {
      name: 'TripAdvisor',
      color: '#00af87',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`
    },
    yelp: {
      name: 'Yelp',
      color: '#d32323',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.111 18.226c-.141.969-2.119 3.483-3.029 3.847-.311.124-.611.094-.85-.09-.154-.12-.314-.365-2.447-3.827l-.633-1.032c-.244-.37-.199-.857.104-1.229.297-.372.791-.514 1.213-.363l1.169.421c2.078.745 2.678.998 2.857 1.194.267.29.477.663.616 1.079zm-7.919-5.108l-.774-1.135c-.498-.729-.391-1.471.262-1.811l6.495-3.395c.309-.148.592-.161.822-.042.406.209 1.212 1.818 1.333 2.453.085.441-.046.832-.373 1.104-.238.197-.513.287-.822.269-.075-.004-.219-.025-.459-.059l-4.275-.595c-.752-.104-1.46.128-1.834.591-.078.096-.229.313-.375.62zm-1.879 3.971c-.048.063-.097.127-.147.189-.733.906-1.722 1.133-2.438.561l-5.472-4.388c-.284-.229-.397-.541-.328-.905.122-.645 1.124-2.793 1.596-3.206.33-.29.678-.371 1.009-.246.241.091.588.334 1.715 1.251l3.336 2.721c.217.178.351.395.399.646.047.251.02.526-.08.818-.072.211-.264.59-.59.559zm-2.083-9.009l-.774 5.631c-.101.731-.706 1.22-1.477 1.167l-6.932-.471c-.336-.019-.612-.168-.8-.431-.33-.462-.6-2.281-.442-2.963.109-.472.383-.808.795-.975.181-.073.404-.118.71-.154l5.338-.617c.377-.045.678-.205.875-.466.097-.128.234-.37.294-.669.089-.426-.032-.912-.364-1.306l-3.545-4.064c-.222-.256-.296-.538-.215-.819.146-.507 1.36-2.239 1.987-2.584.435-.24.863-.234 1.241.013.277.181.483.442 1.733 2.778l2.576 4.834c.37.694.37 1.394 0 2.096z"/></svg>`
    },
    facebook: {
      name: 'Facebook',
      color: '#1877f2',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`
    }
  };

  // Star SVG icons
  const STAR_FILLED = `<svg class="rw-star filled" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
  const STAR_EMPTY = `<svg class="rw-star" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;

  // Default configuration
  const DEFAULT_CONFIG = {
    // Display settings
    layout: 'grid', // 'grid', 'carousel', 'masonry', 'list'
    theme: 'light', // 'light', 'dark', 'auto'
    reviewsPerPage: 6,
    snippetLength: 150, // characters

    // Feature toggles
    showAiSummary: true,
    showStats: true,
    showFilters: true,
    showImages: true,
    showAvatars: true,
    showDates: true,
    showPlatformBadge: true,
    showVerifiedBadge: true,
    showWriteReview: false,

    // Filter settings
    minRating: 1, // 1-5, set to 5 to show only 5-star reviews
    platforms: ['google', 'airbnb', 'tripadvisor', 'yelp', 'facebook'],

    // Carousel settings
    autoplay: false,
    autoplaySpeed: 5000,

    // Customization
    primaryColor: null,
    borderRadius: null,
    fontFamily: null,

    // AI Summary
    aiSummaryText: null, // Custom AI summary text

    // Callbacks
    onReviewClick: null,
    onLoadMore: null,
    onFilterChange: null
  };

  /**
   * Main ReviewWidget Class
   */
  class ReviewWidget {
    constructor(container, reviews, options = {}) {
      this.container = typeof container === 'string'
        ? document.querySelector(container)
        : container;

      if (!this.container) {
        console.error('ReviewWidget: Container not found');
        return;
      }

      this.originalReviews = reviews || [];
      this.reviews = [...this.originalReviews];
      this.config = { ...DEFAULT_CONFIG, ...options };
      this.currentPage = 1;
      this.carouselIndex = 0;
      this.carouselInterval = null;
      this.settingsOpen = false;
      this.lightboxOpen = false;

      this.init();
    }

    init() {
      this.applyCustomStyles();
      this.filterReviews();
      this.render();
      this.attachEventListeners();

      if (this.config.layout === 'carousel' && this.config.autoplay) {
        this.startAutoplay();
      }
    }

    applyCustomStyles() {
      if (this.config.primaryColor) {
        this.container.style.setProperty('--rw-primary-color', this.config.primaryColor);
      }
      if (this.config.borderRadius) {
        this.container.style.setProperty('--rw-radius-lg', this.config.borderRadius);
      }
      if (this.config.fontFamily) {
        this.container.style.setProperty('--rw-font-family', this.config.fontFamily);
      }
    }

    filterReviews() {
      this.reviews = this.originalReviews.filter(review => {
        // Filter by rating
        if (review.rating < this.config.minRating) return false;

        // Filter by platform
        if (!this.config.platforms.includes(review.platform)) return false;

        return true;
      });
    }

    getStats() {
      const total = this.reviews.length;
      if (total === 0) return { average: 0, total: 0, distribution: {} };

      const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
      const average = sum / total;

      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      this.reviews.forEach(r => {
        distribution[Math.floor(r.rating)]++;
      });

      return { average: average.toFixed(1), total, distribution };
    }

    generateAiSummary() {
      if (this.config.aiSummaryText) {
        return this.config.aiSummaryText;
      }

      const stats = this.getStats();
      const total = this.reviews.length;

      if (total === 0) {
        return "No reviews available yet. Be the first to share your experience!";
      }

      // Analyze sentiment and common themes
      const positiveKeywords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'perfect', 'love', 'best', 'beautiful', 'clean', 'friendly', 'helpful', 'comfortable', 'delicious', 'recommend'];
      const negativeKeywords = ['bad', 'terrible', 'awful', 'disappointing', 'poor', 'worst', 'dirty', 'rude', 'slow', 'expensive', 'noisy'];

      let positiveCount = 0;
      let negativeCount = 0;
      const themes = {};

      this.reviews.forEach(review => {
        const text = review.text.toLowerCase();
        positiveKeywords.forEach(kw => {
          if (text.includes(kw)) positiveCount++;
        });
        negativeKeywords.forEach(kw => {
          if (text.includes(kw)) negativeCount++;
        });
      });

      const sentiment = positiveCount > negativeCount * 2 ? 'overwhelmingly positive' :
                       positiveCount > negativeCount ? 'mostly positive' :
                       negativeCount > positiveCount ? 'mixed with some concerns' : 'balanced';

      const fiveStarPercent = Math.round((stats.distribution[5] / total) * 100);

      let summary = `Based on ${total} reviews across multiple platforms, this business has an ${sentiment} reputation with an average rating of ${stats.average} stars. `;

      if (fiveStarPercent > 70) {
        summary += `An impressive ${fiveStarPercent}% of reviewers gave 5-star ratings. `;
      } else if (fiveStarPercent > 50) {
        summary += `${fiveStarPercent}% of customers gave perfect 5-star ratings. `;
      }

      // Platform breakdown
      const platformCounts = {};
      this.reviews.forEach(r => {
        platformCounts[r.platform] = (platformCounts[r.platform] || 0) + 1;
      });

      const platforms = Object.keys(platformCounts).map(p => PLATFORMS[p]?.name || p);
      if (platforms.length > 1) {
        summary += `Reviews come from ${platforms.slice(0, -1).join(', ')} and ${platforms.slice(-1)}.`;
      } else if (platforms.length === 1) {
        summary += `Reviews are from ${platforms[0]}.`;
      }

      return summary;
    }

    renderStars(rating) {
      let stars = '';
      for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? STAR_FILLED : STAR_EMPTY;
      }
      return `<div class="rw-stars">${stars}</div>`;
    }

    renderPlatformIcon(platform) {
      const p = PLATFORMS[platform];
      if (!p) return '';
      return `<span class="rw-platform-icon ${platform}" title="${p.name}">${p.icon}</span>`;
    }

    renderAvatar(review) {
      if (!this.config.showAvatars) return '';

      if (review.avatar) {
        return `<img class="rw-avatar" src="${review.avatar}" alt="${review.name}" loading="lazy">`;
      }

      const initials = review.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      return `<div class="rw-avatar-placeholder">${initials}</div>`;
    }

    truncateText(text, length) {
      if (text.length <= length) return { text, truncated: false };
      return {
        text: text.substring(0, length).trim() + '...',
        truncated: true
      };
    }

    formatDate(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 1) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    }

    renderReviewCard(review, index) {
      const { text, truncated } = this.truncateText(review.text, this.config.snippetLength);

      const imagesHtml = this.config.showImages && review.images && review.images.length > 0
        ? `<div class="rw-review-images">
            ${review.images.map((img, i) =>
              `<img class="rw-review-image" src="${img}" alt="Review image ${i + 1}" data-full="${img}" loading="lazy">`
            ).join('')}
           </div>`
        : '';

      const dateHtml = this.config.showDates && review.date
        ? `<span class="rw-review-date">${this.formatDate(review.date)}</span>`
        : '';

      const platformBadge = this.config.showPlatformBadge
        ? `<span class="rw-review-source">
            ${this.renderPlatformIcon(review.platform)}
            <span>${PLATFORMS[review.platform]?.name || review.platform}</span>
           </span>`
        : '';

      const verifiedBadge = this.config.showVerifiedBadge && review.verified
        ? `<span class="rw-verified-badge">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            Verified
           </span>`
        : '';

      const readMoreBtn = truncated
        ? `<button class="rw-read-more" data-index="${index}">Read more</button>`
        : '';

      return `
        <div class="rw-review-card" data-index="${index}" data-platform="${review.platform}">
          <div class="rw-review-header">
            ${this.renderAvatar(review)}
            <div class="rw-reviewer-info">
              <h4 class="rw-reviewer-name">
                ${review.name}
                ${verifiedBadge}
              </h4>
              <div class="rw-review-meta">
                ${dateHtml}
                ${platformBadge}
              </div>
            </div>
          </div>
          <div class="rw-review-rating">
            ${this.renderStars(review.rating)}
          </div>
          <div class="rw-review-content">
            <p class="rw-review-text" data-full="${encodeURIComponent(review.text)}">${text}</p>
            ${readMoreBtn}
            ${imagesHtml}
          </div>
        </div>
      `;
    }

    renderAiSummary() {
      if (!this.config.showAiSummary) return '';

      const summary = this.generateAiSummary();

      return `
        <div class="rw-ai-summary">
          <div class="rw-ai-summary-header">
            <div class="rw-ai-icon">AI</div>
            <span class="rw-ai-label">AI-Powered Summary</span>
          </div>
          <p class="rw-ai-summary-text">${summary}</p>
        </div>
      `;
    }

    renderStats() {
      if (!this.config.showStats) return '';

      const stats = this.getStats();

      const barsHtml = [5, 4, 3, 2, 1].map(rating => {
        const count = stats.distribution[rating] || 0;
        const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
        return `
          <div class="rw-stats-bar">
            <span class="rw-stats-bar-label">${rating} star</span>
            <div class="rw-stats-bar-track">
              <div class="rw-stats-bar-fill" style="width: ${percent}%"></div>
            </div>
            <span class="rw-stats-bar-count">${count}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="rw-stats">
          <div class="rw-stats-main">
            <span class="rw-stats-rating">${stats.average}</span>
            <div class="rw-stats-stars">
              ${this.renderStars(Math.round(parseFloat(stats.average)))}
              <span class="rw-stats-count">${stats.total} reviews</span>
            </div>
          </div>
          <div class="rw-stats-breakdown">
            ${barsHtml}
          </div>
        </div>
      `;
    }

    renderFilters() {
      if (!this.config.showFilters) return '';

      const platformButtons = Object.keys(PLATFORMS).map(platform => {
        const isActive = this.config.platforms.includes(platform);
        return `
          <button class="rw-filter-btn ${isActive ? 'active' : ''}" data-platform="${platform}">
            ${this.renderPlatformIcon(platform)}
            <span>${PLATFORMS[platform].name}</span>
          </button>
        `;
      }).join('');

      const ratingButtons = [5, 4, 3, 2, 1].map(rating => {
        const isActive = this.config.minRating === rating;
        return `
          <button class="rw-filter-btn ${isActive ? 'active' : ''}" data-rating="${rating}">
            ${rating}+ stars
          </button>
        `;
      }).join('');

      return `
        <div class="rw-filters">
          <div class="rw-filter-group">
            <span class="rw-filter-label">Platform:</span>
            <div class="rw-filter-buttons" data-filter="platform">
              <button class="rw-filter-btn ${this.config.platforms.length === 5 ? 'active' : ''}" data-platform="all">All</button>
              ${platformButtons}
            </div>
          </div>
          <div class="rw-filter-group">
            <span class="rw-filter-label">Rating:</span>
            <div class="rw-filter-buttons" data-filter="rating">
              <button class="rw-filter-btn ${this.config.minRating === 1 ? 'active' : ''}" data-rating="1">All</button>
              ${ratingButtons}
            </div>
          </div>
        </div>
      `;
    }

    renderReviews() {
      const startIndex = 0;
      const endIndex = this.currentPage * this.config.reviewsPerPage;
      const visibleReviews = this.reviews.slice(startIndex, endIndex);

      if (visibleReviews.length === 0) {
        return `
          <div class="rw-empty">
            <svg class="rw-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <h3 class="rw-empty-title">No reviews found</h3>
            <p class="rw-empty-text">Try adjusting your filters to see more reviews.</p>
          </div>
        `;
      }

      const reviewsHtml = visibleReviews.map((review, index) =>
        this.renderReviewCard(review, index)
      ).join('');

      const writeReviewCard = this.config.showWriteReview ? `
        <div class="rw-write-review" role="button" tabindex="0">
          <div class="rw-write-review-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <h4 class="rw-write-review-title">Write a Review</h4>
          <p class="rw-write-review-text">Share your experience with others</p>
        </div>
      ` : '';

      let containerClass = 'rw-reviews-grid';
      if (this.config.layout === 'carousel') containerClass = 'rw-reviews-carousel';
      if (this.config.layout === 'masonry') containerClass = 'rw-reviews-masonry';
      if (this.config.layout === 'list') containerClass = 'rw-reviews-list';

      if (this.config.layout === 'carousel') {
        return `
          <div class="${containerClass}">
            <button class="rw-carousel-nav prev" aria-label="Previous">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div class="rw-carousel-track">
              ${reviewsHtml}
              ${writeReviewCard}
            </div>
            <button class="rw-carousel-nav next" aria-label="Next">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          <div class="rw-carousel-dots">
            ${visibleReviews.map((_, i) =>
              `<button class="rw-carousel-dot ${i === this.carouselIndex ? 'active' : ''}" data-index="${i}"></button>`
            ).join('')}
          </div>
        `;
      }

      return `
        <div class="${containerClass}">
          ${reviewsHtml}
          ${writeReviewCard}
        </div>
      `;
    }

    renderLoadMore() {
      const totalVisible = this.currentPage * this.config.reviewsPerPage;
      if (totalVisible >= this.reviews.length) return '';

      const remaining = this.reviews.length - totalVisible;

      return `
        <div class="rw-load-more">
          <button class="rw-load-more-btn">
            Load More Reviews (${remaining} remaining)
          </button>
        </div>
      `;
    }

    renderSettingsPanel() {
      return `
        <div class="rw-settings-overlay ${this.settingsOpen ? 'open' : ''}"></div>
        <div class="rw-settings-panel ${this.settingsOpen ? 'open' : ''}">
          <div class="rw-settings-header">
            <h3 class="rw-settings-title">Widget Settings</h3>
            <button class="rw-settings-close" aria-label="Close settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="rw-settings-content">
            <div class="rw-settings-section">
              <h4 class="rw-settings-section-title">Display</h4>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Layout</span>
                <select class="rw-select" data-setting="layout">
                  <option value="grid" ${this.config.layout === 'grid' ? 'selected' : ''}>Grid</option>
                  <option value="carousel" ${this.config.layout === 'carousel' ? 'selected' : ''}>Carousel</option>
                  <option value="masonry" ${this.config.layout === 'masonry' ? 'selected' : ''}>Masonry</option>
                  <option value="list" ${this.config.layout === 'list' ? 'selected' : ''}>List</option>
                </select>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Theme</span>
                <select class="rw-select" data-setting="theme">
                  <option value="light" ${this.config.theme === 'light' ? 'selected' : ''}>Light</option>
                  <option value="dark" ${this.config.theme === 'dark' ? 'selected' : ''}>Dark</option>
                </select>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Snippet Length</span>
                <input type="range" class="rw-range" data-setting="snippetLength" min="50" max="500" value="${this.config.snippetLength}">
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Reviews Per Page</span>
                <select class="rw-select" data-setting="reviewsPerPage">
                  <option value="3" ${this.config.reviewsPerPage === 3 ? 'selected' : ''}>3</option>
                  <option value="6" ${this.config.reviewsPerPage === 6 ? 'selected' : ''}>6</option>
                  <option value="9" ${this.config.reviewsPerPage === 9 ? 'selected' : ''}>9</option>
                  <option value="12" ${this.config.reviewsPerPage === 12 ? 'selected' : ''}>12</option>
                </select>
              </div>
            </div>
            <div class="rw-settings-section">
              <h4 class="rw-settings-section-title">Features</h4>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Show AI Summary</span>
                <div class="rw-toggle ${this.config.showAiSummary ? 'active' : ''}" data-setting="showAiSummary"></div>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Show Statistics</span>
                <div class="rw-toggle ${this.config.showStats ? 'active' : ''}" data-setting="showStats"></div>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Show Filters</span>
                <div class="rw-toggle ${this.config.showFilters ? 'active' : ''}" data-setting="showFilters"></div>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Show Review Images</span>
                <div class="rw-toggle ${this.config.showImages ? 'active' : ''}" data-setting="showImages"></div>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Show Avatars</span>
                <div class="rw-toggle ${this.config.showAvatars ? 'active' : ''}" data-setting="showAvatars"></div>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Show Dates</span>
                <div class="rw-toggle ${this.config.showDates ? 'active' : ''}" data-setting="showDates"></div>
              </div>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Show Platform Badge</span>
                <div class="rw-toggle ${this.config.showPlatformBadge ? 'active' : ''}" data-setting="showPlatformBadge"></div>
              </div>
            </div>
            <div class="rw-settings-section">
              <h4 class="rw-settings-section-title">Filters</h4>
              <div class="rw-settings-option">
                <span class="rw-settings-option-label">Minimum Rating</span>
                <select class="rw-select" data-setting="minRating">
                  <option value="1" ${this.config.minRating === 1 ? 'selected' : ''}>All ratings</option>
                  <option value="2" ${this.config.minRating === 2 ? 'selected' : ''}>2+ stars</option>
                  <option value="3" ${this.config.minRating === 3 ? 'selected' : ''}>3+ stars</option>
                  <option value="4" ${this.config.minRating === 4 ? 'selected' : ''}>4+ stars</option>
                  <option value="5" ${this.config.minRating === 5 ? 'selected' : ''}>5 stars only</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderLightbox() {
      return `
        <div class="rw-lightbox">
          <button class="rw-lightbox-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <img class="rw-lightbox-image" src="" alt="Review image">
        </div>
      `;
    }

    render() {
      const themeAttr = this.config.theme === 'dark' ? 'data-theme="dark"' : '';

      this.container.innerHTML = `
        <div class="review-widget" ${themeAttr}>
          <div class="rw-header">
            <div class="rw-header-top">
              <div>
                <h2 class="rw-title">Customer Reviews</h2>
                <p class="rw-subtitle">See what our customers are saying</p>
              </div>
              <button class="rw-settings-toggle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                Settings
              </button>
            </div>
            ${this.renderAiSummary()}
            ${this.renderStats()}
          </div>
          ${this.renderFilters()}
          ${this.renderReviews()}
          ${this.renderLoadMore()}
          ${this.renderSettingsPanel()}
          ${this.renderLightbox()}
        </div>
      `;
    }

    attachEventListeners() {
      // Settings toggle
      const settingsToggle = this.container.querySelector('.rw-settings-toggle');
      if (settingsToggle) {
        settingsToggle.addEventListener('click', () => this.toggleSettings());
      }

      // Settings close
      const settingsClose = this.container.querySelector('.rw-settings-close');
      if (settingsClose) {
        settingsClose.addEventListener('click', () => this.toggleSettings(false));
      }

      // Settings overlay
      const settingsOverlay = this.container.querySelector('.rw-settings-overlay');
      if (settingsOverlay) {
        settingsOverlay.addEventListener('click', () => this.toggleSettings(false));
      }

      // Settings toggles
      this.container.querySelectorAll('.rw-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
          const setting = toggle.dataset.setting;
          this.config[setting] = !this.config[setting];
          toggle.classList.toggle('active');
          this.filterReviews();
          this.render();
          this.attachEventListeners();
        });
      });

      // Settings selects
      this.container.querySelectorAll('.rw-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const setting = select.dataset.setting;
          let value = e.target.value;

          if (setting === 'reviewsPerPage' || setting === 'minRating') {
            value = parseInt(value);
          }

          this.config[setting] = value;
          this.currentPage = 1;
          this.filterReviews();
          this.render();
          this.attachEventListeners();
        });
      });

      // Settings range
      this.container.querySelectorAll('.rw-range').forEach(range => {
        range.addEventListener('input', (e) => {
          const setting = range.dataset.setting;
          this.config[setting] = parseInt(e.target.value);
          this.render();
          this.attachEventListeners();
        });
      });

      // Platform filters
      this.container.querySelectorAll('.rw-filter-btn[data-platform]').forEach(btn => {
        btn.addEventListener('click', () => {
          const platform = btn.dataset.platform;

          if (platform === 'all') {
            this.config.platforms = Object.keys(PLATFORMS);
          } else {
            const index = this.config.platforms.indexOf(platform);
            if (index > -1) {
              this.config.platforms.splice(index, 1);
            } else {
              this.config.platforms.push(platform);
            }
          }

          this.currentPage = 1;
          this.filterReviews();
          this.render();
          this.attachEventListeners();

          if (this.config.onFilterChange) {
            this.config.onFilterChange({ platforms: this.config.platforms });
          }
        });
      });

      // Rating filters
      this.container.querySelectorAll('.rw-filter-btn[data-rating]').forEach(btn => {
        btn.addEventListener('click', () => {
          const rating = parseInt(btn.dataset.rating);
          this.config.minRating = rating;
          this.currentPage = 1;
          this.filterReviews();
          this.render();
          this.attachEventListeners();

          if (this.config.onFilterChange) {
            this.config.onFilterChange({ minRating: rating });
          }
        });
      });

      // Load more
      const loadMoreBtn = this.container.querySelector('.rw-load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          this.currentPage++;
          this.render();
          this.attachEventListeners();

          if (this.config.onLoadMore) {
            this.config.onLoadMore(this.currentPage);
          }
        });
      }

      // Read more buttons
      this.container.querySelectorAll('.rw-read-more').forEach(btn => {
        btn.addEventListener('click', () => {
          const textEl = btn.previousElementSibling;
          const fullText = decodeURIComponent(textEl.dataset.full);
          textEl.textContent = fullText;
          btn.remove();
        });
      });

      // Review images - lightbox
      this.container.querySelectorAll('.rw-review-image').forEach(img => {
        img.addEventListener('click', () => {
          const lightbox = this.container.querySelector('.rw-lightbox');
          const lightboxImg = lightbox.querySelector('.rw-lightbox-image');
          lightboxImg.src = img.dataset.full;
          lightbox.classList.add('open');
        });
      });

      // Lightbox close
      const lightbox = this.container.querySelector('.rw-lightbox');
      if (lightbox) {
        lightbox.addEventListener('click', (e) => {
          if (e.target === lightbox || e.target.closest('.rw-lightbox-close')) {
            lightbox.classList.remove('open');
          }
        });
      }

      // Carousel navigation
      const prevBtn = this.container.querySelector('.rw-carousel-nav.prev');
      const nextBtn = this.container.querySelector('.rw-carousel-nav.next');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.navigateCarousel(-1));
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.navigateCarousel(1));
      }

      // Carousel dots
      this.container.querySelectorAll('.rw-carousel-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          this.carouselIndex = parseInt(dot.dataset.index);
          this.updateCarousel();
        });
      });

      // Review card click
      this.container.querySelectorAll('.rw-review-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.rw-read-more') || e.target.closest('.rw-review-image')) return;

          if (this.config.onReviewClick) {
            const index = parseInt(card.dataset.index);
            this.config.onReviewClick(this.reviews[index], index);
          }
        });
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.toggleSettings(false);
          const lightbox = this.container.querySelector('.rw-lightbox');
          if (lightbox) lightbox.classList.remove('open');
        }
      });
    }

    toggleSettings(open) {
      this.settingsOpen = open !== undefined ? open : !this.settingsOpen;
      const panel = this.container.querySelector('.rw-settings-panel');
      const overlay = this.container.querySelector('.rw-settings-overlay');

      if (panel) panel.classList.toggle('open', this.settingsOpen);
      if (overlay) overlay.classList.toggle('open', this.settingsOpen);
    }

    navigateCarousel(direction) {
      const totalReviews = Math.min(
        this.currentPage * this.config.reviewsPerPage,
        this.reviews.length
      );

      this.carouselIndex += direction;

      if (this.carouselIndex < 0) this.carouselIndex = totalReviews - 1;
      if (this.carouselIndex >= totalReviews) this.carouselIndex = 0;

      this.updateCarousel();
    }

    updateCarousel() {
      const track = this.container.querySelector('.rw-carousel-track');
      const cards = track.querySelectorAll('.rw-review-card');

      if (cards.length === 0) return;

      const cardWidth = cards[0].offsetWidth + 24; // Including gap
      track.style.transform = `translateX(-${this.carouselIndex * cardWidth}px)`;

      // Update dots
      this.container.querySelectorAll('.rw-carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === this.carouselIndex);
      });
    }

    startAutoplay() {
      this.carouselInterval = setInterval(() => {
        this.navigateCarousel(1);
      }, this.config.autoplaySpeed);
    }

    stopAutoplay() {
      if (this.carouselInterval) {
        clearInterval(this.carouselInterval);
        this.carouselInterval = null;
      }
    }

    // Public API methods
    setReviews(reviews) {
      this.originalReviews = reviews;
      this.reviews = [...reviews];
      this.currentPage = 1;
      this.filterReviews();
      this.render();
      this.attachEventListeners();
    }

    addReview(review) {
      this.originalReviews.unshift(review);
      this.filterReviews();
      this.render();
      this.attachEventListeners();
    }

    setConfig(config) {
      this.config = { ...this.config, ...config };
      this.filterReviews();
      this.render();
      this.attachEventListeners();
    }

    getConfig() {
      return { ...this.config };
    }

    getFilteredReviews() {
      return [...this.reviews];
    }

    destroy() {
      this.stopAutoplay();
      this.container.innerHTML = '';
    }
  }

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReviewWidget;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() { return ReviewWidget; });
  } else {
    window.ReviewWidget = ReviewWidget;
  }
})();
