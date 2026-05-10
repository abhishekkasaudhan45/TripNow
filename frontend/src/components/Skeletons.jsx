import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility to merge Tailwind classes safely
const cn = (...inputs) => twMerge(clsx(inputs));

// Base Primitive (Matches your Creamy White & Gold theme)
export const Skeleton = ({ className, ...props }) => (
  <div
    className={cn(
      "animate-shimmer bg-gradient-to-r from-gray-200/40 via-gray-100/40 to-gray-200/40 bg-[length:200%_100%] rounded-lg",
      className
    )}
    {...props}
  />
);

export function TripSkeleton() {
  return (
    <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-xl space-y-5">
      <Skeleton className="h-8 w-2/3 rounded-xl" />
      
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  );
}

export function HotelSkeleton() {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-5 border border-white/40 space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-10 w-full rounded-xl mt-4" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-5 border border-white/40 space-y-4">
      <Skeleton className="h-52 w-full rounded-2xl mb-4" />
      <Skeleton className="h-6 w-2/3 mb-3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

// 👇 ADDED PAGE SKELETON (Refactored to use your base primitive) 👇
export function PageSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <Skeleton className="h-10 w-1/2 rounded-xl mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}