import React, { useState } from 'react';
import { MessageSquare, Send, User, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  content: string;
  createdAt: string;
}

interface TaskCommentThreadProps {
  taskId?: string;
  comments?: TaskComment[];
  onAddComment?: (comment: TaskComment) => void;
  isViewOnly?: boolean;
}

const DEFAULT_SAMPLE_COMMENTS: TaskComment[] = [
  {
    id: 'c-1',
    authorId: 'user-1',
    authorName: 'Rahul Mehta',
    authorRole: 'Broker-Owner',
    content: 'Please ensure to double check the previous year policy NCB before sending final quotation.',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'c-2',
    authorId: 'user-2',
    authorName: 'Priya Sharma',
    authorRole: 'Insurance Agent',
    content: 'Client requested 2-year multi-year discount comparison as well.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  }
];

export default function TaskCommentThread({
  taskId,
  comments = DEFAULT_SAMPLE_COMMENTS,
  onAddComment,
  isViewOnly = false
}: TaskCommentThreadProps) {
  const user = useAuthStore(s => s.user);
  const [commentList, setCommentList] = useState<TaskComment[]>(comments || []);
  const [inputText, setInputText] = useState('');

  React.useEffect(() => {
    if (comments) {
      setCommentList(comments);
    }
  }, [comments]);

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      authorId: user?.id || 'self',
      authorName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Current User',
      authorRole: user?.role || 'Agent',
      content: inputText.trim(),
      createdAt: new Date().toISOString()
    };

    setCommentList(prev => [...prev, newComment]);
    if (onAddComment) {
      onAddComment(newComment);
    }
    setInputText('');
    toast.success('Comment posted');
  };

  const formatCommentDate = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Recently' : format(d, 'dd MMM, hh:mm a');
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
          <MessageSquare className="w-3.5 h-3.5 text-primary-600" />
          Task Discussion &amp; Activity Notes ({commentList.length})
        </h4>
        <span className="text-[11px] text-gray-400 font-medium">Visible to team</span>
      </div>

      {/* Comment List */}
      <div className="space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
        {commentList.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-400">No comments yet. Be the first to add context or updates.</p>
          </div>
        ) : (
          commentList.map(item => {
            const authorName = item.authorName || 'User';
            const isMe = item.authorId === user?.id || Boolean(user?.firstName && authorName.includes(user.firstName));
            const initials = authorName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border text-xs transition-all ${
                  isMe
                    ? 'bg-primary-50/50 border-primary-100 ml-3'
                    : 'bg-slate-50/80 border-slate-200/80 mr-3'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      isMe ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {initials}
                    </div>
                    <span className="font-bold text-gray-900">{authorName}</span>
                    {item.authorRole && (
                      <span className="text-[9px] font-semibold text-gray-400 uppercase">
                        • {item.authorRole}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3" />
                    {formatCommentDate(item.createdAt)}
                  </span>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed pl-8">
                  {item.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Add Comment Input */}
      {!isViewOnly && (
        <form onSubmit={handlePost} className="pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a remark, customer update or note..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="input flex-1 p-2.5 text-xs border border-gray-200 rounded-xl bg-white focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Post
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
