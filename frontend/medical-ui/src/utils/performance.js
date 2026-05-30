// Frontend Performance Utilities
// Add this to frontend/medical-ui/src/utils/performance.js

/**
 * Request debounce - prevents rapid repeated calls
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Request throttle - limits calls to once per interval
 */
export const throttle = (func, limit = 1000) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Lazy load images with intersection observer
 */
export const lazyLoadImages = () => {
  if (!('IntersectionObserver' in window)) return;
  
  const images = document.querySelectorAll('img[data-lazy]');
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.lazy;
        img.removeAttribute('data-lazy');
        obs.unobserve(img);
      }
    });
  });
  
  images.forEach(img => observer.observe(img));
};

/**
 * Batch DOM updates to avoid reflows
 */
export const batchDOMUpdates = (updates) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

/**
 * Cache API responses in localStorage
 */
export const cacheAPI = (key, data, ttl = 300000) => {
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now(),
    ttl,
  }));
};

export const getCachedAPI = (key) => {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  
  const { data, timestamp, ttl } = JSON.parse(cached);
  if (Date.now() - timestamp > ttl) {
    localStorage.removeItem(key);
    return null;
  }
  
  return data;
};

/**
 * Use Web Workers for heavy computations
 */
export const useWebWorker = (computeFn) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url));
    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = reject;
    worker.postMessage({ compute: computeFn.toString() });
  });
};

/**
 * Virtual scrolling for large lists
 */
export const createVirtualScroller = (containerRef, itemHeight, renderItem) => {
  if (!containerRef.current) return;
  
  const observer = new ResizeObserver(() => {
    const height = containerRef.current.clientHeight;
    const visibleCount = Math.ceil(height / itemHeight);
    // Only render visible items + buffer
    renderItem(visibleCount + 10);
  });
  
  observer.observe(containerRef.current);
  return observer;
};

/**
 * Preload critical resources
 */
export const preloadResources = (urls) => {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });
};

/**
 * Memory leak detector (development only)
 */
export const detectMemoryLeaks = () => {
  if (process.env.NODE_ENV === 'development' && performance.memory) {
    const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
    const usage = (usedJSHeapSize / jsHeapSizeLimit) * 100;
    
    if (usage > 85) {
      console.warn(`⚠️ High memory usage: ${usage.toFixed(1)}%`);
    }
  }
};

/**
 * Mark performance metrics
 */
export const markPerformance = (name) => {
  if (typeof performance !== 'undefined') {
    performance.mark(name);
  }
};

export const measurePerformance = (name, startMark, endMark) => {
  if (typeof performance !== 'undefined') {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name)[0];
    console.log(`📊 ${name}: ${measure.duration.toFixed(2)}ms`);
  }
};

export default {
  debounce,
  throttle,
  lazyLoadImages,
  batchDOMUpdates,
  cacheAPI,
  getCachedAPI,
  useWebWorker,
  createVirtualScroller,
  preloadResources,
  detectMemoryLeaks,
  markPerformance,
  measurePerformance,
};
