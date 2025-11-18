import { Activity } from '../types/db';
import { Calendar, FileText, TrendingUp } from 'lucide-react';

interface ActivityListProps {
  activities: Activity[];
}

export default function ActivityList({ activities }: ActivityListProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'task':
        return Calendar;
      case 'note':
        return FileText;
      case 'status':
        return TrendingUp;
      default:
        return FileText;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'task':
        return 'bg-amber-100 text-amber-600';
      case 'note':
        return 'bg-blue-100 text-blue-600';
      case 'status':
        return 'bg-emerald-100 text-emerald-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {activities.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-8">No recent activities</p>
      ) : (
        activities.map((activity) => {
          const Icon = getIcon(activity.type);
          return (
            <div key={activity.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getIconColor(activity.type)}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600 uppercase">{activity.type}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(activity.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-900">{activity.message}</p>
                {activity.due_at && (
                  <p className="text-xs text-gray-600 mt-1">
                    Due: {new Date(activity.due_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
