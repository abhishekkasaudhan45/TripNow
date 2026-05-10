import React from "react";

export default function OptimizedImage({ 
  src, 
  alt, 
  width = 1200, 
  height = 800, 
  priority = false, 
  className = "" 
}) {
  // Automatically appends Unsplash optimization parameters
  const url = src.includes("unsplash.com") 
    ? `${src}?w=${width}&q=80&auto=format&fm=webp`
    : src;

  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchpriority={priority ? "high" : "auto"}
      decoding="async"
      className={`object-cover ${className}`}
    />
  );
}