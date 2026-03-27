import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Base components for building skeletons
 */
const SkeletonBox = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-gray-200 dark:bg-gray-800 rounded-md", className)} />
);

const SkeletonText = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-gray-200 dark:bg-gray-800 rounded h-4 w-3/4", className)} />
);

const SkeletonCircle = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-gray-200 dark:bg-gray-800 rounded-full", className)} />
);

/**
 * Page Header Skeleton
 */
const PageHeaderSkeleton = () => (
  <div className="space-y-2 mb-6">
    <SkeletonBox className="h-10 w-64" />
    <SkeletonBox className="h-5 w-96" />
  </div>
);

/**
 * Dashboard Skeleton
 */
export const DashboardSkeleton = ({ hideHeader = false }: { hideHeader?: boolean }) => (
  <div className="space-y-6">
    {!hideHeader && <PageHeaderSkeleton />}
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="overflow-hidden border-none shadow-sm dark:bg-gray-900/40 relative">
          <div className="w-1 h-full bg-gray-200 dark:bg-gray-800 absolute left-0" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pl-6">
            <SkeletonBox className="h-5 w-24" />
            <SkeletonCircle className="h-5 w-5" />
          </CardHeader>
          <CardContent className="pl-6 pt-2 pb-4">
            <SkeletonBox className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="col-span-1 border-none shadow-md overflow-hidden xl:col-span-2">
      <CardHeader className="pb-2">
        <SkeletonBox className="h-6 w-48 mb-2" />
        <SkeletonBox className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <SkeletonBox className="h-[350px] w-full rounded-xl" />
      </CardContent>
    </Card>
  </div>
);

/**
 * Generic List Skeleton (Areas, Clients, MqttConfig, Topics)
 */
export const ListSkeleton = ({ count = 4, hideHeader = false }: { count?: number; hideHeader?: boolean }) => (
  <div className="space-y-6">
    {!hideHeader && <PageHeaderSkeleton />}
    
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden shadow-sm dark:bg-gray-900">
          <div className="flex h-full">
            <div className="w-2 bg-gray-200 dark:bg-gray-800 shrink-0 animate-pulse" />
            <div className="flex-1 p-4 flex justify-between items-center w-full">
              <div className="space-y-2 w-full max-w-[70%]">
                <SkeletonBox className="h-6 w-1/3" />
                <SkeletonBox className="h-4 w-2/3" />
              </div>
              <div className="flex gap-2">
                <SkeletonCircle className="h-8 w-8" />
                <SkeletonCircle className="h-8 w-8" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

/**
 * Alerts Skeleton
 */
export const AlertsSkeleton = ({ hideHeader = false }: { hideHeader?: boolean }) => (
  <div className="space-y-6">
    {!hideHeader && <PageHeaderSkeleton />}
    
    <div className="flex gap-2 mb-4">
      <SkeletonBox className="h-10 w-[200px]" />
      <SkeletonBox className="h-10 w-[150px]" />
    </div>

    <div className="space-y-3 mt-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="mb-2 shadow-sm border-l-4 border-gray-200 dark:border-gray-800">
          <CardHeader className="py-3 px-4 flex flex-row items-start justify-between">
            <div className="flex items-start gap-3 w-full">
              <SkeletonCircle className="h-6 w-6 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1 pt-1">
                <SkeletonBox className="h-5 w-1/2" />
                <SkeletonBox className="h-4 w-3/4" />
                <SkeletonBox className="h-4 w-1/4 mt-2" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  </div>
);

/**
 * Analysis Skeleton
 */
export const AnalysisSkeleton = ({ hideHeader = false }: { hideHeader?: boolean }) => (
  <div className="space-y-6">
    {!hideHeader && <PageHeaderSkeleton />}
    
    <Card className="border-none shadow-md mb-6">
      <CardContent className="pt-6">
        <SkeletonBox className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full lg:col-span-2" />
        </div>
      </CardContent>
    </Card>

    <Card className="border-none shadow-md">
      <CardContent className="pt-6">
        <SkeletonBox className="h-[400px] w-full rounded-xl" />
      </CardContent>
    </Card>
  </div>
);

/**
 * Map Skeleton
 */
export const MapSkeleton = ({ hideHeader = false }: { hideHeader?: boolean }) => (
  <div className="space-y-6">
    {!hideHeader && <PageHeaderSkeleton />}
    <SkeletonBox className="w-full h-[65vh] rounded-2xl shadow-md" />
  </div>
);

/**
 * Full Page Center Skeleton (for Auth/Routing)
 */
export const CenterSpinnerSkeleton = () => (
  <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-950">
    <div className="relative">
      <div className="absolute inset-0 bg-[#3eaa76]/30 rounded-full blur-xl animate-pulse -m-2"></div>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 dark:border-gray-700 relative z-10 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#3eaa76] animate-spin" />
      </div>
    </div>
  </div>
);
